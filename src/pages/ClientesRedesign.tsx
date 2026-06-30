import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Calendar, Clock, AlertTriangle, AlertCircle, MessageCircle, FileText,
  Briefcase, Receipt, TrendingUp, Activity, CheckCircle2, Loader2, Pencil,
  Megaphone, Target, ShoppingBag, Image as ImageIcon,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  fmtFull, fmtM, requiereAccion,
  type ClientV2, type ContractType,
} from '@/components/clientes/mock';

interface Summary { mrrActivo: number; recurrentes: number; porCobrar: number; clientesConSaldo: number; cobradoMes: number; activos: number; total: number }
interface ClientesV2Response { summary: Summary; clients: ClientV2[] }

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
            <p className="text-xs text-muted-foreground truncate mt-0.5">{c.servicesSummary}</p>
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

function ClientesPanel({ data, onSelect }: { data: ClientesV2Response; onSelect: (c: ClientV2) => void }) {
  const { summary, clients } = data;
  const { accion, alDia } = useMemo(() => ({
    accion: clients.filter(requiereAccion),
    alDia: clients.filter((c) => !requiereAccion(c)),
  }), [clients]);

  const kpis = [
    { label: 'MRR activo', value: fmtM(summary.mrrActivo), sub: `${summary.recurrentes} recurrentes`, accent: 'border-l-blue-500' },
    { label: 'Por cobrar', value: fmtM(summary.porCobrar), sub: `${summary.clientesConSaldo} cliente${summary.clientesConSaldo === 1 ? '' : 's'}`, accent: 'border-l-amber-500' },
    { label: 'Cobrado este mes', value: fmtM(summary.cobradoMes), sub: 'mes en curso', accent: 'border-l-emerald-500' },
    { label: 'Clientes activos', value: String(summary.activos), sub: `de ${summary.total}`, accent: 'border-l-border' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-medium">
          Clientes <span className="text-sm text-muted-foreground font-normal">{summary.total} empresas · {summary.activos} activas · ordenadas por urgencia de cobro</span>
        </h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Requiere acción */}
      {accion.length > 0 && (
        <div className="space-y-2">
          <GroupHeader color="bg-red-500" title="Requiere acción" count={accion.length} />
          {accion.map((c) => <ClientCard key={c.id} c={c} onClick={() => onSelect(c)} />)}
        </div>
      )}

      {/* Al día */}
      {alDia.length > 0 && (
        <div className="space-y-2">
          <GroupHeader color="bg-emerald-500" title="Al día" count={alDia.length} />
          {alDia.map((c) => <ClientCard key={c.id} c={c} onClick={() => onSelect(c)} />)}
        </div>
      )}
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
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: c.name, email: c.email || '', nit: c.nit || '', phone: c.phone || '', address: c.address || '' });

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
                {c.contractType === 'mrr' && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-400 font-medium">MRR · {fmtM(c.monthlyValue)}/mes</span>
                )}
                {c.nit && <span className="text-muted-foreground">NIT {c.nit}</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">· Cliente desde {c.clientSince}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={openEdit} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors">
              <Pencil className="h-4 w-4" /> Editar
            </button>
            <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </button>
            <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors">
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
                <span className="text-sm tabular-nums shrink-0">{fmtFull(inv.amount)}</span>
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

export default function ClientesRedesign() {
  const [data, setData] = useState<ClientesV2Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ClientV2 | null>(null);

  const load = () =>
    apiClient.get<ClientesV2Response>('/api/clientes-v2').then((d) => {
      setData(d);
      setSelected((prev) => (prev ? d.clients.find((c) => c.id === prev.id) || prev : null));
    }).catch(() => {});

  useEffect(() => { load().finally(() => setLoading(false)); /* eslint-disable-next-line */ }, []);

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!data) return <div className="text-center py-20 text-muted-foreground">No se pudieron cargar los clientes.</div>;
  if (selected) return <ClientDetail c={selected} onBack={() => setSelected(null)} onUpdated={load} />;
  return <ClientesPanel data={data} onSelect={setSelected} />;
}
