import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Normaliza un precio a su valor mensual segun la frecuencia (igual que metrics). */
const normalizeToMonthly = (price: number, frecuencia: string): number => {
  switch (frecuencia) {
    case 'mensual':
      return price;
    case 'trimestral':
      return price / 3;
    case 'semestral':
      return price / 6;
    case 'anual':
      return price / 12;
    case 'unico':
      return 0;
    default:
      return price;
  }
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Devuelve el periodo actual "YYYY-MM" en zona America/Bogota. */
export const currentPeriod = (): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  return `${y}-${m}`;
};

const isValidPeriod = (p: string): boolean => /^\d{4}-\d{2}$/.test(p);

/** Calcula el estado de un cobro no pagado segun la fecha de cobro vs hoy. */
const computeEstado = (estado: string, paidAt: Date | null, fechaCobro: Date): string => {
  if (estado === 'pagado' || paidAt) return 'pagado';
  const now = new Date();
  return fechaCobro.getTime() < now.getTime() ? 'vencido' : 'pendiente';
};

export interface CobroRow {
  id: string;
  clientId: string;
  clienteNombre: string;
  periodo: string;
  monto: number;
  moneda: string;
  fechaCobro: string;
  estado: string;
  paidAt: string | null;
  metodoPago: string | null;
  referencia: string | null;
  nota: string | null;
  registradoPor: string | null;
  servicios: string[];
}

/**
 * Asegura que existan los cobros del periodo (uno por cliente con servicios
 * activos), los crea si faltan, actualiza el monto de los no-pagados para
 * reflejar cambios en los servicios, y devuelve la lista + MRR total.
 */
export const getCobrosForPeriod = async (periodInput?: string) => {
  const periodo = periodInput && isValidPeriod(periodInput) ? periodInput : currentPeriod();
  const [yearStr, monthStr] = periodo.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12

  // 1. Servicios activos agrupados por cliente -> valor mensual + dia de cobro
  const clientServices = await prisma.clientService.findMany({
    where: { estado: 'activo' },
    include: {
      service: { select: { name: true, price: true } },
      client: { select: { id: true, name: true } },
    },
  });

  const byClient = new Map<
    string,
    { clienteNombre: string; monto: number; moneda: string; billingDay: number; servicios: string[] }
  >();

  for (const cs of clientServices) {
    if (cs.frecuencia === 'unico') continue; // no recurrente, no entra al MRR mensual
    const price = cs.precioCliente ?? cs.service.price;
    const monthly = normalizeToMonthly(price, cs.frecuencia);
    if (monthly <= 0) continue;

    const cur = byClient.get(cs.client.id) || {
      clienteNombre: cs.client.name,
      monto: 0,
      moneda: cs.moneda || 'COP',
      billingDay: 5,
      servicios: [],
    };
    cur.monto += monthly;
    cur.servicios.push(cs.service.name);
    // Dia de cobro: del fechaProximoCobro del servicio si existe, sino 5
    if (cs.fechaProximoCobro) {
      const d = new Date(cs.fechaProximoCobro).getDate();
      if (d >= 1 && d <= 28) cur.billingDay = d;
    }
    byClient.set(cs.client.id, cur);
  }

  // 2. Cobros existentes del periodo
  const existing = await prisma.cobro.findMany({ where: { periodo } });
  const existingByClient = new Map(existing.map((c) => [c.clientId, c]));

  // 3. Crear los que falten + actualizar monto de los no pagados
  for (const [clientId, data] of byClient.entries()) {
    const fechaCobro = new Date(Date.UTC(year, month - 1, data.billingDay, 12, 0, 0));
    const found = existingByClient.get(clientId);
    if (!found) {
      await prisma.cobro.create({
        data: {
          clientId,
          clienteNombre: data.clienteNombre,
          periodo,
          monto: Math.round(data.monto),
          moneda: data.moneda,
          fechaCobro,
          estado: computeEstado('pendiente', null, fechaCobro),
        },
      });
    } else if (found.estado !== 'pagado' && !found.paidAt) {
      // Mantener el monto sincronizado con los servicios mientras no este pagado
      const newMonto = Math.round(data.monto);
      if (newMonto !== found.monto || found.clienteNombre !== data.clienteNombre) {
        await prisma.cobro.update({
          where: { id: found.id },
          data: { monto: newMonto, clienteNombre: data.clienteNombre },
        });
      }
    }
  }

  // 4. Releer y mapear (recomputando estado para los no pagados)
  const cobros = await prisma.cobro.findMany({
    where: { periodo },
    orderBy: { monto: 'desc' },
  });

  const rows: CobroRow[] = cobros.map((c) => ({
    id: c.id,
    clientId: c.clientId,
    clienteNombre: c.clienteNombre,
    periodo: c.periodo,
    monto: c.monto,
    moneda: c.moneda,
    fechaCobro: c.fechaCobro.toISOString(),
    estado: computeEstado(c.estado, c.paidAt, c.fechaCobro),
    paidAt: c.paidAt ? c.paidAt.toISOString() : null,
    metodoPago: c.metodoPago,
    referencia: c.referencia,
    nota: c.nota,
    registradoPor: c.registradoPor,
    servicios: byClient.get(c.clientId)?.servicios || [],
  }));

  // 5. Totales
  const mrrTotal = Array.from(byClient.values()).reduce((acc, c) => acc + c.monto, 0);
  const cobradoMes = rows.filter((r) => r.estado === 'pagado').reduce((a, r) => a + r.monto, 0);
  const pendienteMes = rows.filter((r) => r.estado === 'pendiente').reduce((a, r) => a + r.monto, 0);
  const vencidoMes = rows.filter((r) => r.estado === 'vencido').reduce((a, r) => a + r.monto, 0);

  return {
    periodo,
    mrrTotal: Math.round(mrrTotal),
    cobradoMes: Math.round(cobradoMes),
    pendienteMes: Math.round(pendienteMes),
    vencidoMes: Math.round(vencidoMes),
    cobros: rows,
  };
};

export interface RegisterPaymentInput {
  metodoPago?: string;
  referencia?: string;
  nota?: string;
  registradoPor?: string;
}

export const markCobroPaid = async (id: string, input: RegisterPaymentInput) => {
  const cobro = await prisma.cobro.findUnique({ where: { id } });
  if (!cobro) throw Object.assign(new Error('Cobro no encontrado'), { status: 404 });
  return prisma.cobro.update({
    where: { id },
    data: {
      estado: 'pagado',
      paidAt: new Date(),
      metodoPago: input.metodoPago || null,
      referencia: input.referencia || null,
      nota: input.nota || null,
      registradoPor: input.registradoPor || null,
    },
  });
};

export const unmarkCobroPaid = async (id: string) => {
  const cobro = await prisma.cobro.findUnique({ where: { id } });
  if (!cobro) throw Object.assign(new Error('Cobro no encontrado'), { status: 404 });
  return prisma.cobro.update({
    where: { id },
    data: { estado: 'pendiente', paidAt: null, metodoPago: null, referencia: null },
  });
};
