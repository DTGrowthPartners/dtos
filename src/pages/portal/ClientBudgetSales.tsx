import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
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
  LineChart,
  Line,
} from 'recharts';

interface SalesBudget {
  id: string;
  month: number;
  year: number;
  budget: number;
  sales: number;
  leads: number;
  customers: number;
  notes: string | null;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

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

export default function ClientBudgetSales() {
  const [budgets, setBudgets] = useState<SalesBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Generate year options (current year and 2 previous years)
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  useEffect(() => {
    const fetchBudgets = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<SalesBudget[]>(
          `/api/client-portal/portal/sales-budget?year=${selectedYear}`
        );
        setBudgets(response);
      } catch (err) {
        console.error('Error fetching sales budget:', err);
        setError('Error al cargar los datos de presupuesto');
      } finally {
        setLoading(false);
      }
    };
    fetchBudgets();
  }, [selectedYear]);

  // Calculate totals
  const totals = budgets.reduce(
    (acc, b) => ({
      budget: acc.budget + b.budget,
      sales: acc.sales + b.sales,
      leads: acc.leads + b.leads,
      customers: acc.customers + b.customers,
    }),
    { budget: 0, sales: 0, leads: 0, customers: 0 }
  );

  // Calculate ROI
  const roi = totals.budget > 0
    ? (((totals.sales - totals.budget) / totals.budget) * 100).toFixed(1)
    : '0.0';

  // Prepare chart data
  const chartData = MONTH_SHORT.map((month, index) => {
    const monthData = budgets.find((b) => b.month === index + 1);
    return {
      month,
      Presupuesto: monthData?.budget || 0,
      Ventas: monthData?.sales || 0,
    };
  });

  // Prepare leads/customers chart data
  const leadsChartData = MONTH_SHORT.map((month, index) => {
    const monthData = budgets.find((b) => b.month === index + 1);
    return {
      month,
      Leads: monthData?.leads || 0,
      Clientes: monthData?.customers || 0,
    };
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Presupuesto y Ventas</h1>
          <p className="text-muted-foreground">Análisis de inversión vs retorno</p>
        </div>
        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Año" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Presupuesto Total</p>
                <p className="text-lg font-bold">{formatCurrency(totals.budget)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ventas Totales</p>
                <p className="text-lg font-bold">{formatCurrency(totals.sales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                parseFloat(roi) >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
              }`}>
                {parseFloat(roi) >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ROI</p>
                <p className={`text-lg font-bold ${
                  parseFloat(roi) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {roi}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Clientes Nuevos</p>
                <p className="text-lg font-bold">{formatNumber(totals.customers)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget vs Sales Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Presupuesto vs Ventas</CardTitle>
          <CardDescription>Comparativa mensual {selectedYear}</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Leads & Customers Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Leads y Clientes</CardTitle>
          <CardDescription>Evolución mensual de conversiones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={leadsChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  labelStyle={{ color: 'var(--foreground)' }}
                  contentStyle={{
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Leads"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
                <Line
                  type="monotone"
                  dataKey="Clientes"
                  stroke="hsl(142, 76%, 36%)"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(142, 76%, 36%)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle Mensual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Mes</th>
                  <th className="text-right py-3 px-4 font-medium">Presupuesto</th>
                  <th className="text-right py-3 px-4 font-medium">Ventas</th>
                  <th className="text-right py-3 px-4 font-medium">Diferencia</th>
                  <th className="text-right py-3 px-4 font-medium">Leads</th>
                  <th className="text-right py-3 px-4 font-medium">Clientes</th>
                </tr>
              </thead>
              <tbody>
                {budgets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      No hay datos para {selectedYear}
                    </td>
                  </tr>
                ) : (
                  budgets.map((budget) => {
                    const diff = budget.sales - budget.budget;
                    return (
                      <tr key={budget.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{MONTH_NAMES[budget.month - 1]}</td>
                        <td className="py-3 px-4 text-right">{formatCurrency(budget.budget)}</td>
                        <td className="py-3 px-4 text-right">{formatCurrency(budget.sales)}</td>
                        <td className={`py-3 px-4 text-right font-medium ${
                          diff >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                        </td>
                        <td className="py-3 px-4 text-right">{formatNumber(budget.leads)}</td>
                        <td className="py-3 px-4 text-right">{formatNumber(budget.customers)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {budgets.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/50 font-bold">
                    <td className="py-3 px-4">Total</td>
                    <td className="py-3 px-4 text-right">{formatCurrency(totals.budget)}</td>
                    <td className="py-3 px-4 text-right">{formatCurrency(totals.sales)}</td>
                    <td className={`py-3 px-4 text-right ${
                      totals.sales - totals.budget >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {totals.sales - totals.budget >= 0 ? '+' : ''}
                      {formatCurrency(totals.sales - totals.budget)}
                    </td>
                    <td className="py-3 px-4 text-right">{formatNumber(totals.leads)}</td>
                    <td className="py-3 px-4 text-right">{formatNumber(totals.customers)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
