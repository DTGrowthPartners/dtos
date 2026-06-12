import { useEffect, useState } from 'react';
import {
  Server,
  Cpu,
  HardDrive,
  MemoryStick,
  Activity,
  RefreshCw,
  Network,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

interface VpsHealth {
  hostname: string;
  platform: string;
  uptimeSec: number;
  loadAvg: [number, number, number];
  cpu: { model: string; cores: number; usagePct: number };
  memory: { totalBytes: number; usedBytes: number; availableBytes: number; usagePct: number };
  disks: { mount: string; filesystem: string; sizeBytes: number; usedBytes: number; availableBytes: number; usagePct: number }[];
  network: { ifaces: { name: string; ipv4?: string; ipv6?: string }[] };
  topProcesses: { pid: number; user: string; cpuPct: number; memPct: number; command: string }[];
  ts: string;
}

const formatBytes = (b: number): string => {
  if (b >= 1e12) return `${(b / 1e12).toFixed(2)} TB`;
  if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(0)} kB`;
  return `${b} B`;
};

const formatUptime = (sec: number): string => {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

function ProgressColored({ value }: { value: number }) {
  const color =
    value > 90 ? 'bg-red-500' : value > 75 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all', color)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function StatRow({
  label,
  icon: Icon,
  value,
  hint,
  pct,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  hint?: string;
  pct?: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
          <div className="text-2xl font-bold text-foreground tabular-nums truncate">{value}</div>
        </div>
        {typeof pct === 'number' && (
          <div className="text-xs font-medium text-foreground tabular-nums">{pct}%</div>
        )}
      </div>
      {typeof pct === 'number' && <ProgressColored value={pct} />}
      {hint && <div className="text-[11px] text-muted-foreground mt-2">{hint}</div>}
    </div>
  );
}

export default function Vps() {
  const { toast } = useToast();
  const [data, setData] = useState<VpsHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<VpsHealth>('/api/vps/health');
      setData(res);
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudo leer el estado del VPS',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10">
          <Server className="h-6 w-6 text-sky-500" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">VPS Health</h1>
          <p className="text-muted-foreground">
            Recursos del servidor en tiempo real.{' '}
            {data && (
              <>
                <span className="font-mono">{data.hostname}</span> · {data.platform}
              </>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={cn(autoRefresh && 'border-emerald-500/40 text-emerald-600')}
        >
          <Activity className={cn('h-4 w-4 mr-2', autoRefresh && 'animate-pulse')} />
          {autoRefresh ? 'Auto 10s' : 'Pausado'}
        </Button>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {data ? (
        <>
          {/* Cards principales */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatRow
              label="CPU"
              icon={Cpu}
              value={`${data.cpu.usagePct}%`}
              hint={`${data.cpu.cores} cores · ${data.cpu.model.split('@')[0].trim()}`}
              pct={data.cpu.usagePct}
            />
            <StatRow
              label="Memoria"
              icon={MemoryStick}
              value={`${formatBytes(data.memory.usedBytes)} / ${formatBytes(data.memory.totalBytes)}`}
              hint={`${formatBytes(data.memory.availableBytes)} disponible`}
              pct={data.memory.usagePct}
            />
            <StatRow
              label="Uptime"
              icon={Clock}
              value={formatUptime(data.uptimeSec)}
              hint={`Load avg: ${data.loadAvg.map((v) => v.toFixed(2)).join(' / ')}`}
            />
            <StatRow
              label="Red"
              icon={Network}
              value={data.network.ifaces[0]?.ipv4 || '—'}
              hint={
                data.network.ifaces[0]?.name
                  ? `interfaz: ${data.network.ifaces[0].name}`
                  : undefined
              }
            />
          </div>

          {/* Disks */}
          <section>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
              Discos ({data.disks.length})
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {data.disks.map((d) => (
                <div key={d.mount} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <HardDrive className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <code className="text-sm font-mono text-foreground">{d.mount}</code>
                      <div className="text-[11px] text-muted-foreground truncate">{d.filesystem}</div>
                    </div>
                    <div className="text-sm font-bold tabular-nums">{d.usagePct}%</div>
                  </div>
                  <ProgressColored value={d.usagePct} />
                  <div className="text-[11px] text-muted-foreground mt-2 flex justify-between">
                    <span>
                      Usado: <strong className="text-foreground">{formatBytes(d.usedBytes)}</strong>
                    </span>
                    <span>
                      Libre: <strong className="text-foreground">{formatBytes(d.availableBytes)}</strong>
                    </span>
                    <span>
                      Total: <strong className="text-foreground">{formatBytes(d.sizeBytes)}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Top procesos del sistema */}
          <section>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
              Top procesos por CPU
            </h2>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">PID</th>
                    <th className="px-4 py-2 font-medium">Usuario</th>
                    <th className="px-4 py-2 font-medium">Comando</th>
                    <th className="px-4 py-2 font-medium text-right">CPU</th>
                    <th className="px-4 py-2 font-medium text-right">Mem</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProcesses.map((p) => (
                    <tr key={p.pid} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2 font-mono text-xs">{p.pid}</td>
                      <td className="px-4 py-2 text-xs">{p.user}</td>
                      <td className="px-4 py-2 text-xs truncate max-w-[280px]" title={p.command}>
                        {p.command}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-xs">{p.cpuPct.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right tabular-nums text-xs">{p.memPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="text-[11px] text-muted-foreground text-right">
            Última actualización: {new Date(data.ts).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota' })}
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">Cargando…</div>
      )}
    </div>
  );
}
