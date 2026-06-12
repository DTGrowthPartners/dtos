import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Bot,
  AlertCircle,
  ArrowUpRight,
  Calendar,
  Building2,
  Activity,
  Sparkles,
  ChevronRight,
  Circle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { loadTasks } from '@/lib/firestoreTaskService';
import { TaskStatus, type Task } from '@/types/taskTypes';
import { cn } from '@/lib/utils';

interface CRMDeal {
  id: string;
  name: string;
  value: number;
  stage?: { id: string; name: string; color?: string };
  createdAt?: string;
  organizacion?: { nombre?: string } | null;
}
interface FinanceData {
  totalIncome: number;
  totalExpenses: number;
}
interface FinanceTransaction {
  id?: string;
  fecha: string;
  detalle?: string;
  valor: number;
  tipo: 'ingreso' | 'egreso';
  terceroNombre?: string;
  categoria?: string;
  cuenta?: string;
}
interface AgentStats {
  ok?: boolean;
  bot_id?: string;
  bot_activo?: boolean;
  estado?: { activo?: boolean; modo?: string };
  conversaciones?: { inbound_hoy?: number; outbound_hoy?: number; clientes_unicos_hoy?: number };
  prospectos?: { calificando?: number; agendados?: number };
  citas?: { mes?: number; activas?: number };
  reservas_hoy?: { mesas_ocupadas?: number; mesas_totales?: number; total_personas?: number; evento?: string };
  mensajes_hoy?: { recibidos?: number; enviados?: number };
  pendientes?: number;
  alertas_abiertas?: number;
}
interface AgentInfo {
  id: string;
  name: string;
  configured: boolean;
  stats?: AgentStats;
}

const COP = (n: number): string =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const COPshort = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}MM`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return COP(n);
};

// Saludo según hora local de Colombia
const greeting = (): string => {
  const h = parseInt(new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', hour12: false }), 10);
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

// ========== Componentes auxiliares ==========

function KPICard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  to,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: 'blue' | 'emerald' | 'amber' | 'violet';
  to?: string;
}) {
  const colors = {
    blue: 'text-blue-500 bg-blue-500/10',
    emerald: 'text-emerald-500 bg-emerald-500/10',
    amber: 'text-amber-500 bg-amber-500/10',
    violet: 'text-violet-500 bg-violet-500/10',
  };
  const inner = (
    <div className="group rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md hover:border-primary/40">
      <div className="flex items-center justify-between mb-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', colors[accent])}>
          <Icon className="h-5 w-5" />
        </div>
        {to && (
          <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
      <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1 font-medium">{label}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
  return to ? (
    <Link to={to} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function SectionHeader({
  title,
  subtitle,
  to,
}: {
  title: string;
  subtitle?: string;
  to?: string;
}) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {to && (
        <Link to={to} className="text-xs text-primary hover:underline flex items-center gap-1">
          Ver todo <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

// ========== Página principal ==========

export default function ExecutiveDashboard() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<CRMDeal[]>([]);
  const [finance, setFinance] = useState<FinanceData>({ totalIncome: 0, totalExpenses: 0 });
  const [expensesAll, setExpensesAll] = useState<FinanceTransaction[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);

  const today = new Date();
  const todayFormatted = today.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  });

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Llamadas en paralelo. Cada una con .catch que falla silencioso para
        // que un endpoint roto no tumbe todo el dashboard.
        const [dealsRes, financeRes, expensesRes, tasksRes, agentsList] = await Promise.all([
          isAdmin
            ? apiClient.get<CRMDeal[]>('/api/crm/deals').catch(() => [])
            : Promise.resolve([] as CRMDeal[]),
          isAdmin
            ? apiClient
                .get<FinanceData>('/api/finance/data')
                .catch(() => ({ totalIncome: 0, totalExpenses: 0 }))
            : Promise.resolve({ totalIncome: 0, totalExpenses: 0 }),
          isAdmin
            ? apiClient.get<FinanceTransaction[]>('/api/finance/expense').catch(() => [])
            : Promise.resolve([] as FinanceTransaction[]),
          loadTasks().catch(() => [] as Task[]),
          apiClient
            .get<{ agents: AgentInfo[] }>('/api/agents')
            .then((r) => r.agents || [])
            .catch(() => [] as AgentInfo[]),
        ]);

        setDeals(dealsRes);
        setFinance(financeRes);
        setExpensesAll(expensesRes);
        setTasks(tasksRes);

        // Por cada agente configurado, cargamos sus stats en paralelo
        if (agentsList.length > 0) {
          const withStats = await Promise.all(
            agentsList.map(async (a) => {
              if (!a.configured) return a;
              try {
                const stats = await apiClient.get<AgentStats>(`/api/agents/${a.id}/stats`);
                return { ...a, stats };
              } catch {
                return a;
              }
            })
          );
          setAgents(withStats);
        } else {
          setAgents([]);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [isAdmin]);

  // ============ KPIs derivados ============

  // Pipeline value: suma de deals abiertos (excluye stage que parezca cerrado)
  const pipeline = useMemo(() => {
    const open = deals.filter((d) => {
      const name = (d.stage?.name || '').toLowerCase();
      return !name.includes('ganad') && !name.includes('perdid') && !name.includes('cerrad');
    });
    return {
      count: open.length,
      value: open.reduce((acc, d) => acc + (Number(d.value) || 0), 0),
    };
  }, [deals]);

  // Tareas: si admin ve todas overdue/done del mes; si user ve solo las suyas
  const tasksKPI = useMemo(() => {
    const now = today;
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const userName = user?.firstName || '';
    const visible = isAdmin
      ? tasks
      : tasks.filter((t) => (t.assignee || '').toLowerCase() === userName.toLowerCase());

    const overdue = visible.filter((t) => {
      if (!t.dueDate || t.status === TaskStatus.DONE) return false;
      const due = new Date(t.dueDate);
      return due < now;
    });
    const doneThisMonth = visible.filter((t) => {
      if (t.status !== TaskStatus.DONE) return false;
      if (!t.completedAt) return false;
      return new Date(t.completedAt) >= firstOfMonth;
    });
    return { overdue, doneThisMonth, total: visible.length };
  }, [tasks, isAdmin, user, today]);

  // Citas/alertas de los bots (siempre vienen de Dairo y Cantina si están configurados)
  const botsKPI = useMemo(() => {
    let citas = 0;
    let alertas = 0;
    for (const a of agents) {
      citas += a.stats?.prospectos?.agendados ?? a.stats?.citas?.activas ?? a.stats?.citas?.mes ?? 0;
      alertas += a.stats?.alertas_abiertas ?? a.stats?.pendientes ?? 0;
    }
    return { citas, alertas, online: agents.filter((a) => a.stats?.estado?.activo || a.stats?.bot_activo).length, total: agents.length };
  }, [agents]);

  // Top 5 clientes del mes — agrupamos ingresos por terceroNombre
  const topClientes = useMemo(() => {
    if (!isAdmin) return [];
    const now = today;
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const ingresosMes = expensesAll.filter((e) => {
      if (e.tipo !== 'ingreso') return false;
      const d = new Date(e.fecha);
      return d >= firstOfMonth;
    });
    const sumByClient = new Map<string, number>();
    for (const i of ingresosMes) {
      const k = i.terceroNombre || 'Sin nombre';
      sumByClient.set(k, (sumByClient.get(k) || 0) + (Number(i.valor) || 0));
    }
    return Array.from(sumByClient.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre, total]) => ({ nombre, total }));
  }, [expensesAll, isAdmin, today]);

  // Tareas overdue ordenadas por más vencidas primero (max 5 visibles)
  const overdueList = useMemo(() => {
    return [...tasksKPI.overdue]
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 5);
  }, [tasksKPI.overdue]);

  const userName = user?.firstName || 'Usuario';

  // ============ Render ============

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-20 w-full max-w-md" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {greeting()}, {userName} 👋
          </h1>
          <p className="text-muted-foreground capitalize mt-1">{todayFormatted}</p>
        </div>
        <Link to="/dashboard-classic" className="text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline">
          Ver dashboard clásico
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isAdmin ? (
          <KPICard
            label="Pipeline activo"
            value={COPshort(pipeline.value)}
            hint={`${pipeline.count} deal${pipeline.count !== 1 ? 's' : ''} abiertos`}
            icon={TrendingUp}
            accent="blue"
            to="/crm"
          />
        ) : null}
        {isAdmin ? (
          <KPICard
            label="Ingresos del mes"
            value={COPshort(finance.totalIncome)}
            hint={`Gastos: ${COPshort(finance.totalExpenses)}`}
            icon={DollarSign}
            accent="emerald"
            to="/finanzas"
          />
        ) : null}
        <KPICard
          label={isAdmin ? 'Tareas overdue' : 'Mis tareas overdue'}
          value={String(tasksKPI.overdue.length)}
          hint={`${tasksKPI.doneThisMonth.length} completadas este mes`}
          icon={CheckCircle2}
          accent={tasksKPI.overdue.length > 0 ? 'amber' : 'emerald'}
          to="/tareas"
        />
        <KPICard
          label="Bots WhatsApp"
          value={`${botsKPI.online}/${botsKPI.total}`}
          hint={
            botsKPI.alertas > 0
              ? `${botsKPI.citas} citas · ⚠ ${botsKPI.alertas} alertas`
              : `${botsKPI.citas} citas activas`
          }
          icon={Bot}
          accent={botsKPI.alertas > 0 ? 'amber' : 'violet'}
          to="/agentes"
        />
      </div>

      {/* Row 2: Top clientes + Estado bots */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top clientes del mes */}
        {isAdmin && (
          <section>
            <SectionHeader
              title="Top 5 clientes del mes"
              subtitle="Por ingresos facturados"
              to="/finanzas"
            />
            {topClientes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
                Sin ingresos registrados este mes.
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {topClientes.map((c, i) => (
                  <div
                    key={c.nombre}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3',
                      i > 0 && 'border-t border-border'
                    )}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{c.nombre}</div>
                    </div>
                    <div className="text-sm font-bold tabular-nums">{COPshort(c.total)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Estado de bots WhatsApp */}
        <section>
          <SectionHeader
            title="Bots WhatsApp"
            subtitle="Estado y actividad de hoy"
            to="/agentes"
          />
          {agents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
              No hay bots configurados.
            </div>
          ) : (
            <div className="space-y-2">
              {agents.map((a) => {
                const activo =
                  a.stats?.estado?.activo === true || a.stats?.bot_activo === true;
                const alertCount =
                  Number(a.stats?.alertas_abiertas ?? a.stats?.pendientes ?? 0);
                const summary = (() => {
                  if (a.stats?.conversaciones) {
                    return `${a.stats.conversaciones.inbound_hoy ?? 0} in / ${a.stats.conversaciones.outbound_hoy ?? 0} out hoy`;
                  }
                  if (a.stats?.mensajes_hoy) {
                    return `${a.stats.mensajes_hoy.recibidos ?? 0} in / ${a.stats.mensajes_hoy.enviados ?? 0} out hoy`;
                  }
                  return a.configured ? 'Sin datos' : 'API key no configurada';
                })();
                return (
                  <Link
                    key={a.id}
                    to="/agentes"
                    className="block rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0',
                          activo ? 'bg-emerald-500/10' : 'bg-muted'
                        )}
                      >
                        <Bot
                          className={cn(
                            'h-5 w-5',
                            activo ? 'text-emerald-500' : 'text-muted-foreground'
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-foreground text-sm">{a.name}</h3>
                          <Badge
                            variant="outline"
                            className={cn(
                              'gap-1 text-[10px]',
                              activo
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                                : 'border-muted-foreground/40 bg-muted text-muted-foreground'
                            )}
                          >
                            <Circle
                              className={cn(
                                'h-2 w-2',
                                activo ? 'fill-emerald-500 animate-pulse' : 'fill-muted-foreground'
                              )}
                            />
                            {activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                          {alertCount > 0 && (
                            <Badge variant="outline" className="gap-1 border-red-500/40 bg-red-500/10 text-red-600 text-[10px]">
                              <AlertCircle className="h-3 w-3" />
                              {alertCount}
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{summary}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Row 3: Tareas overdue */}
      <section>
        <SectionHeader
          title={isAdmin ? 'Tareas overdue del equipo' : 'Mis tareas overdue'}
          subtitle={`${tasksKPI.overdue.length} vencidas`}
          to="/tareas"
        />
        {overdueList.length === 0 ? (
          <div className="rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 p-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-emerald-600">¡Sin tareas vencidas!</p>
            <p className="text-xs text-muted-foreground mt-1">Todo al día.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {overdueList.map((t, i) => {
              const due = new Date(t.dueDate!);
              const daysAgo = Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000));
              return (
                <Link
                  key={t.id}
                  to={`/tareas?taskId=${t.id}`}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors',
                    i > 0 && 'border-t border-border'
                  )}
                >
                  <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 flex-shrink-0">
                    <Calendar className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm truncate">{t.title}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>{t.assignee || 'Sin asignar'}</span>
                      <span>·</span>
                      <span className="text-amber-600">
                        Vencida hace {daysAgo} día{daysAgo !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground self-center flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Accesos rápidos */}
      <section>
        <SectionHeader title="Accesos rápidos" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link to="/tareas" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all">
            <Sparkles className="h-5 w-5 text-violet-500" />
            <div>
              <div className="text-sm font-medium">Crear tarea con IA</div>
              <div className="text-[11px] text-muted-foreground">Describe en lenguaje natural</div>
            </div>
          </Link>
          <Link to="/crm" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all">
            <Building2 className="h-5 w-5 text-blue-500" />
            <div>
              <div className="text-sm font-medium">Ventas</div>
              <div className="text-[11px] text-muted-foreground">Pipeline y oportunidades</div>
            </div>
          </Link>
          <Link to="/procesos" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all">
            <Activity className="h-5 w-5 text-violet-500" />
            <div>
              <div className="text-sm font-medium">Procesos</div>
              <div className="text-[11px] text-muted-foreground">PM2 admin del VPS</div>
            </div>
          </Link>
          <Link to="/finanzas" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all">
            <DollarSign className="h-5 w-5 text-emerald-500" />
            <div>
              <div className="text-sm font-medium">Finanzas</div>
              <div className="text-[11px] text-muted-foreground">Ingresos, gastos y presupuestos</div>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
