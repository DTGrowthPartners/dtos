import { PrismaClient } from '@prisma/client';
import { currentPeriod } from './cobros.service';

const prisma = new PrismaClient();

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DAY = 86400000;

const normalizeToMonthly = (price: number, frecuencia: string): number => {
  switch (frecuencia) {
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
  contractType: 'mrr' | 'project'; monthlyValue: number; nit?: string; clientSince: string;
  servicesSummary: string; servicesCount: number;
  services: { name: string; status: string; monthlyPrice: number }[];
  outstandingBalance: number; balanceLabel: string;
  nextBilling: string; urgency: Urgency; urgencyLabel: string;
  invoices: { id: string; amount: number; status: string }[];
  ads: null;
  activity: { label: string; date: string; positive?: boolean }[];
  totals: { facturado: number; pagado: number; pendiente: number; ltvMonths: number };
}

/** Lista de clientes con todo calculado (MRR, saldo, urgencia, totales) + resumen. */
export const getClientesV2 = async () => {
  const period = currentPeriod();

  const clients = await prisma.client.findMany({
    select: { id: true, name: true, nit: true, status: true, createdAt: true },
  });
  const clientServices = await prisma.clientService.findMany({
    where: { estado: 'activo' },
    include: { service: { select: { name: true, price: true } } },
  });
  const cobros = await prisma.cobro.findMany({ orderBy: { fechaCobro: 'desc' } });

  // Servicios activos por cliente
  const svcByClient = new Map<string, { names: string[]; monthly: number; billingDay: number; hasRecurring: boolean; services: { name: string; status: string; monthlyPrice: number }[] }>();
  for (const cs of clientServices) {
    const price = cs.precioCliente ?? cs.service.price ?? 0;
    const cur = svcByClient.get(cs.clientId) || { names: [], monthly: 0, billingDay: 5, hasRecurring: false, services: [] };
    cur.names.push(cs.service.name);
    cur.services.push({ name: cs.service.name, status: cs.estado, monthlyPrice: Math.round(price) });
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

  // Cobros por cliente (con estado recomputado)
  const cobrosByClient = new Map<string, typeof cobros>();
  for (const c of cobros) {
    const arr = cobrosByClient.get(c.clientId) || [];
    arr.push(c);
    cobrosByClient.set(c.clientId, arr);
  }

  const out: ClienteV2[] = clients.map((cl) => {
    const svc = svcByClient.get(cl.id);
    const cs = cobrosByClient.get(cl.id) || [];
    const withEstado = cs.map((c) => ({ ...c, est: computeEstado(c.estado, c.paidAt, c.fechaCobro) }));
    const unpaid = withEstado.filter((c) => c.est !== 'pagado');
    const vencidos = unpaid.filter((c) => c.est === 'vencido').sort((a, b) => a.fechaCobro.getTime() - b.fechaCobro.getTime());
    const pendientes = unpaid.filter((c) => c.est === 'pendiente').sort((a, b) => a.fechaCobro.getTime() - b.fechaCobro.getTime());
    const outstanding = unpaid.reduce((a, c) => a + c.monto, 0);

    // Urgencia + próximo cobro
    let urgency: Urgency = 'ok';
    let urgencyLabel = '';
    let nextBilling = '';
    if (vencidos.length) {
      const f = vencidos[0].fechaCobro;
      const days = Math.max(0, Math.floor((Date.now() - f.getTime()) / DAY));
      urgency = 'overdue';
      urgencyLabel = days === 0 ? 'Vencido hoy' : `Vencido hace ${days} día${days === 1 ? '' : 's'}`;
      nextBilling = f.toISOString();
    } else if (pendientes.length) {
      const f = pendientes[0].fechaCobro;
      const days = Math.ceil((f.getTime() - Date.now()) / DAY);
      nextBilling = f.toISOString();
      if (days <= 0) { urgency = 'due_today'; urgencyLabel = 'Vence hoy'; }
      else if (days <= 5) { urgency = 'due_soon'; urgencyLabel = `Cobra en ${days} día${days === 1 ? '' : 's'}`; }
      else { urgency = 'ok'; urgencyLabel = `Próximo: ${fmtDayMon(f)}`; }
    } else if (svc?.hasRecurring) {
      // Sin cobros pendientes: proyectar el próximo según el día de cobro
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
      urgencyLabel = 'Sin recurrencia';
    }

    const balanceLabel = outstanding === 0 ? 'Al día' : unpaid.length === 1 ? '1 factura' : `${unpaid.length} facturas`;
    const facturado = withEstado.reduce((a, c) => a + c.monto, 0);
    const pagado = withEstado.filter((c) => c.est === 'pagado').reduce((a, c) => a + c.monto, 0);
    const ltvMonths = Math.max(1, Math.round((Date.now() - cl.createdAt.getTime()) / (DAY * 30)));

    return {
      id: cl.id,
      name: cl.name,
      initials: initialsOf(cl.name),
      status: cl.status,
      contractType: svc?.hasRecurring || !svc ? 'mrr' : 'project',
      monthlyValue: Math.round(svc?.monthly || 0),
      nit: cl.nit || undefined,
      clientSince: monthYear(cl.createdAt),
      servicesSummary: svc?.names.join(' · ') || 'Sin servicios',
      servicesCount: svc?.services.length || 0,
      services: svc?.services || [],
      outstandingBalance: Math.round(outstanding),
      balanceLabel,
      nextBilling,
      urgency,
      urgencyLabel,
      invoices: withEstado
        .sort((a, b) => b.fechaCobro.getTime() - a.fechaCobro.getTime())
        .slice(0, 8)
        .map((c) => ({ id: c.id, amount: c.monto, status: c.est === 'pagado' ? 'pagada' : c.est === 'vencido' ? 'vencida' : 'pendiente' })),
      ads: null,
      activity: buildActivity(withEstado),
      totals: { facturado: Math.round(facturado), pagado: Math.round(pagado), pendiente: Math.round(outstanding), ltvMonths },
    };
  });

  // Resumen (KPIs)
  const mrrActivo = out.reduce((a, c) => a + c.monthlyValue, 0);
  const recurrentes = out.filter((c) => c.monthlyValue > 0).length;
  const porCobrar = out.reduce((a, c) => a + c.outstandingBalance, 0);
  const clientesConSaldo = out.filter((c) => c.outstandingBalance > 0).length;
  const cobradoMes = cobros
    .filter((c) => c.periodo === period && computeEstado(c.estado, c.paidAt, c.fechaCobro) === 'pagado')
    .reduce((a, c) => a + c.monto, 0);
  const activos = out.filter((c) => c.status === 'active').length;

  const URG: Record<Urgency, number> = { overdue: 0, due_today: 1, due_soon: 2, ok: 3 };
  out.sort((a, b) => URG[a.urgency] - URG[b.urgency] || b.outstandingBalance - a.outstandingBalance || a.name.localeCompare(b.name));

  return {
    summary: { mrrActivo, recurrentes, porCobrar, clientesConSaldo, cobradoMes: Math.round(cobradoMes), activos, total: out.length },
    clients: out,
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
