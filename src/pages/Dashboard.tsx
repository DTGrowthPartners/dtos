import { useState, useEffect } from 'react';
import { DollarSign, Users, CheckSquare, TrendingUp, Briefcase } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
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

interface ServiceRevenueMetrics {
  totalMRR: number;
  totalARR: number;
  activeServicesCount: number;
  clientsWithServices: number;
}

export default function Dashboard() {
  const user = authService.getUser();
  const { user: authUser } = useAuthStore();
  const [activeClients, setActiveClients] = useState(0);
  const [totalClients, setTotalClients] = useState(0);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [servicesMRR, setServicesMRR] = useState(0);
  const [clientsWithServices, setClientsWithServices] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is admin
  const isAdmin = authUser?.role?.toLowerCase() === 'admin';

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

        // Fetch all data in parallel (finance only for admin)
        const [clientsData, tasksData, financeData, servicesMetrics] = await Promise.all([
          apiClient.get<Client[]>('/api/clients').catch(() => []),
          loadTasks().catch(() => []),
          isAdmin ? apiClient.get<FinanceData>('/api/finance/data').catch(() => ({ totalIncome: 0, totalExpenses: 0 })) : Promise.resolve({ totalIncome: 0, totalExpenses: 0 }),
          apiClient.get<ServiceRevenueMetrics>('/api/services/metrics/revenue').catch(() => ({ totalMRR: 0, totalARR: 0, activeServicesCount: 0, clientsWithServices: 0 })),
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
        const completed = userTasks.filter((t: Task) => t.status === 'DONE').length;
        setPendingTasks(pending);
        setCompletedTasks(completed);

        // Process finance (only for admin)
        if (isAdmin) {
          setMonthlyIncome(financeData.totalIncome || 0);
        }

        // Process services MRR
        setServicesMRR(servicesMetrics.totalMRR || 0);
        setClientsWithServices(servicesMetrics.clientsWithServices || 0);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [loggedUserName, isAdmin]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Bienvenido, {user ? user.firstName : 'Usuario'}
        </h1>
        <p className="text-muted-foreground">Aquí tienes un resumen de las operaciones de hoy</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Primera tarjeta: Ingresos del Mes (solo admin) o Tareas Completadas (usuarios) */}
        {isAdmin ? (
          <StatCard
            title="Ingresos del Mes"
            value={isLoading ? '...' : `$${monthlyIncome.toLocaleString()}`}
            icon={DollarSign}
            variant="primary"
          />
        ) : (
          <StatCard
            title="Tareas Completadas"
            value={isLoading ? '...' : completedTasks}
            subtitle="este mes"
            icon={Briefcase}
            variant="primary"
          />
        )}
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
          title="Ingresos por Servicios"
          value={isLoading ? '...' : `$${servicesMRR.toLocaleString()}`}
          subtitle={`${clientsWithServices} clientes con servicios`}
          icon={TrendingUp}
          variant="primary"
        />
      </div>
    </div>
  );
}
