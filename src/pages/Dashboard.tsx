import { useState, useEffect } from 'react';
import { DollarSign, Users, CheckSquare, Target, AlertTriangle } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { TasksToday } from '@/components/dashboard/TasksToday';
import { QuickAccess } from '@/components/dashboard/QuickAccess';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { CampaignOverview } from '@/components/dashboard/CampaignOverview';
import { ServiceRevenueCard } from '@/components/dashboard/ServiceRevenueCard';
import { campaigns, notifications } from '@/data/mockData';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { authService, useAuthStore } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { loadTasks } from '@/lib/firestoreTaskService';
import { TEAM_MEMBERS, type Task, type TeamMemberName } from '@/types/taskTypes';

interface Client {
  id: string;
  name: string;
  status: string;
}

interface FinanceData {
  totalIncome: number;
  totalExpenses: number;
}

export default function Dashboard() {
  const user = authService.getUser();
  const { user: authUser } = useAuthStore();
  const [activeClients, setActiveClients] = useState(0);
  const [totalClients, setTotalClients] = useState(0);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Map user firstName to team member name
  const getTeamMemberNameFromUser = (firstName: string | undefined): TeamMemberName | undefined => {
    if (!firstName) return undefined;
    const normalizedName = firstName.toLowerCase().trim();
    const member = TEAM_MEMBERS.find(m => m.name.toLowerCase() === normalizedName);
    return member?.name;
  };

  const loggedUserName = getTeamMemberNameFromUser(authUser?.firstName);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);

        // Fetch all data in parallel
        const [clientsData, tasksData, financeData] = await Promise.all([
          apiClient.get<Client[]>('/api/clients').catch(() => []),
          loadTasks().catch(() => []),
          apiClient.get<FinanceData>('/api/finance/data').catch(() => ({ totalIncome: 0, totalExpenses: 0 })),
        ]);

        // Process clients
        const active = clientsData.filter((c) => c.status === 'active').length;
        setActiveClients(active);
        setTotalClients(clientsData.length);

        // Process tasks - filter by logged user
        const userTasks = tasksData.filter((t: Task) => {
          const isUserTask = loggedUserName
            ? (t.assignee === loggedUserName || t.creator === loggedUserName)
            : true;
          return isUserTask;
        });
        const pending = userTasks.filter((t: Task) => t.status !== 'DONE').length;
        setPendingTasks(pending);

        // Process finance
        setMonthlyIncome(financeData.totalIncome || 0);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [loggedUserName]);

  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;
  const urgentNotifications = notifications.filter((n) => n.type === 'alert');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Bienvenido, {user ? user.firstName : 'Usuario'}
        </h1>
        <p className="text-muted-foreground">Aquí tienes un resumen de las operaciones de hoy</p>
      </div>

      {/* Alerts */}
      {urgentNotifications.length > 0 && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Alertas Importantes</AlertTitle>
          <AlertDescription>
            {urgentNotifications.map((n) => n.message).join(' • ')}
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Ingresos del Mes"
          value={isLoading ? '...' : `$${monthlyIncome.toLocaleString()}`}
          icon={DollarSign}
          variant="primary"
        />
        <StatCard
          title="Clientes Activos"
          value={isLoading ? '...' : activeClients}
          subtitle={`de ${totalClients} totales`}
          icon={Users}
          variant="success"
        />
        <StatCard
          title="Tareas Pendientes"
          value={isLoading ? '...' : pendingTasks}
          subtitle="para esta semana"
          icon={CheckSquare}
          variant="warning"
        />
        <StatCard
          title="Campañas Activas"
          value={activeCampaigns}
          subtitle={`de ${campaigns.length} totales`}
          icon={Target}
          variant="primary"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          <RevenueChart />
          <CampaignOverview />
        </div>

        {/* Right Column - 1/3 */}
        <div className="space-y-6">
          <ServiceRevenueCard />
          <TasksToday />
          <QuickAccess />
        </div>
      </div>
    </div>
  );
}
