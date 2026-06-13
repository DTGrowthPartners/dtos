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
  BarChart3,
  Users,
  Target,
  CheckSquare,
  Clock,
  Briefcase,
  Wallet,
  Eye,
  EyeOff,
  UserCheck,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { loadTasks } from '@/lib/firestoreTaskService';
import { TaskStatus, type Task } from '@/types/taskTypes';
import { useAiTaskStore } from '@/lib/aiTaskStore';
import { cn } from '@/lib/utils';

// ========== Types ==========

interface CRMDeal {
  id: string;
  name: string;
  value: number;
  stage?: { id: string; name: string; color?: string };
}
interface FinanceTransactionFull {
  fecha: string;
  importe: number;
  categoria?: string;
  terceroNombre?: string;
}
interface MonthPoint {
  month: string;
  income: number;
  expenses: number;
}
interface FinanceData {
  totalIncome: number;
  totalExpenses: number;
  ingresos?: FinanceTransactionFull[];
  gastos?: FinanceTransactionFull[];
  financeByMonth?: MonthPoint[];
}
interface CuentaDisponible {
  cuenta: string;
  saldo: number;
}
interface DisponibleResponse {
  cuentas: CuentaDisponible[];
  totalDisponible: number;
}
interface ServiceRevenueMetrics {
  totalMRR: number;
  totalARR?: number;
  activeServicesCount?: number;
  clientsWithServices: number;
}
interface ClientItem {
  id: string;
  name: string;
  status: string;
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

// ========== Formatters ==========

const COP = (n: number): string =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

const COPshort = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}MM`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return COP(n);
};

const COPfull = (n: number): string =>
  '$' + Math.round(n || 0).toLocaleString('en-US');

const formatMoney = (n: number, hidden: boolean): string => (hidden ? '••••••' : COPfull(n));

// Saludo según hora local de Colombia
const greeting = (): string => {
  const h = parseInt(
    new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', hour12: false }),
    10
  );
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

const monthName = (m: number): string =>
  ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][m] || '';

// Banco de frases motivacionales. Rota cada 6 horas de forma deterministica
// (misma frase para todos dentro de la misma ventana de 6h).
const MOTIVATIONAL_PHRASES = [
  'El primer paso para recibir ayuda es pedirla.',
  'Hecho es mejor que perfecto.',
  'Lo que no se mide, no se mejora.',
  'La disciplina vence al talento cuando el talento no tiene disciplina.',
  'Cada cliente feliz es el mejor vendedor que tienes.',
  'No cuentes los días, haz que los días cuenten.',
  'La constancia construye lo que la motivación empieza.',
  'Vender es ayudar a alguien a tomar una buena decisión.',
  'Un equipo alineado mueve montañas; uno disperso, ni una piedra.',
  'El dinero llega cuando resuelves problemas reales.',
  'Hoy es un buen día para cerrar lo que quedó pendiente ayer.',
  'La calidad no es un acto, es un hábito.',
  'Pequeñas mejoras diarias generan resultados extraordinarios.',
  'El mejor momento para hacer seguimiento fue ayer; el segundo mejor es ahora.',
  'Enfócate en lo importante antes de que se vuelva urgente.',
  'Tu marca es lo que dicen de ti cuando no estás en la sala.',
  'No hay clientes pequeños, hay relaciones que apenas empiezan.',
  'La claridad atrae; la confusión repele.',
  'Si quieres ir rápido ve solo, si quieres llegar lejos ve acompañado.',
  'El seguimiento es donde se gana la venta.',
];

const motivationalPhrase = (): string => {
  const bucket = Math.floor(Date.now() / (6 * 60 * 60 * 1000));
  return MOTIVATIONAL_PHRASES[bucket % MOTIVATIONAL_PHRASES.length];
};

// ========== Componentes auxiliares ==========

type Variant = 'success' | 'warning' | 'primary' | 'destructive' | 'default';

const variantColors: Record<Variant, string> = {
  success: 'text-emerald-500 bg-emerald-500/10',
  warning: 'text-amber-500 bg-amber-500/10',
  primary: 'text-blue-500 bg-blue-500/10',
  destructive: 'text-red-500 bg-red-500/10',
  default: 'text-slate-500 bg-slate-500/10',
};

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  to,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: Variant;
  to?: string;
}) {
  const inner = (
    <div className="group rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md hover:border-primary/40 h-full">
      <div className="flex items-start justify-between mb-3">
        <div className="text-xs text-muted-foreground font-medium">{title}</div>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0', variantColors[variant])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-xl font-bold text-foreground tabular-nums leading-tight break-words">{value}</div>
      {subtitle && <div className="text-[11px] text-muted-foreground mt-1">{subtitle}</div>}
      {to && (
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute top-3 right-12" />
      )}
    </div>
  );
  return to ? (
    <Link to={to} className="block h-full">
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
  title: React.ReactNode;
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
  const openAiTask = useAiTaskStore((s) => s.openPrompt);

  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<CRMDeal[]>([]);
  const [financeData, setFinanceData] = useState<FinanceData>({ totalIncome: 0, totalExpenses: 0 });
  const [disponible, setDisponible] = useState<CuentaDisponible[]>([]);
  const [totalDisponible, setTotalDisponible] = useState(0);
  const [services, setServices] = useState<ServiceRevenueMetrics>({ totalMRR: 0, clientsWithServices: 0 });
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);

  const [hideFinances, setHideFinances] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dashboard:hideFinances') === '1';
    } catch {
      return false;
    }
  });
  const [showAccounts, setShowAccounts] = useState(true);

  const today = new Date();
  const todayFormatted = today.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  });
  const currentMonthName = monthName(today.getMonth());

  const toggleHide = () => {
    setHideFinances((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('dashboard:hideFinances', next ? '1' : '0');
      } catch {
        /* noop */
      }
      return next;
    });
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Llamadas paralelas. Cada una con catch silencioso para que un endpoint
        // caido no tumbe el dashboard completo.
        const [
          dealsRes,
          financeRes,
          disponibleRes,
          servicesRes,
          clientsRes,
          tasksRes,
          agentsList,
        ] = await Promise.all([
          isAdmin
            ? apiClient.get<CRMDeal[]>('/api/crm/deals').catch(() => [])
            : Promise.resolve([] as CRMDeal[]),
          isAdmin
            ? apiClient.get<FinanceData>('/api/finance/data').catch(() => ({
                totalIncome: 0,
                totalExpenses: 0,
                ingresos: [],
                gastos: [],
              }))
            : Promise.resolve({ totalIncome: 0, totalExpenses: 0, ingresos: [], gastos: [] } as FinanceData),
          isAdmin
            ? apiClient
                .get<DisponibleResponse>('/api/finance/disponible')
                .catch(() => ({ cuentas: [], totalDisponible: 0 }))
            : Promise.resolve({ cuentas: [], totalDisponible: 0 } as DisponibleResponse),
          isAdmin
            ? apiClient
                .get<ServiceRevenueMetrics>('/api/services/metrics/revenue')
                .catch(() => ({ totalMRR: 0, clientsWithServices: 0 }))
            : Promise.resolve({ totalMRR: 0, clientsWithServices: 0 } as ServiceRevenueMetrics),
          apiClient.get<ClientItem[]>('/api/clients').catch(() => [] as ClientItem[]),
          loadTasks().catch(() => [] as Task[]),
          apiClient
            .get<{ agents: AgentInfo[] }>('/api/agents')
            .then((r) => r.agents || [])
            .catch(() => [] as AgentInfo[]),
        ]);

        setDeals(dealsRes);
        setFinanceData(financeRes);
        setDisponible(disponibleRes.cuentas || []);
        setTotalDisponible(disponibleRes.totalDisponible || 0);
        setServices(servicesRes);
        setClients(clientsRes);
        setTasks(tasksRes);

        // Por cada agente configurado, cargamos stats en paralelo
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

  // ============ KPIs derivados (mismas reglas que el dashboard clásico) ============

  // Ingresos / Gastos del mes actual filtrando AJUSTE SALDO
  const monthly = useMemo(() => {
    const prefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const ingMes = (financeData.ingresos || []).filter(
      (t) => t.fecha?.startsWith(prefix) && t.categoria !== 'AJUSTE SALDO'
    );
    const gasMes = (financeData.gastos || []).filter(
      (t) => t.fecha?.startsWith(prefix) && t.categoria !== 'AJUSTE SALDO'
    );
    const income = ingMes.reduce((acc, t) => acc + (t.importe || 0), 0);
    const expenses = gasMes.reduce((acc, t) => acc + (t.importe || 0), 0);
    return { income, expenses, profit: income - expenses };
  }, [financeData, today]);

  // Pipeline value y count (suma deals abiertos)
  const pipeline = useMemo(() => {
    const open = deals.filter((d) => {
      const name = (d.stage?.name || '').toLowerCase();
      return !name.includes('ganad') && !name.includes('perdid') && !name.includes('cerrad');
    });
    return {
      count: open.length,
      value: open.reduce((acc, d) => acc + (Number(d.value) || 0), 0),
      total: deals.length,
    };
  }, [deals]);

  // Tareas: stats globales para admin, personales para todos
  const tasksKPI = useMemo(() => {
    const userName = user?.firstName || '';
    const mine = tasks.filter((t) => (t.assignee || '').toLowerCase() === userName.toLowerCase());
    const myDone = mine.filter((t) => t.status === TaskStatus.DONE).length;
    const myTotal = mine.length;
    const productivity = myTotal > 0 ? Math.round((myDone / myTotal) * 100) : 0;

    const teamPending = tasks.filter((t) => t.status !== TaskStatus.DONE).length;
    const teamInProgress = tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
    const teamDone = tasks.filter((t) => t.status === TaskStatus.DONE).length;

    const visibleForOverdue = isAdmin ? tasks : mine;
    const now = today;
    const overdue = visibleForOverdue.filter((t) => {
      if (!t.dueDate || t.status === TaskStatus.DONE) return false;
      return new Date(t.dueDate) < now;
    });

    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const doneThisMonth = visibleForOverdue.filter((t) => {
      if (t.status !== TaskStatus.DONE) return false;
      if (!t.completedAt) return false;
      return new Date(t.completedAt) >= firstOfMonth;
    });

    return {
      mine,
      myDone,
      myTotal,
      productivity,
      teamPending,
      teamInProgress,
      teamDone,
      overdue,
      doneThisMonth,
    };
  }, [tasks, isAdmin, user, today]);

  // Clients
  const clientsKPI = useMemo(() => {
    const active = clients.filter((c) => c.status === 'active').length;
    return { active, total: clients.length };
  }, [clients]);

  // Citas/alertas de los bots
  const botsKPI = useMemo(() => {
    let citas = 0;
    let alertas = 0;
    for (const a of agents) {
      citas += a.stats?.prospectos?.agendados ?? a.stats?.citas?.activas ?? a.stats?.citas?.mes ?? 0;
      alertas += a.stats?.alertas_abiertas ?? a.stats?.pendientes ?? 0;
    }
    return {
      citas,
      alertas,
      online: agents.filter((a) => a.stats?.estado?.activo || a.stats?.bot_activo).length,
      total: agents.length,
    };
  }, [agents]);

  // Top 5 clientes del mes (de finance.expense pero ya viene aquí en financeData.ingresos)
  const topClientes = useMemo(() => {
    if (!isAdmin) return [];
    const prefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const ingMes = (financeData.ingresos || []).filter(
      (t) => t.fecha?.startsWith(prefix) && t.categoria !== 'AJUSTE SALDO' && t.terceroNombre
    );
    const sumByClient = new Map<string, number>();
    for (const i of ingMes) {
      const k = i.terceroNombre || 'Sin nombre';
      sumByClient.set(k, (sumByClient.get(k) || 0) + (Number(i.importe) || 0));
    }
    return Array.from(sumByClient.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre, total]) => ({ nombre, total }));
  }, [financeData, isAdmin, today]);

  // Carga de trabajo por miembro del equipo (top 6, agrupado por status)
  const teamWorkload = useMemo(() => {
    const map = new Map<string, { pending: number; inProgress: number; completed: number }>();
    tasks.forEach((t) => {
      if (!t.assignee) return;
      const cur = map.get(t.assignee) || { pending: 0, inProgress: 0, completed: 0 };
      if (t.status === TaskStatus.DONE) cur.completed++;
      else if (t.status === TaskStatus.IN_PROGRESS) cur.inProgress++;
      else cur.pending++;
      map.set(t.assignee, cur);
    });
    return Array.from(map.entries())
      .map(([name, d]) => ({
        name,
        pending: d.pending,
        inProgress: d.inProgress,
        completed: d.completed,
        total: d.pending + d.inProgress + d.completed,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [tasks]);

  // Tendencia de ingresos/gastos: el backend ya devuelve financeByMonth
  // pre-agregado y correcto (ultimos 6 meses, en orden cronologico).
  const incomeByMonth = useMemo<MonthPoint[]>(() => {
    return financeData.financeByMonth || [];
  }, [financeData]);

  // Tareas overdue ordenadas
  const overdueList = useMemo(() => {
    return [...tasksKPI.overdue]
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 5);
  }, [tasksKPI.overdue]);

  const userName = user?.firstName || 'Usuario';
  const productivityVariant: Variant =
    tasksKPI.productivity >= 70 ? 'success' : tasksKPI.productivity >= 40 ? 'warning' : 'default';
  const profitVariant: Variant = monthly.profit >= 0 ? 'success' : 'destructive';

  // ============ Render ============

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-20 w-full max-w-md" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Greeting + toggle ocultar/mostrar */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {greeting()}, {userName} 👋
          </h1>
          <p className="text-muted-foreground capitalize mt-1">{todayFormatted}</p>
          <p className="text-sm text-primary/90 italic mt-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
            “{motivationalPhrase()}”
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleHide}
              className="gap-2 text-muted-foreground hover:text-foreground"
              title={hideFinances ? 'Mostrar valores' : 'Ocultar valores'}
            >
              {hideFinances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="hidden sm:inline">{hideFinances ? 'Mostrar' : 'Ocultar'}</span>
            </Button>
          )}
          <Link to="/" className="text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline">
            ← Volver al dashboard clásico
          </Link>
        </div>
      </div>

      {/* ============ ADMIN: Grid de 10 KPIs (igual al clásico) ============ */}
      {isAdmin && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <StatCard
            title={`Ingresos ${currentMonthName}`}
            value={formatMoney(monthly.income, hideFinances)}
            icon={DollarSign}
            variant="success"
            to="/finanzas"
          />
          <StatCard
            title={`Gastos ${currentMonthName}`}
            value={formatMoney(monthly.expenses, hideFinances)}
            icon={TrendingUp}
            variant="warning"
            to="/finanzas"
          />
          <StatCard
            title={`Beneficio ${currentMonthName}`}
            value={formatMoney(monthly.profit, hideFinances)}
            icon={BarChart3}
            variant={profitVariant}
            to="/finanzas"
          />
          <StatCard
            title="MRR Servicios"
            value={formatMoney(services.totalMRR, hideFinances)}
            subtitle={hideFinances ? '•• clientes' : `${services.clientsWithServices} clientes`}
            icon={TrendingUp}
            variant="primary"
            to="/servicios"
          />
          <StatCard
            title="Clientes Activos"
            value={String(clientsKPI.active)}
            subtitle={`de ${clientsKPI.total} totales`}
            icon={Users}
            variant="primary"
            to="/clientes"
          />
          <StatCard
            title="Pipeline de Ventas"
            value={String(pipeline.total || pipeline.count)}
            subtitle="oportunidades activas"
            icon={Target}
            variant="primary"
            to="/crm"
          />
          <StatCard
            title="Tareas Equipo"
            value={String(tasksKPI.teamPending)}
            subtitle="pendientes"
            icon={CheckSquare}
            variant="warning"
            to="/tareas"
          />
          <StatCard
            title="En Progreso"
            value={String(tasksKPI.teamInProgress)}
            subtitle="trabajando ahora"
            icon={Clock}
            variant="primary"
            to="/tareas"
          />
          <StatCard
            title="Completadas"
            value={String(tasksKPI.teamDone)}
            subtitle="tareas totales"
            icon={Briefcase}
            variant="success"
            to="/tareas"
          />
          <StatCard
            title="Mi Productividad"
            value={`${tasksKPI.productivity}%`}
            subtitle={`${tasksKPI.myDone} de ${tasksKPI.myTotal} tareas`}
            icon={TrendingUp}
            variant={productivityVariant}
            to="/tareas"
          />
        </div>
      )}

      {/* ============ USER (no admin): KPI personalizado simple ============ */}
      {!isAdmin && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Mis tareas overdue"
            value={String(tasksKPI.overdue.length)}
            subtitle={`${tasksKPI.doneThisMonth.length} completadas este mes`}
            icon={CheckCircle2}
            variant={tasksKPI.overdue.length > 0 ? 'warning' : 'success'}
            to="/tareas"
          />
          <StatCard
            title="Mis tareas totales"
            value={String(tasksKPI.myTotal)}
            subtitle={`${tasksKPI.myDone} completadas`}
            icon={CheckSquare}
            variant="primary"
            to="/tareas"
          />
          <StatCard
            title="Mi productividad"
            value={`${tasksKPI.productivity}%`}
            subtitle={`${tasksKPI.myDone} de ${tasksKPI.myTotal} tareas`}
            icon={TrendingUp}
            variant={productivityVariant}
            to="/tareas"
          />
          <StatCard
            title="Bots WhatsApp"
            value={`${botsKPI.online}/${botsKPI.total}`}
            subtitle={
              botsKPI.alertas > 0
                ? `${botsKPI.citas} citas · ⚠ ${botsKPI.alertas}`
                : `${botsKPI.citas} citas activas`
            }
            icon={Bot}
            variant={botsKPI.alertas > 0 ? 'warning' : 'primary'}
            to="/agentes"
          />
        </div>
      )}

      {/* ============ Dinero Disponible (admin) ============ */}
      {isAdmin && disponible.length > 0 && (
        <section>
          <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
            <button
              onClick={() => setShowAccounts((p) => !p)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-primary/5 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <span className="font-semibold text-foreground">Dinero Disponible</span>
                <ChevronRight
                  className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform',
                    showAccounts && 'rotate-90'
                  )}
                />
              </div>
              <span className="text-xl font-bold text-primary tabular-nums">
                {formatMoney(totalDisponible, hideFinances)}
              </span>
            </button>
            {showAccounts && (
              <div className="px-5 pb-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {disponible
                  .filter((c) => c.saldo > 0)
                  .map((cuenta) => (
                    <div
                      key={cuenta.cuenta}
                      className="p-3 rounded-lg bg-card border border-border hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-[11px] font-medium text-muted-foreground truncate">
                          {cuenta.cuenta}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-foreground tabular-nums">
                        {formatMoney(cuenta.saldo, hideFinances)}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ============ Charts: Tendencia ingresos + Carga equipo ============ */}
      {isAdmin && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Tendencia de Ingresos (6 meses) */}
          <section>
            <SectionHeader title="Tendencia de Ingresos (6 meses)" />
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="h-[260px]">
                {hideFinances ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <EyeOff className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Valores ocultos</p>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={incomeByMonth}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                      <RechartsTooltip
                        formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                      />
                      <Bar dataKey="income" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </section>

          {/* Carga de trabajo del equipo */}
          <section>
            <SectionHeader
              title={
                <span className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Carga de Trabajo del Equipo
                </span>
              }
            />
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="h-[260px]">
                {teamWorkload.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    Sin tareas asignadas todavía.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={teamWorkload} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                      />
                      <Bar dataKey="pending" name="Pendientes" stackId="a" fill="#f59e0b" />
                      <Bar dataKey="inProgress" name="En Curso" stackId="a" fill="#3b82f6" />
                      <Bar dataKey="completed" name="Completadas" stackId="a" fill="#22c55e" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ============ Row: Top clientes + Estado bots ============ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top 5 clientes del mes */}
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
                    <div className="text-sm font-bold tabular-nums">
                      {hideFinances ? '••••••' : COPshort(c.total)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Estado de bots WhatsApp */}
        <section>
          <SectionHeader title="Bots WhatsApp" subtitle="Estado y actividad de hoy" to="/agentes" />
          {agents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
              No hay bots configurados.
            </div>
          ) : (
            <div className="space-y-2">
              {agents.map((a) => {
                const activo =
                  a.stats?.estado?.activo === true || a.stats?.bot_activo === true;
                const alertCount = Number(a.stats?.alertas_abiertas ?? a.stats?.pendientes ?? 0);
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

      {/* ============ Tareas overdue ============ */}
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

      {/* ============ Accesos rápidos ============ */}
      <section>
        <SectionHeader title="Accesos rápidos" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => openAiTask()}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all text-left"
          >
            <Sparkles className="h-5 w-5 text-violet-500" />
            <div>
              <div className="text-sm font-medium">Crear tarea con IA</div>
              <div className="text-[11px] text-muted-foreground">Describe en lenguaje natural</div>
            </div>
          </button>
          <Link
            to="/crm"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all"
          >
            <Building2 className="h-5 w-5 text-blue-500" />
            <div>
              <div className="text-sm font-medium">Ventas</div>
              <div className="text-[11px] text-muted-foreground">Pipeline y oportunidades</div>
            </div>
          </Link>
          <Link
            to="/procesos"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all"
          >
            <Activity className="h-5 w-5 text-violet-500" />
            <div>
              <div className="text-sm font-medium">Procesos</div>
              <div className="text-[11px] text-muted-foreground">PM2 admin del VPS</div>
            </div>
          </Link>
          <Link
            to="/finanzas"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all"
          >
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
