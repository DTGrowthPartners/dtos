import { DollarSign, Users, CheckSquare, Target, AlertTriangle } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { TasksToday } from '@/components/dashboard/TasksToday';
import { QuickAccess } from '@/components/dashboard/QuickAccess';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { CampaignOverview } from '@/components/dashboard/CampaignOverview';
import { clients, tasks, campaigns, financeData, notifications } from '@/data/mockData';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { authService } from '@/lib/auth';

export default function Dashboard() {
  const user = authService.getUser();
  const activeClients = clients.filter((c) => c.status === 'active').length;
  const pendingTasks = tasks.filter((t) => t.status !== 'completed').length;
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;
  const currentMonthIncome = financeData[financeData.length - 1].income;
  const previousMonthIncome = financeData[financeData.length - 2].income;
  const incomeGrowth = ((currentMonthIncome - previousMonthIncome) / previousMonthIncome) * 100;

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
          value={`€${currentMonthIncome.toLocaleString()}`}
          icon={DollarSign}
          trend={{ value: incomeGrowth, isPositive: incomeGrowth > 0 }}
          variant="primary"
        />
        <StatCard
          title="Clientes Activos"
          value={activeClients}
          subtitle={`de ${clients.length} totales`}
          icon={Users}
          variant="success"
        />
        <StatCard
          title="Tareas Pendientes"
          value={pendingTasks}
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
          <TasksToday />
          <QuickAccess />
        </div>
      </div>
    </div>
  );
}
