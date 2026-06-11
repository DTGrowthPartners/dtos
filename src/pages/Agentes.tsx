import { useEffect, useState, useCallback } from 'react';
import {
  Bot,
  Circle,
  RefreshCw,
  AlertTriangle,
  MessageCircle,
  Users,
  CalendarCheck,
  AlertOctagon,
  Activity,
  Send,
  Power,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AgentMeta {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  whatsappNumber?: string;
  configured: boolean;
}

// El bot externo devuelve { ok, estado: { activo, modo, ... }, trafico_24h: { inbound, outbound } }
interface AgentEstado {
  ok?: boolean;
  estado?: {
    activo?: boolean;
    modo?: string;
    pausado_por?: string | null;
    pausado_en?: string | null;
    razon?: string | null;
    actualizado_en?: string;
  };
  trafico_24h?: { inbound?: number; outbound?: number };
}

interface AgentStats {
  ok?: boolean;
  estado?: AgentEstado['estado'];
  conversaciones?: {
    inbound_hoy?: number;
    outbound_hoy?: number;
    inbound_mes?: number;
    outbound_mes?: number;
    clientes_unicos_hoy?: number;
    clientes_unicos_mes?: number;
  };
  prospectos?: {
    nuevos?: number;
    calificando?: number;
    agendados?: number;
    no_fit?: number;
    clientes?: number;
    total?: number;
  };
  citas?: {
    activas?: number;
    completadas?: number;
    canceladas?: number;
    hoy?: number;
    mes?: number;
    total?: number;
  };
  claude_hoy?: {
    tokens_input?: number;
    tokens_output?: number;
    cache_read?: number;
    cache_write?: number;
  };
  alertas_abiertas?: number;
}

const MODOS: { value: string; label: string }[] = [
  { value: 'todos', label: 'Todos los chats' },
  { value: 'solo_prospectos', label: 'Solo prospectos' },
  { value: 'solo_clientes', label: 'Solo clientes' },
  { value: 'pausado', label: 'Pausado' },
];

function StatBox({ label, value, icon: Icon, accent }: {
  label: string;
  value: string | number | undefined;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'success' | 'warning' | 'destructive' | 'primary';
}) {
  const colors = {
    success: 'text-emerald-500 bg-emerald-500/10',
    warning: 'text-amber-500 bg-amber-500/10',
    destructive: 'text-red-500 bg-red-500/10',
    primary: 'text-primary bg-primary/10',
  };
  const cls = colors[accent || 'primary'];
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2 mb-1">
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-md', cls)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      </div>
      <div className="text-xl font-bold text-foreground tabular-nums">
        {value ?? '—'}
      </div>
    </div>
  );
}

function AgentCard({ agent, onChanged }: { agent: AgentMeta; onChanged: () => void }) {
  const { toast } = useToast();
  const [estado, setEstado] = useState<AgentEstado | null>(null);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modoLocal, setModoLocal] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [e, s] = await Promise.all([
        apiClient.get<AgentEstado>(`/api/agents/${agent.id}/estado`).catch((err) => { throw err; }),
        apiClient.get<AgentStats>(`/api/agents/${agent.id}/stats`).catch(() => null),
      ]);
      setEstado(e);
      setStats(s);
      const m = e?.estado?.modo ?? s?.estado?.modo;
      if (m) setModoLocal(String(m));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar con el agente');
    } finally {
      setLoading(false);
    }
  }, [agent.id]);

  useEffect(() => {
    if (agent.configured) load();
    else setLoading(false);
  }, [agent.configured, load]);

  const toggleActivo = async (next: boolean) => {
    setBusy(true);
    try {
      await apiClient.post(`/api/agents/${agent.id}/estado`, {
        activo: next,
        razon: next ? 'Activado desde panel DTOS' : 'Pausado desde panel DTOS',
      });
      toast({
        title: next ? 'Agente activado' : 'Agente pausado',
        description: `${agent.name} ${next ? 'recibiendo mensajes' : 'no procesará mensajes'}.`,
      });
      await load();
      onChanged();
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudo cambiar el estado',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const currentEstado = estado?.estado || stats?.estado;
  const currentModo = currentEstado?.modo;

  const cambiarModo = async (newModo: string) => {
    if (newModo === currentModo) return;
    setBusy(true);
    setModoLocal(newModo);
    try {
      await apiClient.post(`/api/agents/${agent.id}/estado`, {
        modo: newModo,
        razon: `Cambio de modo desde panel DTOS`,
      });
      toast({ title: 'Modo actualizado', description: `Ahora: ${newModo}` });
      await load();
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudo cambiar el modo',
        variant: 'destructive',
      });
      setModoLocal(currentModo ? String(currentModo) : '');
    } finally {
      setBusy(false);
    }
  };

  const activo = currentEstado?.activo === true;
  const alertas = Number(stats?.alertas_abiertas ?? 0);
  const tieneAlertas = alertas > 0;

  // ====== UI: estado/error/loading ======
  if (!agent.configured) {
    return (
      <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{agent.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {agent.description}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
              API key no configurada en el backend. Setea <code className="bg-amber-500/20 px-1 rounded">AGENT_{agent.id.toUpperCase()}_API_KEY</code> en <code className="bg-amber-500/20 px-1 rounded">.env</code> y reinicia <code className="bg-amber-500/20 px-1 rounded">dtos-backend</code>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header con estado */}
      <div className="p-5 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className={cn(
              'flex h-11 w-11 items-center justify-center rounded-lg flex-shrink-0',
              activo ? 'bg-emerald-500/10' : 'bg-muted'
            )}>
              <Bot className={cn('h-6 w-6', activo ? 'text-emerald-500' : 'text-muted-foreground')} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground truncate">{agent.name}</h3>
                {!loading && !error && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'gap-1.5 text-[10px]',
                      activo
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                        : 'border-muted-foreground/40 bg-muted text-muted-foreground'
                    )}
                  >
                    <Circle className={cn('h-2 w-2', activo ? 'fill-emerald-500 text-emerald-500 animate-pulse' : 'fill-muted-foreground text-muted-foreground')} />
                    {activo ? 'Activo' : 'Pausado'}
                  </Badge>
                )}
                {tieneAlertas && (
                  <Badge variant="outline" className="gap-1 border-red-500/40 bg-red-500/10 text-red-600 text-[10px]">
                    <AlertOctagon className="h-3 w-3" />
                    {alertas} alerta{alertas > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">{agent.description}</p>
              <a
                href={agent.baseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-muted-foreground hover:text-primary inline-block mt-1"
              >
                {agent.baseUrl.replace(/^https?:\/\//, '')}
              </a>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="flex-shrink-0">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>

        {/* Controles */}
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <Button
            onClick={() => toggleActivo(!activo)}
            disabled={busy || loading || !!error}
            variant={activo ? 'outline' : 'default'}
            size="sm"
            className={cn(activo && 'text-red-600 border-red-500/40 hover:bg-red-500/10')}
          >
            <Power className="h-4 w-4 mr-2" />
            {activo ? 'Pausar' : 'Activar'}
          </Button>

          <Select value={modoLocal} onValueChange={cambiarModo} disabled={busy || loading || !!error}>
            <SelectTrigger className="h-9 max-w-[220px]">
              <SelectValue placeholder="Cambiar modo…" />
            </SelectTrigger>
            <SelectContent>
              {MODOS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
              {/* Si el agente reporta un modo que no está en MODOS, lo agregamos como opción */}
              {currentModo && !MODOS.some((m) => m.value === currentModo) && (
                <SelectItem value={String(currentModo)}>{String(currentModo)}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">No se pudo conectar con el agente</p>
              <p className="text-xs mt-0.5 opacity-80">{error}</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-sm text-muted-foreground text-center py-6">Cargando estado…</div>
        )}

        {!loading && !error && stats && (
          <div className="space-y-4">
            {/* Conversaciones hoy */}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Hoy</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <StatBox label="In" value={stats.conversaciones?.inbound_hoy} icon={MessageCircle} accent="primary" />
                <StatBox label="Out" value={stats.conversaciones?.outbound_hoy} icon={Send} accent="success" />
                <StatBox label="Clientes" value={stats.conversaciones?.clientes_unicos_hoy} icon={Users} accent="primary" />
              </div>
            </div>

            {/* Conversaciones mes */}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Mes</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <StatBox label="In" value={stats.conversaciones?.inbound_mes} icon={MessageCircle} accent="primary" />
                <StatBox label="Clientes" value={stats.conversaciones?.clientes_unicos_mes} icon={Users} accent="primary" />
                <StatBox label="Citas" value={stats.citas?.mes} icon={CalendarCheck} accent="success" />
              </div>
            </div>

            {/* Prospectos */}
            {stats.prospectos && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Prospectos</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <StatBox label="Calificando" value={stats.prospectos.calificando} icon={Activity} accent="warning" />
                  <StatBox label="Agendados" value={stats.prospectos.agendados} icon={CalendarCheck} accent="success" />
                  <StatBox label="Total" value={stats.prospectos.total} icon={Users} accent="primary" />
                </div>
              </div>
            )}

            {/* Claude tokens */}
            {stats.claude_hoy && (
              <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t border-border/50">
                {typeof stats.claude_hoy.tokens_input === 'number' && (
                  <span>Tokens in: <strong className="text-foreground">{stats.claude_hoy.tokens_input.toLocaleString('es-CO')}</strong></span>
                )}
                {typeof stats.claude_hoy.tokens_output === 'number' && (
                  <span>Tokens out: <strong className="text-foreground">{stats.claude_hoy.tokens_output.toLocaleString('es-CO')}</strong></span>
                )}
                {typeof stats.claude_hoy.cache_read === 'number' && (
                  <span>Cache read: <strong className="text-foreground">{stats.claude_hoy.cache_read.toLocaleString('es-CO')}</strong></span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Agentes() {
  const [agents, setAgents] = useState<AgentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<{ agents: AgentMeta[] }>('/api/agents');
        setAgents(res.agents || []);
      } catch (e) {
        toast({
          title: 'Error',
          description: e instanceof Error ? e.message : 'No se pudo cargar la lista de agentes',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toast]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
          <Bot className="h-6 w-6 text-emerald-500" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Agentes</h1>
          <p className="text-muted-foreground">
            Agentes conversacionales de WhatsApp. Activa/pausa, cambia modo y consulta métricas.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refrescar todos
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando…</div>
      ) : agents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <Bot className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No hay agentes configurados.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {agents.map((a) => (
            <AgentCard key={`${a.id}-${reloadKey}`} agent={a} onChanged={() => setReloadKey((k) => k + 1)} />
          ))}
        </div>
      )}
    </div>
  );
}
