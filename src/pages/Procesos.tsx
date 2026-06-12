import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Circle,
  Cpu,
  HardDrive,
  Loader2,
  Play,
  Pause,
  RotateCw,
  RefreshCw,
  ScrollText,
  Search as SearchIcon,
  AlertTriangle,
  X,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

type PM2Status = 'online' | 'stopped' | 'errored' | 'launching' | 'one-launch-status' | 'stopping';
type ProcessAction = 'start' | 'stop' | 'restart';

interface ProcessEntry {
  id: number;
  name: string;
  namespace: string;
  version: string;
  pid: number | null;
  status: PM2Status;
  uptimeMs: number | null;
  restarts: number;
  cpuPct: number;
  memBytes: number;
  user: string;
  mode: string;
  pmOutLog: string | null;
  pmErrorLog: string | null;
  canStop: boolean;
  canRestart: boolean;
  canStart: boolean;
}

const STATUS_META: Record<PM2Status, { label: string; classes: string; dot: string }> = {
  online: { label: 'Online', classes: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600', dot: 'fill-emerald-500' },
  stopped: { label: 'Stopped', classes: 'border-muted-foreground/40 bg-muted text-muted-foreground', dot: 'fill-muted-foreground' },
  errored: { label: 'Errored', classes: 'border-red-500/40 bg-red-500/10 text-red-600', dot: 'fill-red-500' },
  launching: { label: 'Launching', classes: 'border-amber-500/40 bg-amber-500/10 text-amber-600', dot: 'fill-amber-500' },
  'one-launch-status': { label: 'Launch', classes: 'border-amber-500/40 bg-amber-500/10 text-amber-600', dot: 'fill-amber-500' },
  stopping: { label: 'Stopping', classes: 'border-amber-500/40 bg-amber-500/10 text-amber-600', dot: 'fill-amber-500' },
};

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 MB';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatUptime = (ms: number | null) => {
  if (!ms || ms <= 0) return '—';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ${min % 60}m`;
  const d = Math.floor(hr / 24);
  return `${d}d ${hr % 24}h`;
};

// ============ Logs Drawer ============
function LogsDrawer({ processName, onClose }: { processName: string; onClose: () => void }) {
  const { toast } = useToast();
  const [stream, setStream] = useState<'out' | 'err'>('out');
  const [lines, setLines] = useState(200);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const preRef = useRef<HTMLPreElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; lines: string[] }>(
        `/api/processes/${processName}/logs?stream=${stream}&lines=${lines}`
      );
      setLogLines(res.lines || []);
      // Autoscroll al fondo
      setTimeout(() => {
        if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
      }, 50);
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudo cargar el log',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processName, stream, lines]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, processName, stream, lines]);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      {/* Drawer */}
      <div className="w-full max-w-3xl bg-card border-l border-border flex flex-col shadow-2xl animate-slide-in-from-right">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <ScrollText className="h-5 w-5 text-violet-500 flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="font-semibold text-foreground truncate">{processName}</h2>
              <p className="text-xs text-muted-foreground">Últimas {lines} líneas · {stream === 'out' ? 'stdout' : 'stderr'}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-border bg-muted/30">
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setStream('out')}
              className={cn('px-3 py-1.5 text-xs font-medium transition-colors', stream === 'out' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted')}
            >
              stdout
            </button>
            <button
              onClick={() => setStream('err')}
              className={cn('px-3 py-1.5 text-xs font-medium transition-colors border-l border-border', stream === 'err' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted')}
            >
              stderr
            </button>
          </div>

          <select
            value={lines}
            onChange={(e) => setLines(Number(e.target.value))}
            className="h-8 rounded-md border border-border bg-card px-2 text-xs"
          >
            <option value={100}>100 líneas</option>
            <option value={200}>200 líneas</option>
            <option value={500}>500 líneas</option>
            <option value={1000}>1000 líneas</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(autoRefresh && 'border-emerald-500/40 text-emerald-600')}
          >
            <Circle className={cn('h-2 w-2 mr-2', autoRefresh ? 'fill-emerald-500 animate-pulse' : 'fill-muted-foreground')} />
            {autoRefresh ? 'Auto 5s' : 'Pausado'}
          </Button>

          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => {
              if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
            }}
          >
            <ChevronDown className="h-3.5 w-3.5 mr-1" />
            Al final
          </Button>
        </div>

        {/* Log content */}
        <pre
          ref={preRef}
          className="flex-1 overflow-auto bg-[rgb(2,6,23)] text-slate-100 text-[11px] font-mono p-4 leading-relaxed whitespace-pre-wrap break-all"
        >
          {logLines.length === 0
            ? loading
              ? 'Cargando…'
              : '(log vacío)'
            : logLines.join('\n')}
        </pre>
      </div>
    </div>
  );
}

// ============ Pagina principal ============
export default function Procesos() {
  const { toast } = useToast();
  const [processes, setProcesses] = useState<ProcessEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pendingAction, setPendingAction] = useState<{ proc: ProcessEntry; action: ProcessAction } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [logsFor, setLogsFor] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ processes: ProcessEntry[] }>('/api/processes');
      setProcesses(res.processes || []);
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudieron cargar los procesos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Auto-refresh cada 10s mientras la pagina este abierta
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return processes;
    return processes.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.status.toLowerCase().includes(s) ||
        p.namespace.toLowerCase().includes(s)
    );
  }, [processes, search]);

  const counts = useMemo(() => {
    const c = { all: processes.length, online: 0, stopped: 0, errored: 0 };
    processes.forEach((p) => {
      if (p.status === 'online') c.online++;
      else if (p.status === 'errored') c.errored++;
      else c.stopped++;
    });
    return c;
  }, [processes]);

  const performAction = async (proc: ProcessEntry, action: ProcessAction) => {
    setPendingAction(null);
    setBusyId(proc.name);
    try {
      const res = await apiClient.post<{ success: boolean; statusAfter: PM2Status; error?: string }>(
        `/api/processes/${proc.name}/action`,
        { action }
      );
      if (!res.success) throw new Error(res.error || 'Error desconocido');
      toast({
        title: `${action === 'start' ? '▶' : action === 'stop' ? '■' : '↻'} ${proc.name}`,
        description: `Estado: ${res.statusAfter}`,
      });
      await load();
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : `No se pudo ${action} ${proc.name}`,
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10">
          <Activity className="h-6 w-6 text-violet-500" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Procesos</h1>
          <p className="text-muted-foreground">
            Aplicaciones PM2 del VPS. Inicia, detén, reinicia y consulta logs.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          Refrescar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total</div>
          <div className="text-2xl font-bold mt-1">{counts.all}</div>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="text-xs uppercase tracking-wider text-emerald-600">Online</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">{counts.online}</div>
        </div>
        <div className="rounded-xl border border-muted-foreground/20 bg-muted/30 p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Stopped</div>
          <div className="text-2xl font-bold mt-1 text-muted-foreground">{counts.stopped}</div>
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <div className="text-xs uppercase tracking-wider text-red-600">Errored</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{counts.errored}</div>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative max-w-md">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar proceso por nombre o status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabla */}
      {loading && processes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <Activity className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay procesos que coincidan.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Proceso</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">CPU / Mem</th>
                  <th className="px-4 py-3 font-medium">Uptime · Reinicios</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const meta = STATUS_META[p.status] || STATUS_META.stopped;
                  const isBusy = busyId === p.name;
                  return (
                    <tr key={p.name} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-foreground">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground flex gap-2 mt-0.5">
                          <code className="bg-muted/50 px-1 rounded">{p.mode}</code>
                          {p.version && <span>v{p.version}</span>}
                          {p.pid && <span>PID {p.pid}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge variant="outline" className={cn('gap-1.5 text-[10px]', meta.classes)}>
                          <Circle className={cn('h-2 w-2', meta.dot, p.status === 'online' && 'animate-pulse')} />
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Cpu className="h-3 w-3 text-muted-foreground" />
                          <span className="tabular-nums">{p.cpuPct}%</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs mt-0.5">
                          <HardDrive className="h-3 w-3 text-muted-foreground" />
                          <span className="tabular-nums">{formatBytes(p.memBytes)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="text-xs">{formatUptime(p.uptimeMs)}</div>
                        <div className="text-[11px] text-muted-foreground">{p.restarts} reinicio{p.restarts !== 1 ? 's' : ''}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLogsFor(p.name)}
                            disabled={isBusy}
                            title="Ver logs"
                          >
                            <ScrollText className="h-3.5 w-3.5" />
                          </Button>

                          {p.canStart && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => setPendingAction({ proc: p, action: 'start' })}
                              className="text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/10"
                            >
                              {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Play className="h-3.5 w-3.5 mr-1" />Iniciar</>}
                            </Button>
                          )}
                          {p.canRestart && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => setPendingAction({ proc: p, action: 'restart' })}
                              className="text-blue-600 border-blue-500/40 hover:bg-blue-500/10"
                            >
                              {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><RotateCw className="h-3.5 w-3.5 mr-1" />Restart</>}
                            </Button>
                          )}
                          {p.canStop && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => setPendingAction({ proc: p, action: 'stop' })}
                              className="text-red-600 border-red-500/40 hover:bg-red-500/10"
                            >
                              {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Pause className="h-3.5 w-3.5 mr-1" />Detener</>}
                            </Button>
                          )}
                          {p.status === 'online' && !p.canStop && (
                            <span className="text-[10px] text-muted-foreground italic px-2" title="Detener este proceso desde DTOS mataría el backend">
                              protegido
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border bg-muted/20">
            Auto-refresh cada 10s. <strong>dtos-backend</strong> está protegido contra "stop" (puede reiniciarse, pero detenerlo mataría el backend que ejecuta este botón).
          </div>
        </div>
      )}

      {/* Confirmacion */}
      <AlertDialog open={!!pendingAction} onOpenChange={(o) => !o && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.action === 'start'
                ? `¿Iniciar ${pendingAction.proc.name}?`
                : pendingAction?.action === 'stop'
                  ? `¿Detener ${pendingAction.proc.name}?`
                  : `¿Reiniciar ${pendingAction?.proc.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {pendingAction?.action === 'stop' && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-amber-700 text-xs">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div>Detener este proceso lo deja inactivo hasta que lo inicies manualmente o el VPS se reinicie.</div>
                  </div>
                )}
                <div className="text-sm">
                  {pendingAction?.action === 'restart'
                    ? 'El proceso se reinicia con pm2 (pierde estado en memoria pero vuelve en segundos).'
                    : pendingAction?.action === 'stop'
                      ? 'El proceso quedará detenido.'
                      : 'El proceso pasará a estado online.'}
                </div>
                <div className="text-xs text-muted-foreground">PID actual: {pendingAction?.proc.pid ?? '—'} · Reinicios: {pendingAction?.proc.restarts}</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingAction && performAction(pendingAction.proc, pendingAction.action)}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Logs drawer */}
      {logsFor && <LogsDrawer processName={logsFor} onClose={() => setLogsFor(null)} />}
    </div>
  );
}
