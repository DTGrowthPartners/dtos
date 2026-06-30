// Tipos + mock data del rediseño de Clientes (vista lista + detalle).
// Solo para preview de frontend; los datos reales vendrán de la API más adelante.

export type ContractType = 'mrr' | 'project' | 'retainer';
export type Urgency = 'overdue' | 'due_today' | 'due_soon' | 'ok';

export interface CService { name: string; status: 'activo' | 'pausado'; monthlyPrice: number }
export interface CInvoice { id: string; amount: number; status: 'pagada' | 'pendiente' | 'vencida' }
export interface CAds { metaSpend: number; waConversations: number; waDelta: number; costPerConv: number; mainCampaign: string }
export interface CActivity { label: string; date: string; positive?: boolean }

export interface ClientV2 {
  id: string;
  name: string;
  initials: string;
  status: 'active' | 'inactive';
  contractType: ContractType;
  monthlyValue: number;
  nit?: string;
  clientSince: string;          // "ene 2026"
  servicesSummary: string;      // "Meta Ads · WhatsApp Bot"
  servicesCount: number;
  services: CService[];
  outstandingBalance: number;
  balanceLabel: string;         // "1 factura", "Mensualidad jul", "Al día", "Hito 2"
  nextBilling: string;          // "10 jul"
  urgency: Urgency;
  urgencyLabel: string;         // "Vencido hace 2 días", "Vence hoy", "Cobra en 3 días", "Próximo: 10 jul"
  sedes?: number;
  invoices: CInvoice[];
  ads?: CAds;
  activity: CActivity[];
  totals: { facturado: number; pagado: number; pendiente: number; ltvMonths: number };
}

export const fmtFull = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');
export const fmtM = (n: number) => {
  const m = n / 1e6;
  return '$' + (Number.isInteger(m) ? m.toFixed(0) : m.toFixed(1)) + 'M';
};

const URGENCY_ORDER: Record<Urgency, number> = { overdue: 0, due_today: 1, due_soon: 2, ok: 3 };
export const requiereAccion = (c: ClientV2) => c.urgency === 'overdue' || c.urgency === 'due_today' || c.urgency === 'due_soon';
export const sortByUrgency = (a: ClientV2, b: ClientV2) =>
  URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] || b.outstandingBalance - a.outstandingBalance;

export const MOCK_CLIENTS: ClientV2[] = [
  {
    id: 'hsa', name: 'Hotel Santa Alejandría', initials: 'HS', status: 'active',
    contractType: 'project', monthlyValue: 0, nit: '900111222-3', clientSince: 'nov 2024',
    servicesSummary: 'Shopify Dev · Meta Ads', servicesCount: 2,
    services: [
      { name: 'Shopify Dev', status: 'activo', monthlyPrice: 0 },
      { name: 'Meta Ads', status: 'activo', monthlyPrice: 1200000 },
    ],
    outstandingBalance: 2000000, balanceLabel: 'Hito 2',
    nextBilling: '28 jun', urgency: 'overdue', urgencyLabel: 'Vencido hace 2 días',
    invoices: [
      { id: '20260628120000', amount: 2000000, status: 'vencida' },
      { id: '20260501120000', amount: 3500000, status: 'pagada' },
    ],
    activity: [
      { label: 'Hito 1 entregado', date: '12 may' },
      { label: 'Pago recibido', date: '5 may', positive: true },
    ],
    totals: { facturado: 9500000, pagado: 7500000, pendiente: 2000000, ltvMonths: 8 },
  },
  {
    id: 'ic', name: 'Importaciones Cartagena', initials: 'IC', status: 'active',
    contractType: 'mrr', monthlyValue: 1650000, nit: '1053002499', clientSince: 'ene 2026',
    servicesSummary: 'Meta Ads · Gestión de pauta', servicesCount: 2,
    services: [
      { name: 'Meta Ads', status: 'activo', monthlyPrice: 1200000 },
      { name: 'Gestión de pauta', status: 'activo', monthlyPrice: 450000 },
    ],
    outstandingBalance: 3650000, balanceLabel: '1 factura',
    nextBilling: 'hoy', urgency: 'due_today', urgencyLabel: 'Vence hoy',
    invoices: [
      { id: '20260630155840', amount: 2000000, status: 'pendiente' },
      { id: '20260605201352', amount: 1500000, status: 'pagada' },
      { id: '20260416213352', amount: 1650000, status: 'pagada' },
    ],
    ads: { metaSpend: 3200000, waConversations: 412, waDelta: 18, costPerConv: 7770, mainCampaign: 'WhatsApp Messages' },
    activity: [
      { label: 'Reporte mensual enviado', date: '28 jun' },
      { label: 'Factura generada', date: '30 jun' },
      { label: 'Reunión de estrategia', date: '15 jun' },
      { label: 'Pago recibido', date: '5 jun', positive: true },
    ],
    totals: { facturado: 11700000, pagado: 8070000, pendiente: 3650000, ltvMonths: 6 },
  },
  {
    id: 'acb', name: 'ACBfit Gym', initials: 'AC', status: 'active',
    contractType: 'mrr', monthlyValue: 1650000, nit: '901222333-4', clientSince: 'feb 2025',
    servicesSummary: 'Meta Ads', servicesCount: 1,
    services: [{ name: 'Meta Ads', status: 'activo', monthlyPrice: 1650000 }],
    outstandingBalance: 1650000, balanceLabel: 'Mensualidad jul',
    nextBilling: '3 jul', urgency: 'due_soon', urgencyLabel: 'Cobra en 3 días',
    invoices: [{ id: '20260703120000', amount: 1650000, status: 'pendiente' }],
    ads: { metaSpend: 2100000, waConversations: 230, waDelta: 9, costPerConv: 9130, mainCampaign: 'Leads Gym' },
    activity: [{ label: 'Reporte mensual enviado', date: '25 jun' }],
    totals: { facturado: 8250000, pagado: 6600000, pendiente: 1650000, ltvMonths: 5 },
  },
  {
    id: 'eq', name: 'Equilibrio Clinic', initials: 'EQ', status: 'active',
    contractType: 'mrr', monthlyValue: 2400000, nit: '900444555-6', clientSince: 'mar 2024',
    servicesSummary: 'Meta Ads ×2 sedes · WhatsApp Bot', servicesCount: 3, sedes: 2,
    services: [
      { name: 'Meta Ads — Castellana', status: 'activo', monthlyPrice: 1000000 },
      { name: 'Meta Ads — Bocagrande', status: 'activo', monthlyPrice: 1000000 },
      { name: 'WhatsApp Bot', status: 'activo', monthlyPrice: 400000 },
    ],
    outstandingBalance: 0, balanceLabel: 'Al día',
    nextBilling: '5 jul', urgency: 'ok', urgencyLabel: 'Próximo: 5 jul',
    invoices: [{ id: '20260605120000', amount: 2400000, status: 'pagada' }],
    ads: { metaSpend: 4100000, waConversations: 680, waDelta: 22, costPerConv: 6030, mainCampaign: 'Citas médicas' },
    activity: [{ label: 'Pago recibido', date: '5 jun', positive: true }],
    totals: { facturado: 28800000, pagado: 28800000, pendiente: 0, ltvMonths: 16 },
  },
  {
    id: 'tc', name: 'Tennis Cartagena', initials: 'TC', status: 'active',
    contractType: 'mrr', monthlyValue: 1400000, nit: '900666777-8', clientSince: 'ago 2023',
    servicesSummary: 'Meta Ads · Contenido', servicesCount: 2,
    services: [
      { name: 'Meta Ads', status: 'activo', monthlyPrice: 900000 },
      { name: 'Contenido', status: 'activo', monthlyPrice: 500000 },
    ],
    outstandingBalance: 0, balanceLabel: 'Al día',
    nextBilling: '10 jul', urgency: 'ok', urgencyLabel: 'Próximo: 10 jul',
    invoices: [{ id: '20260610120000', amount: 1400000, status: 'pagada' }],
    activity: [{ label: 'Pago recibido', date: '10 jun', positive: true }],
    totals: { facturado: 33600000, pagado: 33600000, pendiente: 0, ltvMonths: 24 },
  },
  {
    id: 'ad', name: 'Autoexpress Detailing', initials: 'AD', status: 'active',
    contractType: 'mrr', monthlyValue: 1300000, nit: '900888999-0', clientSince: 'jun 2024',
    servicesSummary: 'Meta Ads · WhatsApp Automation', servicesCount: 2,
    services: [
      { name: 'Meta Ads', status: 'activo', monthlyPrice: 900000 },
      { name: 'WhatsApp Automation', status: 'activo', monthlyPrice: 400000 },
    ],
    outstandingBalance: 0, balanceLabel: 'Al día',
    nextBilling: '15 jul', urgency: 'ok', urgencyLabel: 'Próximo: 15 jul',
    invoices: [{ id: '20260615120000', amount: 1300000, status: 'pagada' }],
    activity: [{ label: 'Pago recibido', date: '15 jun', positive: true }],
    totals: { facturado: 15600000, pagado: 15600000, pendiente: 0, ltvMonths: 12 },
  },
  {
    id: 'sa', name: 'San Autos', initials: 'SA', status: 'active',
    contractType: 'mrr', monthlyValue: 950000, nit: '901000111-2', clientSince: 'ene 2025',
    servicesSummary: 'Meta Ads', servicesCount: 1,
    services: [{ name: 'Meta Ads', status: 'activo', monthlyPrice: 950000 }],
    outstandingBalance: 0, balanceLabel: 'Al día',
    nextBilling: '20 jul', urgency: 'ok', urgencyLabel: 'Próximo: 20 jul',
    invoices: [{ id: '20260620120000', amount: 950000, status: 'pagada' }],
    activity: [{ label: 'Pago recibido', date: '20 jun', positive: true }],
    totals: { facturado: 5700000, pagado: 5700000, pendiente: 0, ltvMonths: 6 },
  },
];

export const KPIS = [
  { label: 'MRR activo', value: '$21.5M', sub: '7 recurrentes', accent: 'border-l-blue-500' },
  { label: 'Por cobrar', value: '$7.2M', sub: '3 clientes', accent: 'border-l-amber-500' },
  { label: 'Cobrado este mes', value: '$18.3M', sub: '85% de la meta', accent: 'border-l-emerald-500' },
  { label: 'Meta 2026', value: '$25M', sub: 'faltan 18 clientes', accent: 'border-l-border' },
];
