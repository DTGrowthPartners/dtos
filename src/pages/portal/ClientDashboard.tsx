import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Target,
  DollarSign,
  TrendingUp,
  Users,
  MousePointerClick,
  Eye,
  RefreshCcw,
  Briefcase,
  Clock,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface DashboardData {
  client: {
    id: string;
    name: string;
    logo: string;
  };
  campaigns: Array<{
    id: string;
    name: string;
    platform: string;
    status: string;
    budget: number;
    spent: number;
    impressions: number;
    clicks: number;
    conversions: number;
  }>;
  salesBudgets: Array<{
    month: number;
    year: number;
    budget: number;
    sales: number;
    leads: number;
    customers: number;
  }>;
  services: Array<{
    id: string;
    name: string;
    status: string;
    progress: number;
  }>;
  metrics: {
    campaigns: {
      totalBudget: number;
      totalSpent: number;
      totalImpressions: number;
      totalClicks: number;
      totalConversions: number;
    };
    budgetSales: {
      totalBudget: number;
      totalSales: number;
      totalLeads: number;
      totalCustomers: number;
    };
    activeServices: number;
    pendingServices: number;
  };
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('es-CO').format(value);
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-green-500/10 text-green-600';
    case 'paused':
      return 'bg-yellow-500/10 text-yellow-600';
    case 'completed':
      return 'bg-blue-500/10 text-blue-600';
    case 'pending':
      return 'bg-orange-500/10 text-orange-600';
    default:
      return 'bg-gray-500/10 text-gray-600';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'active':
      return 'Activo';
    case 'paused':
      return 'Pausado';
    case 'completed':
      return 'Completado';
    case 'pending':
      return 'Pendiente';
    default:
      return status;
  }
};

export default function ClientDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<DashboardData>('/api/client-portal/portal/dashboard');
        setData(response);
      } catch (err) {
        console.error('Error fetching dashboard:', err);
        setError('Error al cargar el dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">{error || 'Error al cargar datos'}</p>
      </div>
    );
  }

  const { metrics, campaigns, salesBudgets, services } = data;

  // Prepare chart data
  const chartData = salesBudgets.map((sb) => ({
    month: MONTH_NAMES[sb.month - 1],
    Presupuesto: sb.budget,
    Ventas: sb.sales,
  }));

  // Calculate CTR
  const ctr = metrics.campaigns.totalClicks > 0
    ? ((metrics.campaigns.totalClicks / metrics.campaigns.totalImpressions) * 100).toFixed(2)
    : '0.00';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Resumen de tu rendimiento de marketing</p>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inversión Total</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics.campaigns.totalSpent)}</p>
                <p className="text-xs text-muted-foreground">
                  de {formatCurrency(metrics.campaigns.totalBudget)} presupuesto
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ventas Generadas</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics.budgetSales.totalSales)}</p>
                <p className="text-xs text-muted-foreground">
                  {metrics.budgetSales.totalCustomers} clientes nuevos
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Leads Generados</p>
                <p className="text-2xl font-bold">{formatNumber(metrics.budgetSales.totalLeads)}</p>
                <p className="text-xs text-muted-foreground">
                  {metrics.campaigns.totalConversions} conversiones
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">CTR Promedio</p>
                <p className="text-2xl font-bold">{ctr}%</p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(metrics.campaigns.totalClicks)} clicks
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                <MousePointerClick className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget vs Sales Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Presupuesto vs Ventas</CardTitle>
            <CardDescription>Comparativa mensual del año actual</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis
                      tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                      className="text-xs"
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelStyle={{ color: 'var(--foreground)' }}
                      contentStyle={{
                        backgroundColor: 'var(--background)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="Presupuesto" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Ventas" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                No hay datos de presupuesto disponibles
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Campaigns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Campañas Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {campaigns.length > 0 ? (
              <div className="space-y-4">
                {campaigns.slice(0, 5).map((campaign) => (
                  <div key={campaign.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{campaign.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">{campaign.platform}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(campaign.spent)}</p>
                      <p className="text-xs text-muted-foreground">
                        {campaign.clicks} clicks
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No hay campañas activas
              </div>
            )}
          </CardContent>
        </Card>

        {/* Services Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Estado de Servicios
            </CardTitle>
          </CardHeader>
          <CardContent>
            {services.length > 0 ? (
              <div className="space-y-4">
                {services.slice(0, 5).map((service) => (
                  <div key={service.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{service.name}</p>
                      <Badge className={getStatusColor(service.status)}>
                        {getStatusLabel(service.status)}
                      </Badge>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{ width: `${service.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-right">{service.progress}% completado</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No hay servicios registrados
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
