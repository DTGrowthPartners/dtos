import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Clock, AlertTriangle, AlertCircle, MessageCircle, FileText,
  Briefcase, Receipt, TrendingUp, Activity, CheckCircle2, Loader2, Pencil,
  Megaphone, Target, ShoppingBag, Image as ImageIcon, MapPin, Users, Plus,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import ClientServicesManager from '@/components/clients/ClientServicesManager';
import ClientSedesManager from '@/components/clients/ClientSedesManager';
import ClientContactsManager from '@/components/clients/ClientContactsManager';
import {
  fmtFull, fmtM, requiereAccion,
  type ClientV2, type ContractType,
} from '@/components/clientes/mock';

interface Summary {
  mrrActivo: number; recurrentes: number; ipp?: number; conProyecto?: number;
  porCobrar: number; clientesConSaldo: number;
  cobradoMes: number; cobrosMesTotal?: number; cobrosMesPagados?: number;
  proyectosActivos?: number; activos: number; total: number;
}
interface ClientesV2Response { summary: Summary; clients: ClientV2[] }

type FilterKey = 'todos' | 'activos' | 'mrr' | 'proyectos' | 'deuda';

/* ───────────────────────── helpers de estilo ───────────────────────── */

const contractChip: Record<ContractType, { label: string; cls: string }> = {
  mrr: { label: 'MRR', cls: 'bg-blue-500/15 text-blue-400' },
  project: { label: 'Proyecto', cls: 'bg-violet-500/15 text-violet-400' },
  retainer: { label: 'Retainer', cls: 'bg-teal-500/15 text-teal-400' },
};

const balanceColor = (c: ClientV2) =>
  c.outstandingBalance === 0 ? 'text-emerald-400' : c.urgency === 'overdue' ? 'text-red-400' : 'text-amber-400';

const serviceVisual = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('whatsapp') || n.includes('bot')) return { Icon: MessageCircle, cls: 'bg-emerald-500/15 text-emerald-300' };
  if (n.includes('shopify')) return { Icon: ShoppingBag, cls: 'bg-violet-500/15 text-violet-300' };
  if (n.includes('contenido')) return { Icon: ImageIcon, cls: 'bg-pink-500/15 text-pink-300' };
  if (n.includes('pauta') || n.includes('gesti')) return { Icon: Target, cls: 'bg-teal-500/15 text-teal-300' };
  if (n.includes('meta') || n.includes('ads')) return { Icon: Megaphone, cls: 'bg-blue-500/15 text-blue-300' };
  return { Icon: Briefcase, cls: 'bg-blue-500/15 text-blue-300' };
};

const urgencyChip = (c: ClientV2) => {
  switch (c.urgency) {
    case 'overdue': return { Icon: AlertCircle, cls: 'text-red-400', leftBorder: 'border-l-red-500' };
    case 'due_today': return { Icon: AlertTriangle, cls: 'text-red-400', leftBorder: 'border-l-red-500' };
    case 'due_soon': return { Icon: Clock, cls: 'text-amber-400', leftBorder: 'border-l-amber-500' };
    default: return { Icon: Calendar, cls: 'text-muted-foreground', leftBorder: '' };
  }
};

function Avatar({ initials, type, size = 36 }: { initials: string; type: ContractType; size?: number }) {
  const cls = type === 'project' ? 'bg-violet-500/15 text-violet-300' : 'bg-blue-500/15 text-blue-300';
  return (
    <div
      className={`rounded-lg flex items-center justify-center font-semibold shrink-0 ${cls}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

/* ───────────────────────── KPI ───────────────────────── */

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className={`rounded-lg bg-card border border-border border-l-[3px] ${accent} px-4 py-3`}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-[22px] font-medium leading-tight tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}

/* ───────────────────────── Card de cliente ───────────────────────── */

function ClientCard({ c, onClick }: { c: ClientV2; onClick: () => void }) {
  const u = urgencyChip(c);
  const cc = contractChip[c.contractType];
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl bg-card border border-border ${u.leftBorder ? `border-l-[3px] ${u.leftBorder}` : ''} p-4 transition-colors hover:border-muted-foreground/40`}
    >
      {/* Fila 1 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3 min-w-0">
          <Avatar initials={c.initials} type={c.contractType} />
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight truncate">{c.name}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {c.servicesSummary}{c.sedes ? ` · ${c.sedes} sede${c.sedes === 1 ? '' : 's'}` : ''}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-base font-semibold tabular-nums ${balanceColor(c)}`}>{fmtFull(c.outstandingBalance)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{c.balanceLabel}</p>
        </div>
      </div>
      {/* Fila 2 */}
      <div className="flex items-center justify-between gap-2 mt-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${cc.cls}`}>{cc.label}</span>
          <span className="px-2 py-0.5 rounded-md text-[11px] text-muted-foreground bg-muted/50">
            {c.servicesCount} {c.servicesCount === 1 ? 'servicio' : 'servicios'}
          </span>
        </div>
        <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${u.cls}`}>
          <u.Icon className="h-3.5 w-3.5" /> {c.urgencyLabel}
        </span>
      </div>
    </button>
  );
}

function GroupHeader({ color, title, count }: { color: string; title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-1">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground bg-muted/60 rounded-full px-1.5 py-0.5">{count}</span>
    </div>
  );
}

/* ───────────────────────── Vista LISTA ───────────────────────── */

const MESES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fmtDate = (iso: string, withYear = true): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MESES3[d.getUTCMonth()]}${withYear ? ` ${d.getUTCFullYear()}` : ''}`;
};

// Celda "Próximo cobro": ícono + color según urgencia (verde lejano, ámbar próximo, rojo vencido).
function ProximoCobro({ c }: { c: ClientV2 }) {
  const map = {
    overdue: { Icon: AlertCircle, cls: 'text-red-400', text: `Vencido ${fmtDate(c.nextBilling, false)}` },
    due_today: { Icon: AlertTriangle, cls: 'text-amber-400', text: 'Vence hoy' },
    due_soon: { Icon: Clock, cls: 'text-amber-400', text: fmtDate(c.nextBilling) },
    ok: { Icon: Calendar, cls: 'text-muted-foreground', text: c.nextBilling ? fmtDate(c.nextBilling) : 'Sin recurrencia' },
  } as const;
  const m = map[c.urgency];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${m.cls}`}>
      <m.Icon className="h-4 w-4 shrink-0" /> {m.text}
    </span>
  );
}

function ClientRow({ c, onClick }: { c: ClientV2; onClick: () => void }) {
  // Un cliente puede ser MRR y Proyecto a la vez (retainer + proyecto puntual):
  // muestra ambas etiquetas.
  const chips: { label: string; cls: string }[] = [];
  if (c.servicesCount > 0) {
    if (c.contractType === 'mrr') chips.push(contractChip.mrr);
    if (c.contractType === 'project' || (c.projectValue ?? 0) > 0) chips.push(contractChip.project);
  }
  return (
    <tr onClick={onClick} className="border-b border-border/60 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors align-top">
      <td className="px-4 py-4 min-w-[170px]">
        <p className="font-medium leading-tight">{c.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Desde {c.clientSince}{c.sedes ? ` · ${c.sedes} sede${c.sedes === 1 ? '' : 's'}` : ''}</p>
      </td>
      <td className="px-4 py-4">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.status === 'active' ? 'border-emerald-500/30 text-emerald-400' : 'border-border text-muted-foreground'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${c.status === 'active' ? 'bg-emerald-400' : 'bg-gray-400'}`} />
          {c.status === 'active' ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td className="px-4 py-4 min-w-[170px]">
        {c.services.length ? (
          <ul className="space-y-1">
            {c.services.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0 mt-[7px]" />
                <span>{s.name}</span>
              </li>
            ))}
          </ul>
        ) : <span className="text-xs text-muted-foreground">Sin servicios</span>}
      </td>
      <td className="px-4 py-4">
        {chips.length > 0
          ? (
            <span className="flex flex-wrap gap-1">
              {chips.map((ch) => (
                <span key={ch.label} className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${ch.cls}`}>{ch.label}</span>
              ))}
            </span>
          )
          : <span className="text-xs text-muted-foreground">—</span>}
      </td>
      <td className="px-4 py-4">
        <p className={`font-semibold tabular-nums ${balanceColor(c)}`}>{fmtFull(c.outstandingBalance)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{c.balanceLabel}</p>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        {c.diasVencido ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-red-500/15 text-red-400 tabular-nums">
            {c.diasVencido} día{c.diasVencido === 1 ? '' : 's'}
          </span>
        ) : <span className="text-xs text-muted-foreground">—</span>}
      </td>
      <td className="px-4 py-4 whitespace-nowrap"><ProximoCobro c={c} /></td>
    </tr>
  );
}

function ClientesTable({ rows, onSelect }: { rows: ClientV2[]; onSelect: (c: ClientV2) => void }) {
  return (
    <div data-tour="tabla-clientes" className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
            <th className="text-left font-medium px-4 py-3">Cliente</th>
            <th className="text-left font-medium px-4 py-3">Estado</th>
            <th className="text-left font-medium px-4 py-3">Servicios activos</th>
            <th className="text-left font-medium px-4 py-3">Tipo</th>
            <th className="text-left font-medium px-4 py-3">Saldo pendiente</th>
            <th className="text-left font-medium px-4 py-3">Días vencido</th>
            <th className="text-left font-medium px-4 py-3">Próximo cobro</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => <ClientRow key={c.id} c={c} onClick={() => onSelect(c)} />)}
        </tbody>
      </table>
    </div>
  );
}

function FilterChip({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors border ${
        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'
      }`}
    >
      {label}{count != null ? ` (${count})` : ''}
    </button>
  );
}

function ClientesPanel({ data, onSelect, onNew }: { data: ClientesV2Response; onSelect: (c: ClientV2) => void; onNew: () => void }) {
  const { summary, clients } = data;
  const [filter, setFilter] = useState<FilterKey>('activos');

  const filtered = useMemo(() => {
    switch (filter) {
      case 'todos': return clients;
      case 'activos': return clients.filter((c) => c.status === 'active');
      case 'mrr': return clients.filter((c) => c.status === 'active' && c.contractType === 'mrr' && c.servicesCount > 0);
      // Proyectos: incluye clientes que además tienen MRR (proyecto puntual encima del retainer)
      case 'proyectos': return clients.filter((c) => c.status === 'active' && ((c.projectValue ?? 0) > 0 || (c.contractType === 'project' && c.servicesCount > 0)));
      case 'deuda': return clients.filter((c) => c.outstandingBalance > 0);
      default: return clients;
    }
  }, [clients, filter]);

  const mrrCount = clients.filter((c) => c.status === 'active' && c.contractType === 'mrr' && c.servicesCount > 0).length;
  const proyCount = clients.filter((c) => c.status === 'active' && ((c.projectValue ?? 0) > 0 || (c.contractType === 'project' && c.servicesCount > 0))).length;

  const cobrosSub = summary.cobrosMesTotal
    ? `${summary.cobrosMesPagados ?? 0} de ${summary.cobrosMesTotal} pagados`
    : 'mes en curso';

  const kpis = [
    { tour: 'kpi-mrr', label: 'MRR activo', value: fmtM(summary.mrrActivo), sub: `${summary.recurrentes} clientes recurrentes`, valueCls: 'text-blue-400' },
    { tour: 'kpi-pendiente', label: 'Pendiente de cobro', value: fmtM(summary.porCobrar), sub: `${summary.clientesConSaldo} clientes con saldo`, valueCls: 'text-amber-400' },
    { tour: 'kpi-cobros', label: 'Cobros este mes', value: fmtM(summary.cobradoMes), sub: cobrosSub, valueCls: 'text-emerald-400' },
    { tour: 'kpi-proyectos', label: 'Proyectos activos', value: String(proyCount), sub: 'Sin recurrencia mensual', valueCls: 'text-foreground' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header + chips */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">{summary.total} empresas · {summary.activos} activas</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <FilterChip active={filter === 'todos'} label="Todos" count={summary.total} onClick={() => setFilter('todos')} />
          <FilterChip active={filter === 'activos'} label="Activos" count={summary.activos} onClick={() => setFilter('activos')} />
          <FilterChip active={filter === 'mrr'} label="MRR" count={mrrCount} onClick={() => setFilter('mrr')} />
          <FilterChip active={filter === 'proyectos'} label="Proyectos" count={proyCount} onClick={() => setFilter('proyectos')} />
          <FilterChip active={filter === 'deuda'} label="Deuda pendiente" count={summary.clientesConSaldo} onClick={() => setFilter('deuda')} />
          <Button size="sm" onClick={onNew} className="gap-1.5"><Plus className="h-4 w-4" /> Nuevo</Button>
        </div>
      </div>

      {/* KPIs (planas, estilo mockup) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} data-tour={k.tour} className="rounded-xl bg-card border border-border px-4 py-3">
            <p className="text-[11px] text-muted-foreground">{k.label}</p>
            <p className={`text-[26px] font-semibold leading-tight tabular-nums mt-0.5 ${k.valueCls}`}>{k.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabla de clientes */}
      {filtered.length === 0
        ? <p className="text-center py-12 text-muted-foreground">No hay clientes en este filtro.</p>
        : <ClientesTable rows={filtered} onSelect={onSelect} />}
    </div>
  );
}

/* ───────────────────────── Vista DETALLE ───────────────────────── */

function MiniStat({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-lg bg-muted/30 border border-border/60 px-4 py-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-medium tabular-nums leading-tight ${cls || ''}`}>{value}</p>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {children}
    </div>
  );
}

const invoiceDot: Record<CInvStatus, string> = {
  pagada: 'bg-emerald-500',
  pendiente: 'bg-amber-500',
  vencida: 'bg-red-500',
};
type CInvStatus = 'pagada' | 'pendiente' | 'vencida';

function ClientDetail({ c, onBack, onUpdated }: { c: ClientV2; onBack: () => void; onUpdated: () => void }) {
  const cc = contractChip[c.contractType];
  const { toast } = useToast();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mgmtTab, setMgmtTab] = useState<'servicios' | 'sedes' | 'contactos'>('servicios');
  const [form, setForm] = useState({ name: c.name, email: c.email || '', nit: c.nit || '', phone: c.phone || '', address: c.address || '' });
  const waPhone = (c.phone || '').replace(/[^0-9]/g, '');

  const openEdit = () => {
    setForm({ name: c.name, email: c.email || '', nit: c.nit || '', phone: c.phone || '', address: c.address || '' });
    setEditOpen(true);
  };
  const save = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      await apiClient.put(`/api/clients/${c.id}`, {
        name: form.name.trim(), email: form.email.trim(), nit: form.nit.trim() || undefined,
        phone: form.phone.trim() || undefined, address: form.address.trim() || undefined,
      });
      setEditOpen(false);
      toast({ title: 'Cliente actualizado' });
      onUpdated();
    } catch {
      toast({ title: 'Error', description: 'No se pudo actualizar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Volver a clientes
      </button>

      {/* Hero */}
      <div className="rounded-xl bg-card border border-border p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex gap-4 min-w-0">
            <Avatar initials={c.initials} type={c.contractType} size={48} />
            <div className="min-w-0">
              <h2 className="text-lg font-medium leading-tight">{c.name}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 font-medium">
                  <CheckCircle2 className="h-3 w-3" /> {c.status === 'active' ? 'Activo' : 'Inactivo'}
                </span>
                {c.monthlyValue > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-400 font-medium">MRR · {fmtM(c.monthlyValue)}/mes</span>
                )}
                {(c.projectValue ?? 0) > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-400 font-medium">IPP · {fmtM(c.projectValue!)}</span>
                )}
                {c.nit && <span className="text-muted-foreground">NIT {c.nit}</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                · Cliente desde {c.clientSince}{c.sedes ? ` · ${c.sedes} sede${c.sedes === 1 ? '' : 's'}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={openEdit} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors">
              <Pencil className="h-4 w-4" /> Editar
            </button>
            <button
              onClick={() => waPhone && window.open(`https://wa.me/${waPhone}`, '_blank')}
              disabled={!waPhone}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </button>
            <button onClick={() => navigate('/cobros')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors">
              <FileText className="h-4 w-4" /> Cobrar
            </button>
          </div>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <MiniStat label="Total facturado" value={fmtM(c.totals.facturado)} />
          <MiniStat label="Total pagado" value={fmtM(c.totals.pagado)} cls="text-emerald-400" />
          <MiniStat label="Pendiente" value={fmtM(c.totals.pendiente)} cls={c.totals.pendiente > 0 ? 'text-amber-400' : ''} />
          <MiniStat label="LTV / meses" value={`${c.totals.ltvMonths} meses`} />
        </div>
      </div>

      {/* Grid 1: Servicios + Facturación */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Servicios activos" icon={Briefcase}>
          <div className="space-y-2">
            {c.services.map((s, i) => {
              const v = serviceVisual(s.name);
              return (
                <div key={i} className="flex items-center justify-between gap-3 py-1.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-8 w-8 rounded-lg ${v.cls} flex items-center justify-center shrink-0`}>
                      <v.Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm truncate">{s.name} <span className="text-xs text-emerald-400">● {s.status}</span></p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${s.recurring === false ? 'bg-violet-500/15 text-violet-400' : 'bg-blue-500/15 text-blue-400'}`}>
                        {s.recurring === false ? 'Único' : 'Recurrente'}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground shrink-0">{s.monthlyPrice > 0 ? `${fmtFull(s.monthlyPrice)}${s.recurring === false ? '' : '/mes'}` : '—'}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Facturación" icon={Receipt}>
          {c.invoices.some((i) => i.status !== 'pagada') && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 mb-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs">
                <p className="font-medium text-amber-300">Próximo cobro: {c.urgencyLabel.toLowerCase()}</p>
                <p className="text-muted-foreground">
                  Factura #{c.invoices.find((i) => i.status !== 'pagada')?.id.slice(0, 8)} · {fmtFull(c.invoices.find((i) => i.status !== 'pagada')?.amount || 0)}
                </p>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            {c.invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 py-1">
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${invoiceDot[inv.status]}`} />
                  <span className="text-xs font-mono text-muted-foreground truncate">#{inv.id}</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {!!inv.diasVencido && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-400 tabular-nums">
                      {inv.diasVencido}d
                    </span>
                  )}
                  <span className="text-sm tabular-nums">{fmtFull(inv.amount)}</span>
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Grid 2: Pauta + Actividad */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title={`Rendimiento de pauta (${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][new Date().getMonth()]})`} icon={TrendingUp}>
          {c.ads ? (
            <div className="space-y-2.5 text-sm">
              <Row label="Inversión Meta Ads" value={fmtM(c.ads.metaSpend)} />
              <Row label="Conversaciones WA" value={`${c.ads.waConversations}`} extra={`↑${c.ads.waDelta}%`} />
              <Row label="Costo por conversación" value={fmtFull(c.ads.costPerConv)} />
              <Row label="Campaña principal" value={c.ads.mainCampaign} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin pauta activa este mes.</p>
          )}
        </Panel>

        <Panel title="Actividad reciente" icon={Activity}>
          <div className="space-y-2.5">
            {c.activity.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className={a.positive ? 'text-emerald-400' : ''}>{a.label}</span>
                <span className={`text-xs shrink-0 ${a.positive ? 'text-emerald-400' : 'text-muted-foreground'}`}>{a.date}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Pagos recibidos · Google Sheets (fuente del contador) */}
      <Panel title="Pagos recibidos · Google Sheets" icon={Receipt}>
        {c.payments && c.payments.length > 0 ? (
          <>
            <div className="flex items-center justify-between text-sm mb-3 pb-2 border-b border-border">
              <span className="text-muted-foreground">Total pagado (hoja Entradas)</span>
              <span className="font-semibold text-emerald-400 tabular-nums">{fmtFull(c.paidSheets || 0)}</span>
            </div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {c.payments.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{p.descripcion || 'Pago de cliente'}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {(p.fecha || '').slice(0, 10)}{p.cuenta ? ` · ${p.cuenta}` : ''}{p.cuentaCobro ? ` · CC ${p.cuentaCobro}` : ''}{p.tipoPago ? ` · ${p.tipoPago}` : ''}
                    </p>
                  </div>
                  <span className="text-sm tabular-nums text-emerald-400 shrink-0">{fmtFull(p.importe)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Sin pagos registrados en Google Sheets (hoja Entradas) para este cliente.</p>
        )}
      </Panel>

      {/* Gestión del cliente: servicios, sedes y contactos */}
      <div className="rounded-xl bg-card border border-border p-4">
        <div className="flex items-center gap-1.5 mb-4 border-b border-border">
          {([
            { key: 'servicios', label: 'Servicios', Icon: Briefcase },
            { key: 'sedes', label: 'Sedes', Icon: MapPin },
            { key: 'contactos', label: 'Contactos', Icon: Users },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setMgmtTab(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                mgmtTab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
        {mgmtTab === 'servicios' && <ClientServicesManager client={{ id: c.id, name: c.name }} onUpdate={onUpdated} />}
        {mgmtTab === 'sedes' && <ClientSedesManager client={{ id: c.id, name: c.name }} />}
        {mgmtTab === 'contactos' && <ClientContactsManager client={{ id: c.id, name: c.name }} />}
      </div>

      {/* Editar cliente */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader><DialogTitle>Editar cliente</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1"><Label className="text-xs">Nombre *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">NIT/RUT</Label>
                <Input value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Teléfono</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Dirección</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>{saving ? 'Guardando…' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, extra }: { label: string; value: string; extra?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">
        {value} {extra && <span className="text-emerald-400 text-xs ml-1">{extra}</span>}
      </span>
    </div>
  );
}

/* ───────────────────────── Página ───────────────────────── */

function NewClientDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', nit: '', phone: '', address: '' });
  const save = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      await apiClient.post('/api/clients', {
        name: form.name.trim(),
        email: form.email.trim() || `${form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')}@dtgrowthpartners.com`,
        nit: form.nit.trim() || undefined, phone: form.phone.trim() || undefined, address: form.address.trim() || undefined,
        status: 'active',
      });
      onOpenChange(false);
      setForm({ name: '', email: '', nit: '', phone: '', address: '' });
      toast({ title: 'Cliente creado' });
      onCreated();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'No se pudo crear', variant: 'destructive' });
    } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader><DialogTitle>Nuevo cliente</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1"><Label className="text-xs">Nombre *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre de la empresa" /></div>
          <div className="space-y-1"><Label className="text-xs">Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">NIT/RUT</Label>
              <Input value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Teléfono</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Dirección</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !form.name.trim()}>{saving ? 'Guardando…' : 'Crear'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ClientesRedesign() {
  const [data, setData] = useState<ClientesV2Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ClientV2 | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const load = () =>
    apiClient.get<ClientesV2Response>('/api/clientes-v2').then((d) => {
      setData(d);
      setSelected((prev) => (prev ? d.clients.find((c) => c.id === prev.id) || prev : null));
    }).catch(() => {});

  useEffect(() => { load().finally(() => setLoading(false)); /* eslint-disable-next-line */ }, []);

  // Driver del chat (María): /clientes?cliente=<nombre> abre el detalle de ese cliente.
  useEffect(() => {
    const q = searchParams.get('cliente');
    if (!q || !data) return;
    const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
    const n = norm(q);
    if (n.length >= 3) {
      const c = data.clients.find((x) => norm(x.name).includes(n) || n.includes(norm(x.name)));
      if (c) setSelected(c);
    }
    setSearchParams({}, { replace: true });
  }, [data, searchParams]);

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!data) return <div className="text-center py-20 text-muted-foreground">No se pudieron cargar los clientes.</div>;
  return (
    <>
      {selected
        ? <ClientDetail c={selected} onBack={() => setSelected(null)} onUpdated={load} />
        : <ClientesPanel data={data} onSelect={setSelected} onNew={() => setNewOpen(true)} />}
      <NewClientDialog open={newOpen} onOpenChange={setNewOpen} onCreated={load} />
    </>
  );
}
