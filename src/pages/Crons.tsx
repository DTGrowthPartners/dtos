import { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  RefreshCw,
  Search as SearchIcon,
  Terminal,
  ServerCog,
  FolderCog,
  CalendarClock,
  Circle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Tabs, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
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

const SOURCE_META: Record<CronEntry['source'], {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = {
  user: { label: 'Usuario', icon: Terminal, color: 'text-emerald-500 bg-emerald-500/10' },
  'cron.d': { label: 'cron.d', icon: FolderCog, color: 'text-blue-500 bg-blue-500/10' },
  system: { label: 'Sistema', icon: ServerCog, color: 'text-purple-500 bg-purple-500/10' },
  systemd: { label: 'systemd', icon: CalendarClock, color: 'text-orange-500 bg-orange-500/10' },
};

export default function Crons() {
  const { toast } = useToast();
  const [crons, setCrons] = useState<CronEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | CronEntry['source']>('all');

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
    return crons.filter((c) => {
      if (sourceFilter !== 'all' && c.source !== sourceFilter) return false;
      if (!s) return true;
      return (
        c.command.toLowerCase().includes(s) ||
        c.schedule.toLowerCase().includes(s) ||
        c.sourceLabel.toLowerCase().includes(s) ||
        (c.description || '').toLowerCase().includes(s)
      );
    });
  }, [crons, search, sourceFilter]);

  const counts = useMemo(() => {
    const c = { all: crons.length, user: 0, 'cron.d': 0, system: 0, systemd: 0 } as Record<string, number>;
    crons.forEach((x) => { c[x.source] = (c[x.source] || 0) + 1; });
    return c;
  }, [crons]);

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
            Tareas programadas en el VPS: crontab del usuario, /etc/cron.d, /etc/crontab y systemd timers.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          Refrescar
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <Tabs value={sourceFilter} onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}>
          <TabsList>
            <TabsTrigger value="all">Todos ({counts.all})</TabsTrigger>
            <TabsTrigger value="user">Usuario ({counts.user || 0})</TabsTrigger>
            <TabsTrigger value="cron.d">cron.d ({counts['cron.d'] || 0})</TabsTrigger>
            <TabsTrigger value="system">Sistema ({counts.system || 0})</TabsTrigger>
            <TabsTrigger value="systemd">systemd ({counts.systemd || 0})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-md md:ml-auto">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar comando, horario, descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
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
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const meta = SOURCE_META[c.source];
                  const Icon = meta.icon;
                  return (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-start gap-2">
                          <div className={cn('flex h-7 w-7 items-center justify-center rounded-md flex-shrink-0', meta.color)}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-foreground">{meta.label}</div>
                            <div className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={c.sourceLabel}>
                              {c.sourceLabel}
                            </div>
                            {c.user && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                usuario: <code className="text-foreground">{c.user}</code>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="text-foreground text-xs font-medium">{c.scheduleHuman}</div>
                        <code className="text-[10px] text-muted-foreground font-mono block mt-0.5">{c.schedule}</code>
                        {c.nextRun && (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            <span className="text-foreground">Próx:</span> {c.nextRun}
                          </div>
                        )}
                        {c.lastRun && (
                          <div className="text-[10px] text-muted-foreground">
                            <span className="text-foreground">Últ:</span> {c.lastRun}
                          </div>
                        )}
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
                          {c.enabled ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border bg-muted/20">
            Vista de solo lectura. Para editar usa <code>crontab -e</code> en el VPS o los archivos en <code>/etc/cron.d/</code>.
          </div>
        </div>
      )}
    </div>
  );
}
