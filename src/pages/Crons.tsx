import { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  RefreshCw,
  Search as SearchIcon,
  Terminal,
  Circle,
  Pause,
  Play,
  Loader2,
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

interface CronEntry {
  id: string;
  source: 'user' | 'system' | 'cron.d' | 'systemd';
  sourceLabel: string;
  schedule: string;
  scheduleHuman: string;
  command: string;
  user?: string;
  description?: string;
  enabled: boolean;
  nextRun?: string;
  lastRun?: string;
}

export default function Crons() {
  const { toast } = useToast();
  const [crons, setCrons] = useState<CronEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pendingToggle, setPendingToggle] = useState<CronEntry | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ crons: CronEntry[]; count: number }>('/api/crons');
      setCrons(res.crons || []);
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudieron cargar los crons',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return crons;
    return crons.filter(
      (c) =>
        c.command.toLowerCase().includes(s) ||
        c.schedule.toLowerCase().includes(s) ||
        c.sourceLabel.toLowerCase().includes(s) ||
        (c.description || '').toLowerCase().includes(s)
    );
  }, [crons, search]);

  const performToggle = async (cron: CronEntry) => {
    const targetEnable = !cron.enabled;
    setTogglingId(cron.id);
    setPendingToggle(null);
    try {
      const res = await apiClient.post<{ success: boolean; before: string; after: string; error?: string }>(
        '/api/crons/toggle',
        {
          schedule: cron.schedule,
          command: cron.command,
          enable: targetEnable,
        }
      );
      if (!res.success) throw new Error(res.error || 'Error desconocido');
      // Actualizacion optimista
      setCrons((prev) => prev.map((c) => (c.id === cron.id ? { ...c, enabled: targetEnable } : c)));
      toast({
        title: targetEnable ? 'Cron reanudado' : 'Cron pausado',
        description: targetEnable
          ? 'El cron volverá a ejecutarse en su próximo horario.'
          : 'El cron quedó deshabilitado y no se ejecutará hasta que lo reanudes.',
      });
      // Recargar de fondo para confirmar
      load();
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudo cambiar el estado',
        variant: 'destructive',
      });
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10">
          <Clock className="h-6 w-6 text-orange-500" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Crons</h1>
          <p className="text-muted-foreground">
            Tareas programadas del crontab del VPS. Puedes pausarlas o reanudarlas desde aquí.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          Refrescar
        </Button>
      </div>

      {/* Buscador */}
      <div className="relative max-w-md">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar comando, horario, descripción..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <Clock className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay crons que coincidan con el filtro.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Fuente</th>
                  <th className="px-4 py-3 font-medium">Horario</th>
                  <th className="px-4 py-3 font-medium">Comando / Descripción</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const isToggling = togglingId === c.id;
                  return (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-start gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-md flex-shrink-0 text-emerald-500 bg-emerald-500/10">
                            <Terminal className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-foreground">Usuario</div>
                            <div className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={c.sourceLabel}>
                              {c.sourceLabel}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="text-foreground text-xs font-medium">{c.scheduleHuman}</div>
                        <code className="text-[10px] text-muted-foreground font-mono block mt-0.5">{c.schedule}</code>
                      </td>

                      <td className="px-4 py-3 align-top max-w-[500px]">
                        {c.description && (
                          <div className="text-xs text-muted-foreground mb-1 italic">{c.description}</div>
                        )}
                        <code className="text-[11px] text-foreground font-mono break-all">{c.command}</code>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <Badge
                          variant="outline"
                          className={cn(
                            'gap-1.5 text-[10px]',
                            c.enabled
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                              : 'border-muted-foreground/40 bg-muted text-muted-foreground'
                          )}
                        >
                          <Circle className={cn('h-2 w-2', c.enabled ? 'fill-emerald-500' : 'fill-muted-foreground')} />
                          {c.enabled ? 'Activo' : 'Pausado'}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 align-top text-right">
                        <Button
                          variant={c.enabled ? 'outline' : 'default'}
                          size="sm"
                          disabled={isToggling || loading}
                          onClick={() => setPendingToggle(c)}
                          className={cn(c.enabled && 'text-amber-600 border-amber-500/40 hover:bg-amber-500/10')}
                        >
                          {isToggling ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : c.enabled ? (
                            <>
                              <Pause className="h-3.5 w-3.5 mr-1.5" />
                              Pausar
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5 mr-1.5" />
                              Reanudar
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border bg-muted/20">
            Pausar comenta la línea en <code>crontab -l</code> (la prefija con <code>#</code>). Reanudar la des-comenta. Se respalda automáticamente antes de modificar.
          </div>
        </div>
      )}

      {/* Confirmacion */}
      <AlertDialog open={!!pendingToggle} onOpenChange={(o) => !o && setPendingToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingToggle?.enabled ? '¿Pausar este cron?' : '¿Reanudar este cron?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <div>
                  {pendingToggle?.enabled
                    ? 'El cron quedará deshabilitado y no se ejecutará hasta que lo reanudes.'
                    : 'El cron volverá a ejecutarse en su próximo horario programado.'}
                </div>
                {pendingToggle?.description && (
                  <div className="text-xs italic text-muted-foreground">{pendingToggle.description}</div>
                )}
                <code className="block text-[11px] bg-muted p-2 rounded font-mono break-all">
                  {pendingToggle?.schedule} {pendingToggle?.command}
                </code>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingToggle && performToggle(pendingToggle)}>
              {pendingToggle?.enabled ? 'Pausar' : 'Reanudar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
