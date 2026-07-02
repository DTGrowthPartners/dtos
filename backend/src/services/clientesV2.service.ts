import { PrismaClient } from '@prisma/client';
import { currentPeriod } from './cobros.service';
import { googleSheetsService } from './googleSheets.service';

const prisma = new PrismaClient();

// Normaliza un nombre para cruzar cliente (sistema) ↔ Tercero (hoja Entradas).
const normName = (s: string) =>
  (s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(SAS|LTDA|S\.A\.S|SA)\b/g, '').replace(/[^A-Z0-9]/g, '');

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DAY = 86400000;

const normalizeToMonthly = (price: number, frecuencia: string): number => {
  switch (frecuencia) {
    case 'semanal': return price * 4.333;   // ~4.33 semanas/mes
    case 'quincenal': return price * 2;      // 2 pagos/mes
    case 'mensual': return price;
    case 'trimestral': return price / 3;
    case 'semestral': return price / 6;
    case 'anual': return price / 12;
    case 'unico': return 0;
    default: return price;
  }
};

const computeEstado = (estado: string, paidAt: Date | null, fechaCobro: Date): 'pagado' | 'vencido' | 'pendiente' => {
  if (estado === 'pagado' || paidAt) return 'pagado';
  return fechaCobro.getTime() < Date.now() ? 'vencido' : 'pendiente';
};

const fmtDayMon = (d: Date) => `${d.getUTCDate()} ${MES[d.getUTCMonth()]}`;
const monthYear = (d: Date) => `${MES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const initialsOf = (name: string) =>
  (name || '?').trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);

export type Urgency = 'overdue' | 'due_today' | 'due_soon' | 'ok';

export interface ClienteV2 {
  id: string; name: string; initials: string; status: string;
  email?: string; phone?: string; address?: string;
  contractType: 'mrr' | 'project'; monthlyValue: number; nit?: string; clientSince: string;
  sedes: number;
  servicesSummary: string; servicesCount: number;
  services: { name: string; status: string; monthlyPrice: number; frecuencia: string; recurring: boolean }[];
  outstandingBalance: number; balanceLabel: string;
  nextBilling: string; urgency: Urgency; urgencyLabel: string;
  invoices: { id: string; amount: number; status: string }[];
  // Pagos reales desde la hoja Entradas de Google Sheets (fuente de Dairo)
  payments: { fecha: string; importe: number; descripcion: string; cuenta: string; cuentaCobro: string; tipoPago: string }[];
  paidSheets: number;
  ads: null;
  activity: { label: string; date: string; positive?: boolean }[];
  totals: { facturado: number; pagado: number; pendiente: number; ltvMonths: number };
}

/** Lista de clientes con todo calculado (MRR, saldo, urgencia, totales) + resumen. */
export const getClientesV2 = async () => {
  const period = currentPeriod();

  const clients = await prisma.client.findMany({
    select: { id: true, name: true, nit: true, status: true, createdAt: true, email: true, phone: true, address: true },
  });
  const clientServices = await prisma.clientService.findMany({
    where: { estado: 'activo' },
    include: { service: { select: { name: true, price: true } } },
  });
  const cobros = await prisma.cobro.findMany({ orderBy: { fechaCobro: 'desc' } });

  // Sedes físicas por cliente
  const sedesGrouped = await prisma.clientSede.groupBy({ by: ['clientId'], _count: { _all: true } }).catch(() => [] as any[]);
  const sedesByClient = new Map<string, number>();
  for (const s of sedesGrouped) sedesByClient.set(s.clientId, (s as any)._count._all);

  // Pagos reales desde Google Sheets (hoja Entradas). No bloquear si Sheets falla.
  let sheetPayments: Array<{ tercero: string; importe: number; fecha: string; descripcion: string; cuenta: string; cuentaCobro: string; tipoPago: string; _norm: string }> = [];
  try {
    const raw = await googleSheetsService.getClientPayments();
    sheetPayments = raw.map((p) => ({ ...p, _norm: normName(p.tercero) }));
  } catch (e) {
    console.warn('[clientes-v2] no se pudo leer pagos de Sheets:', (e as Error).message);
  }

  // Facturas reales (cuentas de cobro) — fuente de verdad de facturado/pagado/saldo.
  const allInvoices = await prisma.invoice.findMany({ orderBy: { fecha: 'desc' } });
  const invNorm = allInvoices.map((i) => ({
    norm: normName(i.clientName || ''),
    total: i.totalAmount, paid: i.paidAmount || 0, status: i.status,
    numero: i.invoiceNumber, fecha: i.fecha,
  }));

  // Mes en curso (YYYY-MM) a partir de una fecha de Sheets (soporta ISO y DD/MM/YYYY).
  const ymOf = (f: string): string => {
    const s = (f || '').trim();
    let m = s.match(/^(\d{4})-(\d{2})/); if (m) return `${m[1]}-${m[2]}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}`;
    return '';
  };

  // Servicios activos por cliente
  const svcByClient = new Map<string, { names: string[]; monthly: number; billingDay: number; hasRecurring: boolean; services: ClienteV2['services'] }>();
  for (const cs of clientServices) {
    const price = cs.precioCliente ?? cs.service.price ?? 0;
    const cur = svcByClient.get(cs.clientId) || { names: [], monthly: 0, billingDay: 5, hasRecurring: false, services: [] };
    cur.names.push(cs.service.name);
    cur.services.push({ name: cs.service.name, status: cs.estado, monthlyPrice: Math.round(price), frecuencia: cs.frecuencia, recurring: cs.frecuencia !== 'unico' });
    if (cs.frecuencia !== 'unico') {
      cur.hasRecurring = true;
      cur.monthly += normalizeToMonthly(price, cs.frecuencia);
      if (cs.fechaProximoCobro) {
        const d = new Date(cs.fechaProximoCobro).getUTCDate();
        if (d >= 1 && d <= 28) cur.billingDay = d;
      }
    }
    svcByClient.set(cs.clientId, cur);
  }

  const invStatus = (s: string): 'pagada' | 'pendiente' | 'vencida' =>
    s === 'pagada' ? 'pagada' : s === 'parcial' || s === 'pendiente' ? 'pendiente' : 'vencida';

  const out: ClienteV2[] = clients.map((cl) => {
    const svc = svcByClient.get(cl.id);
    const norm = normName(cl.name);

    // Facturas de este cliente (cruce por nombre normalizado, agrupa variantes: ACBFIT/ACB Fit/ACBFIT SAS)
    const myInv = norm.length >= 4
      ? invNorm.filter((i) => i.norm.length >= 4 && (norm.includes(i.norm) || i.norm.includes(norm)))
      : [];
    const facturado = myInv.reduce((a, i) => a + i.total, 0);
    const pagado = myInv.reduce((a, i) => a + i.paid, 0);
    const openInv = myInv.filter((i) => i.status !== 'pagada').sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    const outstanding = openInv.reduce((a, i) => a + Math.max(0, i.total - i.paid), 0);

    // Pagos reales de este cliente desde Sheets (cruce por nombre normalizado)
    const cp = norm.length >= 4
      ? sheetPayments.filter((p) => p._norm.length >= 4 && (norm.includes(p._norm) || p._norm.includes(norm)))
      : [];
    const paidSheets = cp.reduce((a, p) => a + p.importe, 0);

    // Urgencia + próximo cobro: si debe (facturas abiertas) => acción; si no, proyecta el próximo cobro recurrente.
    let urgency: Urgency = 'ok';
    let urgencyLabel = '';
    let nextBilling = '';
    if (outstanding > 0 && openInv.length) {
      const oldest = openInv[0].fecha;
      const days = Math.floor((Date.now() - oldest.getTime()) / DAY);
      nextBilling = oldest.toISOString();
      if (days > 5) { urgency = 'overdue'; urgencyLabel = `Vencido hace ${days} días`; }
      else if (days >= 0) { urgency = 'due_today'; urgencyLabel = openInv.length === 1 ? '1 factura pendiente' : `${openInv.length} facturas pendientes`; }
      else { urgency = 'due_soon'; urgencyLabel = 'Por cobrar'; }
    } else if (svc?.hasRecurring) {
      const now = new Date();
      const day = svc.billingDay;
      let y = now.getUTCFullYear(), m = now.getUTCMonth();
      if (now.getUTCDate() > day) { m += 1; if (m > 11) { m = 0; y += 1; } }
      const f = new Date(Date.UTC(y, m, day, 12, 0, 0));
      const days = Math.ceil((f.getTime() - Date.now()) / DAY);
      nextBilling = f.toISOString();
      if (days <= 5 && days >= 0) { urgency = 'due_soon'; urgencyLabel = `Cobra en ${days} día${days === 1 ? '' : 's'}`; }
      else { urgency = 'ok'; urgencyLabel = `Próximo: ${fmtDayMon(f)}`; }
    } else {
      urgency = 'ok';
      urgencyLabel = myInv.length ? 'Al día' : 'Sin recurrencia';
    }

    const balanceLabel = outstanding === 0 ? 'Al día' : openInv.length === 1 ? '1 factura' : `${openInv.length} facturas`;
    const ltvMonths = Math.max(1, Math.round((Date.now() - cl.createdAt.getTime()) / (DAY * 30)));

    return {
      id: cl.id,
      name: cl.name,
      initials: initialsOf(cl.name),
      status: cl.status,
      email: cl.email || undefined,
      phone: cl.phone || undefined,
      address: cl.address || undefined,
      contractType: svc?.hasRecurring || !svc ? 'mrr' : 'project',
      monthlyValue: Math.round(svc?.monthly || 0),
      nit: cl.nit || undefined,
      clientSince: monthYear(cl.createdAt),
      sedes: sedesByClient.get(cl.id) || 0,
      servicesSummary: svc?.names.length ? [...new Set(svc.names)].join(' · ') : 'Sin servicios',
      servicesCount: svc?.services.length || 0,
      services: svc?.services || [],
      outstandingBalance: Math.round(outstanding),
      balanceLabel,
      nextBilling,
      urgency,
      urgencyLabel,
      invoices: myInv.slice(0, 8).map((i) => ({ id: i.numero, amount: Math.round(i.total), status: invStatus(i.status) })),
      payments: cp
        .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
        .slice(0, 20)
        .map((p) => ({ fecha: p.fecha, importe: Math.round(p.importe), descripcion: p.descripcion, cuenta: p.cuenta, cuentaCobro: p.cuentaCobro, tipoPago: p.tipoPago })),
      paidSheets: Math.round(paidSheets),
      ads: null,
      activity: myInv.slice(0, 6).map((i) => ({ label: i.status === 'pagada' ? 'Pago recibido' : 'Factura generada', date: fmtDayMon(i.fecha), positive: i.status === 'pagada' })),
      totals: { facturado: Math.round(facturado), pagado: Math.round(pagado), pendiente: Math.round(outstanding), ltvMonths },
    };
  });

  // Solo clientes activos en la lista (y los KPIs se calculan sobre ellos)
  const active = out.filter((c) => c.status === 'active');

  const mrrActivo = active.reduce((a, c) => a + c.monthlyValue, 0);
  const recurrentes = active.filter((c) => c.monthlyValue > 0).length;
  const porCobrar = active.reduce((a, c) => a + c.outstandingBalance, 0);
  const clientesConSaldo = active.filter((c) => c.outstandingBalance > 0).length;
  // Cobrado este mes: pagos reales de Sheets con fecha en el mes en curso (cuadra con Finanzas).
  const cobradoMes = sheetPayments.filter((p) => ymOf(p.fecha) === period).reduce((a, p) => a + p.importe, 0);
  // "N de M al día": clientes recurrentes activos sin saldo pendiente.
  const recurrentesActivos = active.filter((c) => c.monthlyValue > 0);
  const alDiaCount = recurrentesActivos.filter((c) => c.outstandingBalance === 0).length;
  const proyectosActivos = active.filter((c) => c.contractType === 'project').length;

  const URG: Record<Urgency, number> = { overdue: 0, due_today: 1, due_soon: 2, ok: 3 };
  // Devolvemos TODOS los clientes (el frontend filtra por chips); activos primero,
  // luego por urgencia de cobro.
  const sorted = [...out].sort((a, b) =>
    Number(b.status === 'active') - Number(a.status === 'active') ||
    URG[a.urgency] - URG[b.urgency] || b.outstandingBalance - a.outstandingBalance || a.name.localeCompare(b.name)
  );

  return {
    summary: {
      mrrActivo, recurrentes, porCobrar, clientesConSaldo,
      cobradoMes: Math.round(cobradoMes),
      cobrosMesTotal: recurrentesActivos.length, cobrosMesPagados: alDiaCount,
      proyectosActivos,
      activos: active.length, total: out.length,
    },
    clients: sorted,
  };
};

const buildActivity = (cobros: { est: string; paidAt: Date | null; createdAt: Date; monto: number }[]) => {
  const items: { label: string; date: string; ts: number; positive?: boolean }[] = [];
  for (const c of cobros) {
    if (c.est === 'pagado' && c.paidAt) items.push({ label: 'Pago recibido', date: fmtDayMon(c.paidAt), ts: c.paidAt.getTime(), positive: true });
    items.push({ label: 'Factura generada', date: fmtDayMon(c.createdAt), ts: c.createdAt.getTime() });
  }
  return items.sort((a, b) => b.ts - a.ts).slice(0, 6).map(({ label, date, positive }) => ({ label, date, positive }));
};

export const getClienteV2 = async (id: string): Promise<ClienteV2 | null> => {
  const { clients } = await getClientesV2();
  return clients.find((c) => c.id === id) || null;
};
