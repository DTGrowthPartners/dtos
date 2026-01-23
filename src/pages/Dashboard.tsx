import { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Users,
  CheckSquare,
  TrendingUp,
  Briefcase,
  Clock,
  Target,
  AlertCircle,
  ArrowRight,
  Calendar,
  FileText,
  UserCheck,
  BarChart3,
  PieChart
} from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { authService, useAuthStore } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { loadTasks } from '@/lib/firestoreTaskService';
import { TEAM_MEMBERS, type Task, type TeamMemberName } from '@/types/taskTypes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart as RechartsPieChart,
  Pie,
} from 'recharts';

interface Client {
  id: string;
  name: string;
  status: string;
}

interface FinanceData {
  totalIncome: number;
  totalExpenses: number;
}

interface ServiceRevenueMetrics {
  totalMRR: number;
  totalARR: number;
  activeServicesCount: number;
  clientsWithServices: number;
}

interface FinanceTransaction {
  id: string;
  tipo: string;
  importe: number;
  fecha: string;
  terceroId?: string;
  terceroNombre?: string;
}

interface CRMDeal {
  id: string;
  name: string;
  value: number;
  stage: { id: string; name: string; color: string };
  createdAt: string;
}

interface CRMStage {
  id: string;
  name: string;
  color: string;
  order: number;
}

export default function Dashboard() {
  const user = authService.getUser();
  const { user: authUser } = useAuthStore();
  const navigate = useNavigate();

  // State for all data
  const [activeClients, setActiveClients] = useState(0);
  const [totalClients, setTotalClients] = useState(0);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [servicesMRR, setServicesMRR] = useState(0);
  const [clientsWithServices, setClientsWithServices] = useState(0);
  const [financeTransactions, setFinanceTransactions] = useState<FinanceTransaction[]>([]);
  const [crmDeals, setCrmDeals] = useState<CRMDeal[]>([]);
  const [crmStages, setCrmStages] = useState<CRMStage[]>([]);
  const [topClients, setTopClients] = useState<{name: string, total: number}[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is admin
  const isAdmin = authUser?.role?.toLowerCase() === 'admin';

  // Normalize string removing accents for comparison
  const normalizeString = (str: string): string => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  };

  // Map user firstName to team member name (flexible matching with accent support)
  const getTeamMemberNameFromUser = (firstName: string | undefined): string | undefined => {
    if (!firstName) return undefined;
    const normalizedInput = normalizeString(firstName);
    // Try to find a matching team member (handles accents like Lía vs Lia)
    const member = TEAM_MEMBERS.find(m => normalizeString(m.name) === normalizedInput);
    // Return the matched team member name, or fallback to the original firstName
    return member?.name || firstName;
  };

  const loggedUserName = getTeamMemberNameFromUser(authUser?.firstName);

  // Filter tasks for current user (only assigned tasks, not created by)
  const myTasks = useMemo(() => {
    if (!loggedUserName) return allTasks;
    const normalizedUserName = normalizeString(loggedUserName);
    return allTasks.filter(t => t.assignee && normalizeString(t.assignee) === normalizedUserName);
  }, [allTasks, loggedUserName]);

  const myPendingTasks = useMemo(() =>
    myTasks.filter(t => t.status !== 'DONE').sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    }),
    [myTasks]
  );

  const myCompletedTasks = useMemo(() =>
    myTasks.filter(t => t.status === 'DONE'),
    [myTasks]
  );

  // Tasks I created (assigned to others)
  const tasksICreated = useMemo(() => {
    if (!loggedUserName) return [];
    const normalizedUserName = normalizeString(loggedUserName);
    return allTasks.filter(t => {
      const normalizedCreator = t.creator ? normalizeString(t.creator) : '';
      const normalizedAssignee = t.assignee ? normalizeString(t.assignee) : '';
      return (
        normalizedCreator === normalizedUserName &&
        normalizedAssignee !== normalizedUserName &&
        t.status !== 'DONE'
      );
    }).sort((a, b) => {
      // Sort by due date first, then by priority
      if (a.dueDate && b.dueDate) {
        return a.dueDate - b.dueDate;
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    });
  }, [allTasks, loggedUserName]);

  // Tasks completed this week
  const myCompletedThisWeek = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    return myCompletedTasks.filter(t => {
      if (!t.completedAt) return false;
      const completedDate = new Date(t.completedAt);
      return completedDate >= startOfWeek;
    }).length;
  }, [myCompletedTasks]);

  // Team tasks (for admin)
  const teamPendingTasks = useMemo(() =>
    allTasks.filter(t => t.status !== 'DONE').length,
    [allTasks]
  );

  const teamInProgressTasks = useMemo(() =>
    allTasks.filter(t => t.status === 'IN_PROGRESS').length,
    [allTasks]
  );

  const teamCompletedTasks = useMemo(() =>
    allTasks.filter(t => t.status === 'DONE').length,
    [allTasks]
  );

  // Team workload (for admin)
  const teamWorkload = useMemo(() => {
    const workloadMap = new Map<string, { pending: number, completed: number }>();

    allTasks.forEach(task => {
      if (task.assignee) {
        const current = workloadMap.get(task.assignee) || { pending: 0, completed: 0 };
        if (task.status === 'DONE') {
          current.completed++;
        } else {
          current.pending++;
        }
        workloadMap.set(task.assignee, current);
      }
    });

    return Array.from(workloadMap.entries())
      .map(([name, data]) => ({
        name,
        pending: data.pending,
        completed: data.completed,
        total: data.pending + data.completed
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [allTasks]);

  // Income by month (for admin chart)
  const incomeByMonth = useMemo(() => {
    const monthMap = new Map<string, { income: number, expenses: number }>();
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    financeTransactions.forEach(t => {
      const date = new Date(t.fecha);
      const monthKey = `${months[date.getMonth()]} ${date.getFullYear()}`;
      const current = monthMap.get(monthKey) || { income: 0, expenses: 0 };

      if (t.tipo === 'ingreso') {
        current.income += t.importe;
      } else {
        current.expenses += t.importe;
      }
      monthMap.set(monthKey, current);
    });

    // Get last 6 months
    const now = new Date();
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
      const data = monthMap.get(key) || { income: 0, expenses: 0 };
      result.push({
        month: months[d.getMonth()],
        income: data.income,
        expenses: data.expenses,
        profit: data.income - data.expenses
      });
    }
    return result;
  }, [financeTransactions]);

  // CRM pipeline summary (for admin)
  const pipelineSummary = useMemo(() => {
    return crmStages
      .sort((a, b) => a.order - b.order)
      .map(stage => ({
        name: stage.name,
        color: stage.color,
        count: crmDeals.filter(d => d.stage?.id === stage.id).length,
        value: crmDeals.filter(d => d.stage?.id === stage.id).reduce((sum, d) => sum + (d.value || 0), 0)
      }));
  }, [crmStages, crmDeals]);

  // My task status breakdown (for user)
  const myTaskStatusBreakdown = useMemo(() => {
    const statusCounts = {
      'Por hacer': myTasks.filter(t => t.status === 'TODO').length,
      'En progreso': myTasks.filter(t => t.status === 'IN_PROGRESS').length,
      'En revisión': myTasks.filter(t => t.status === 'REVIEW').length,
      'Completadas': myTasks.filter(t => t.status === 'DONE').length,
    };

    const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e'];

    return Object.entries(statusCounts).map(([name, value], index) => ({
      name,
      value,
      color: colors[index]
    }));
  }, [myTasks]);

  // Productivity percentage
  const productivityPercentage = useMemo(() => {
    const total = myTasks.length;
    if (total === 0) return 0;
    return Math.round((myCompletedTasks.length / total) * 100);
  }, [myTasks, myCompletedTasks]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);

        // Base data for all users
        const basePromises = [
          apiClient.get<Client[]>('/api/clients').catch(() => []),
          loadTasks().catch(() => []),
          apiClient.get<ServiceRevenueMetrics>('/api/services/metrics/revenue').catch(() => ({
            totalMRR: 0, totalARR: 0, activeServicesCount: 0, clientsWithServices: 0
          })),
        ];

        // Admin-only data
        const adminPromises = isAdmin ? [
          apiClient.get<FinanceData>('/api/finance/data').catch(() => ({ totalIncome: 0, totalExpenses: 0 })),
          apiClient.get<FinanceTransaction[]>('/api/finance/expense').catch(() => []),
          apiClient.get<CRMDeal[]>('/api/crm/deals').catch(() => []),
          apiClient.get<CRMStage[]>('/api/crm/stages').catch(() => []),
        ] : [];

        const results = await Promise.all([...basePromises, ...adminPromises]);

        // Process base data
        const [clientsData, tasksData, servicesMetrics] = results;

        // Clients
        const clients = clientsData as Client[];
        setActiveClients(clients.filter(c => c.status === 'active').length);
        setTotalClients(clients.length);

        // Tasks
        setAllTasks(tasksData as Task[]);

        // Services MRR
        const metrics = servicesMetrics as ServiceRevenueMetrics;
        setServicesMRR(metrics.totalMRR || 0);
        setClientsWithServices(metrics.clientsWithServices || 0);

        // Admin-only data processing
        if (isAdmin && results.length > 3) {
          const financeData = results[3] as FinanceData;
          const expenses = results[4] as FinanceTransaction[];
          const deals = results[5] as CRMDeal[];
          const stages = results[6] as CRMStage[];

          setMonthlyIncome(financeData.totalIncome || 0);
          setMonthlyExpenses(financeData.totalExpenses || 0);
          setFinanceTransactions(expenses);
          setCrmDeals(deals);
          setCrmStages(stages);

          // Calculate top clients by income
          const clientIncomeMap = new Map<string, number>();
          expenses.filter(t => t.tipo === 'ingreso' && t.terceroNombre).forEach(t => {
            const current = clientIncomeMap.get(t.terceroNombre!) || 0;
            clientIncomeMap.set(t.terceroNombre!, current + t.importe);
          });

          const topClientsList = Array.from(clientIncomeMap.entries())
            .map(([name, total]) => ({ name, total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
          setTopClients(topClientsList);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [isAdmin]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return 'Alta';
      case 'medium': return 'Media';
      case 'low': return 'Baja';
      default: return priority;
    }
  };

  // Format due date with urgency indicator
  const formatDueDate = (dueDate: number | undefined) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const dateStr = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

    if (diffDays < 0) {
      return { text: `Vencida ${dateStr}`, className: 'text-red-500 font-medium' };
    } else if (diffDays === 0) {
      return { text: 'Hoy', className: 'text-orange-500 font-medium' };
    } else if (diffDays === 1) {
      return { text: 'Mañana', className: 'text-yellow-500' };
    } else if (diffDays <= 3) {
      return { text: dateStr, className: 'text-yellow-500' };
    }
    return { text: dateStr, className: 'text-muted-foreground' };
  };

  // ==================== ADMIN DASHBOARD ====================
  if (isAdmin) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Panel de Administración
          </h1>
          <p className="text-muted-foreground">Resumen general del negocio</p>
        </div>

        {/* Admin Stats Grid - 8 cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Ingresos del Mes"
            value={isLoading ? '...' : `$${monthlyIncome.toLocaleString()}`}
            icon={DollarSign}
            variant="success"
          />
          <StatCard
            title="Gastos del Mes"
            value={isLoading ? '...' : `$${monthlyExpenses.toLocaleString()}`}
            icon={TrendingUp}
            variant="warning"
          />
          <StatCard
            title="Beneficio Neto"
            value={isLoading ? '...' : `$${(monthlyIncome - monthlyExpenses).toLocaleString()}`}
            icon={BarChart3}
            variant={monthlyIncome - monthlyExpenses >= 0 ? 'success' : 'warning'}
          />
          <StatCard
            title="MRR Servicios"
            value={isLoading ? '...' : `$${servicesMRR.toLocaleString()}`}
            subtitle={`${clientsWithServices} clientes`}
            icon={TrendingUp}
            variant="primary"
          />
          <StatCard
            title="Clientes Activos"
            value={isLoading ? '...' : activeClients}
            subtitle={`de ${totalClients} totales`}
            icon={Users}
            variant="primary"
          />
          <StatCard
            title="Pipeline CRM"
            value={isLoading ? '...' : crmDeals.length}
            subtitle="oportunidades activas"
            icon={Target}
            variant="primary"
          />
          <StatCard
            title="Tareas Equipo"
            value={isLoading ? '...' : teamPendingTasks}
            subtitle="pendientes"
            icon={CheckSquare}
            variant="warning"
          />
          <StatCard
            title="En Progreso"
            value={isLoading ? '...' : teamInProgressTasks}
            subtitle="trabajando ahora"
            icon={Clock}
            variant="primary"
          />
          <StatCard
            title="Completadas"
            value={isLoading ? '...' : teamCompletedTasks}
            subtitle="tareas totales"
            icon={Briefcase}
            variant="success"
          />
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Income Trends Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Tendencia de Ingresos (6 meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={incomeByMonth}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Bar dataKey="income" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Team Workload Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Carga de Trabajo del Equipo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teamWorkload} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Bar dataKey="pending" name="Pendientes" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="completed" name="Completadas" stackId="a" fill="#22c55e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Top Clients */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Top Clientes por Ingresos
                </span>
                <Link to="/clientes">
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    Ver todos <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No hay datos</p>
                ) : (
                  topClients.map((client, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-4">{index + 1}.</span>
                        <span className="text-sm font-medium truncate max-w-[150px]">{client.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-green-600">
                        ${client.total.toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* CRM Pipeline */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Pipeline CRM
                </span>
                <Link to="/crm">
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    Ver CRM <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {pipelineSummary.map((stage, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg border"
                    style={{ borderColor: stage.color + '40' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="text-xs font-medium truncate">{stage.name}</span>
                    </div>
                    <div className="text-xl font-bold">{stage.count}</div>
                    <div className="text-xs text-muted-foreground">
                      ${stage.value.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ==================== USER DASHBOARD ====================
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Bienvenido, {user ? user.firstName : 'Usuario'}
        </h1>
        <p className="text-muted-foreground">Tu resumen personal de actividades</p>
      </div>

      {/* User Stats Grid - 4 cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Mis Tareas Pendientes"
          value={isLoading ? '...' : myPendingTasks.length}
          icon={CheckSquare}
          variant="warning"
        />
        <StatCard
          title="Completadas Esta Semana"
          value={isLoading ? '...' : myCompletedThisWeek}
          icon={Clock}
          variant="success"
        />
        <StatCard
          title="Total Completadas"
          value={isLoading ? '...' : myCompletedTasks.length}
          icon={Briefcase}
          variant="primary"
        />
        <StatCard
          title="Mi Productividad"
          value={isLoading ? '...' : `${productivityPercentage}%`}
          icon={TrendingUp}
          variant={productivityPercentage >= 70 ? 'success' : productivityPercentage >= 40 ? 'warning' : 'default'}
        />
      </div>

      {/* Content Row */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        {/* My Pending Tasks */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Mis Tareas Pendientes ({myPendingTasks.length})
              </span>
              <Link to="/tareas">
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  Ver todas <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {myPendingTasks.length === 0 ? (
                <div className="text-center py-8">
                  <CheckSquare className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">¡No tienes tareas pendientes!</p>
                </div>
              ) : (
                myPendingTasks.slice(0, 5).map((task) => {
                  const dueDateInfo = formatDueDate(task.dueDate);
                  return (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${getPriorityColor(task.priority)}`} />
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px] px-1.5 flex-shrink-0">
                            {getPriorityLabel(task.priority)}
                          </Badge>

                        </div>
                      </div>
                      {dueDateInfo && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className={`text-xs whitespace-nowrap ${dueDateInfo.className}`}>
                            {dueDateInfo.text}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Task Status Breakdown */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Estado de Mis Tareas
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-hidden">
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={myTaskStatusBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {myTaskStatusBreakdown.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [value, name]}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {myTaskStatusBreakdown.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks I Created (Assigned to Others) */}
      {tasksICreated.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Tareas que Asigné ({tasksICreated.length})
              </span>
              <Link to="/tareas">
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  Ver todas <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tasksICreated.slice(0, 6).map((task) => {
                const dueDateInfo = formatDueDate(task.dueDate);
                return (
                  <div
                    key={task.id}
                    className="flex flex-col gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/tareas?taskId=${task.id}`)}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getPriorityColor(task.priority)}`} />
                      <p className="text-sm font-medium line-clamp-2">{task.title}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <UserCheck className="h-3 w-3" />
                        <span className="truncate max-w-[80px]">{task.assignee}</span>
                      </div>
                      {dueDateInfo && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className={`whitespace-nowrap ${dueDateInfo.className}`}>
                            {dueDateInfo.text}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Accesos Rápidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Link to="/tareas">
              <Button variant="outline" size="sm" className="gap-2">
                <CheckSquare className="h-4 w-4" />
                Mis Tareas
              </Button>
            </Link>
            <Link to="/clientes">
              <Button variant="outline" size="sm" className="gap-2">
                <Users className="h-4 w-4" />
                Clientes
              </Button>
            </Link>
            <Link to="/servicios">
              <Button variant="outline" size="sm" className="gap-2">
                <Briefcase className="h-4 w-4" />
                Servicios
              </Button>
            </Link>
            <Link to="/crm">
              <Button variant="outline" size="sm" className="gap-2">
                <Target className="h-4 w-4" />
                CRM
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
