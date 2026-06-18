import { useEffect, useMemo, useState } from 'react';
import {
  Receipt,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Circle,
  Loader2,
  RotateCcw,
  Search as SearchIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Cobro {
  id: string;
  clientId: string;
  clienteNombre: string;
  periodo: string;
  monto: number;
  moneda: string;
  fechaCobro: string;
  estado: 'pagado' | 'pendiente' | 'vencido';
  paidAt: string | null;
  metodoPago: string | null;
  referencia: string | null;
  nota: string | null;
  registradoPor: string | null;
  servicios: string[];
}

interface ProyectoPuntual {
  clientId: string;
  clienteNombre: string;
  valor: number;
  moneda: string;
  servicios: string[];
}

interface CobrosResponse {
  periodo: string;
  mrrTotal: number;
  cobradoMes: number;
  pendienteMes: number;
  vencidoMes: number;
  // Indicador MRR descompuesto: MRR = clientesRecurrentes × ingresoPromedio
  clientesRecurrentes: number;
  ingresoPromedio: number;
  // Clasificación del portafolio
  proyectosPuntualesCount: number;
  proyectosPuntualesValor: number;
  proyectosPuntuales: ProyectoPuntual[];
  cobros: Cobro[];
}

const COP = (n: number) => '$' + Math.round(n || 0).toLocaleString('en-US');
const COPbig = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return COP(n);
};

const ESTADO_META: Record<Cobro['estado'], { label: string; classes: string; icon: React.ComponentType<{ className?: string }> }> = {
  pagado: { label: 'Pagado', classes: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600', icon: CheckCircle2 },
  pendiente: { label: 'Pendiente', classes: 'border-amber-500/40 bg-amber-500/10 text-amber-600', icon: Clock },
  vencido: { label: 'Vencido', classes: 'border-red-500/40 bg-red-500/10 text-red-600', icon: AlertCircle },
};

// Navegacion de periodo YYYY-MM
const shiftPeriod = (periodo: string, delta: number): string => {
  const [y, m] = periodo.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const periodLabel = (periodo: string): string => {
  const [y, m] = periodo.split('-').map(Number);
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${meses[m - 1]} ${y}`;
};
const currentPeriod = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export default function CobrosMRR() {
  const { toast } = useToast();
  const [period, setPeriod] = useState<string>(currentPeriod());
  const [data, setData] = useState<CobrosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [payTarget, setPayTarget] = useState<Cobro | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // form de registro de pago
  const [metodoPago, setMetodoPago] = useState('');
  const [referencia, setReferencia] = useState('');
  const [nota, setNota] = useState('');

  const load = async (p = period) => {
    setLoading(true);
    try {
      const res = await apiClient.get<CobrosResponse>(`/api/cobros?period=${p}`);
      setData(res);
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudieron cargar los cobros',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const s = search.toLowerCase().trim();
    if (!s) return data.cobros;
    return data.cobros.filter((c) => c.clienteNombre.toLowerCase().includes(s));
  }, [data, search]);

  const openPay = (c: Cobro) => {
    setPayTarget(c);
    setMetodoPago('');
    setReferencia('');
    setNota('');
  };

  const confirmPay = async () => {
    if (!payTarget) return;
    setBusyId(payTarget.id);
    const target = payTarget;
    setPayTarget(null);
    try {
      await apiClient.post(`/api/cobros/${target.id}/pay`, { metodoPago, referencia, nota });
      toast({ title: '✓ Pago registrado', description: `${target.clienteNombre} · ${COP(target.monto)}` });
      await load();
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo registrar', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const revertPay = async (c: Cobro) => {
    setBusyId(c.id);
    try {
      await apiClient.post(`/api/cobros/${c.id}/unpay`, {});
      toast({ title: 'Pago revertido', description: `${c.clienteNombre} vuelve a pendiente` });
      await load();
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo revertir', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
          <Receipt className="h-6 w-6 text-amber-500" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Cobros & MRR</h1>
          <p className="text-muted-foreground">
            Retainers mensuales por cliente. Registro manual de pagos.
          </p>
        </div>
        {/* Navegacion de periodo */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPeriod((p) => shiftPeriod(p, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium px-2 min-w-[120px] text-center capitalize">{periodLabel(period)}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={period >= currentPeriod()}
            onClick={() => setPeriod((p) => shiftPeriod(p, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* MRR grande + stats del mes */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="md:col-span-1 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-5">
          <div className="text-xs uppercase tracking-wider text-amber-600 font-medium">MRR del mes</div>
          <div className="text-3xl font-bold text-foreground tabular-nums mt-1">{COPbig(data?.mrrTotal || 0)}</div>
          {/* Indicador: MRR = N° clientes recurrentes × ingreso promedio (ARPU) */}
          <div className="text-[11px] text-muted-foreground mt-1 tabular-nums">
            {data?.clientesRecurrentes || 0} clientes × {COP(data?.ingresoPromedio || 0)} prom.
          </div>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-emerald-600 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> Cobrado
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums mt-1">{COPbig(data?.cobradoMes || 0)}</div>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-600 font-medium">
            <Clock className="h-3.5 w-3.5" /> Pendiente
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums mt-1">{COPbig(data?.pendienteMes || 0)}</div>
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-red-600 font-medium">
            <AlertCircle className="h-3.5 w-3.5" /> Vencido
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums mt-1">{COPbig(data?.vencidoMes || 0)}</div>
        </div>
      </div>

      {/* Clasificación de clientes: recurrentes (MRR) vs proyectos puntuales */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <RefreshCw className="h-5 w-5 text-amber-500" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Clientes recurrentes (MRR)</div>
            <div className="text-xl font-bold tabular-nums">{data?.clientesRecurrentes || 0}</div>
            <div className="text-[11px] text-muted-foreground">
              Ingreso promedio: {COP(data?.ingresoPromedio || 0)}/mes
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-sky-500/10 flex items-center justify-center flex-shrink-0">
            <Circle className="h-5 w-5 text-sky-500" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Proyectos puntuales (pago único)</div>
            <div className="text-xl font-bold tabular-nums">{data?.proyectosPuntualesCount || 0}</div>
            <div className="text-[11px] text-muted-foreground">
              Valor total: {COP(data?.proyectosPuntualesValor || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Lista de proyectos puntuales (si hay) */}
      {data && data.proyectosPuntuales.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
            Proyectos puntuales
          </div>
          <ul className="divide-y divide-border">
            {data.proyectosPuntuales.map((p) => (
              <li key={p.clientId} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.clienteNombre}</div>
                  {p.servicios.length > 0 && (
                    <div className="text-[11px] text-muted-foreground truncate" title={p.servicios.join(', ')}>
                      {p.servicios.join(' · ')}
                    </div>
                  )}
                </div>
                <div className="font-bold tabular-nums text-sm flex-shrink-0">{COP(p.valor)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Buscador */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Clientes recurrentes · retainers
        </h2>
        <div className="relative max-w-md w-full sm:w-auto">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Tabla */}
      {loading && !data ? (
        <div className="text-center py-12 text-muted-foreground">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <Receipt className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {search ? 'Ningún cliente coincide.' : 'No hay cobros para este periodo. Se generan de los servicios activos de cada cliente.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Retainer</th>
                  <th className="px-4 py-3 font-medium">Fecha cobro</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const meta = ESTADO_META[c.estado];
                  const Icon = meta.icon;
                  const isBusy = busyId === c.id;
                  return (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-foreground">{c.clienteNombre}</div>
                        {c.servicios.length > 0 && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-[260px]" title={c.servicios.join(', ')}>
                            {c.servicios.join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-bold tabular-nums">{COP(c.monto)}</div>
                        <div className="text-[11px] text-muted-foreground">{c.moneda}/mes</div>
                      </td>
                      <td className="px-4 py-3 align-top text-xs">
                        {new Date(c.fechaCobro).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'UTC' })}
                        {c.paidAt && (
                          <div className="text-[11px] text-emerald-600 mt-0.5">
                            Pagado {new Date(c.paidAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                          </div>
                        )}
                        {c.registradoPor && c.estado === 'pagado' && (
                          <div className="text-[10px] text-muted-foreground">por {c.registradoPor}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge variant="outline" className={cn('gap-1.5 text-[10px]', meta.classes)}>
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        {c.estado === 'pagado' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => revertPay(c)}
                            className="text-muted-foreground hover:text-foreground"
                            title="Revertir pago"
                          >
                            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><RotateCcw className="h-3.5 w-3.5 mr-1" />Revertir</>}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => openPay(c)}
                            className="text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/10"
                          >
                            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Registrar pago</>}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border bg-muted/20">
            Los cobros se generan automáticamente de los servicios activos de cada cliente. Sin integración bancaria — el pago se registra manualmente.
          </div>
        </div>
      )}

      {/* Dialog registrar pago */}
      <Dialog open={!!payTarget} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>
              {payTarget && (
                <span>
                  {payTarget.clienteNombre} · <strong>{COP(payTarget.monto)} {payTarget.moneda}</strong> · {periodLabel(period)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Método de pago (opcional)</label>
              <Input placeholder="Transferencia, Nequi, efectivo..." value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Referencia (opcional)</label>
              <Input placeholder="# comprobante / transacción" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nota (opcional)</label>
              <Textarea placeholder="Observaciones..." value={nota} onChange={(e) => setNota(e.target.value)} className="min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayTarget(null)}>Cancelar</Button>
            <Button onClick={confirmPay} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirmar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
