import { DollarSign, TrendingUp, TrendingDown, CreditCard, ArrowUpRight, ArrowDownRight, Calendar } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { financeData, pendingPayments, clients } from '@/data/mockData';
import { cn } from '@/lib/utils';

const currentMonth = financeData[financeData.length - 1];
const previousMonth = financeData[financeData.length - 2];
const incomeGrowth = ((currentMonth.income - previousMonth.income) / previousMonth.income) * 100;
const expensesGrowth = ((currentMonth.expenses - previousMonth.expenses) / previousMonth.expenses) * 100;

const activeClients = clients.filter((c) => c.status === 'active');
const totalMonthlyRevenue = activeClients.reduce((acc, c) => acc + c.monthlyBudget, 0);

const expenseCategories = [
  { name: 'Ads Budget', value: 8500, color: 'hsl(var(--primary))' },
  { name: 'Salarios', value: 3200, color: 'hsl(var(--success))' },
  { name: 'Herramientas', value: 650, color: 'hsl(var(--warning))' },
  { name: 'Otros', value: 450, color: 'hsl(var(--chart-4))' },
];

export default function Finanzas() {
  const netProfit = currentMonth.income - currentMonth.expenses;
  const profitMargin = (netProfit / currentMonth.income) * 100;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finanzas</h1>
          <p className="text-muted-foreground">Resumen financiero de diciembre 2024</p>
        </div>
        <Button className="w-full md:w-auto">
          <Calendar className="h-4 w-4 mr-2" />
          Exportar Reporte
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Ingresos</p>
              <p className="text-2xl font-bold text-foreground mt-1">€{currentMonth.income.toLocaleString()}</p>
              <div className={cn('flex items-center gap-1 mt-2 text-sm', incomeGrowth >= 0 ? 'text-success' : 'text-destructive')}>
                {incomeGrowth >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                <span>{Math.abs(incomeGrowth).toFixed(1)}%</span>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Gastos</p>
              <p className="text-2xl font-bold text-foreground mt-1">€{currentMonth.expenses.toLocaleString()}</p>
              <div className={cn('flex items-center gap-1 mt-2 text-sm', expensesGrowth <= 0 ? 'text-success' : 'text-destructive')}>
                {expensesGrowth >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                <span>{Math.abs(expensesGrowth).toFixed(1)}%</span>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Beneficio Neto</p>
              <p className="text-2xl font-bold text-foreground mt-1">€{netProfit.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-2">{profitMargin.toFixed(1)}% margen</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pagos Pendientes</p>
              <p className="text-2xl font-bold text-foreground mt-1">€{pendingPayments.reduce((a, p) => a + p.amount, 0).toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-2">{pendingPayments.length} facturas</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <CreditCard className="h-5 w-5 text-warning" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-foreground">Evolución Financiera</h3>
              <p className="text-sm text-muted-foreground">Ingresos vs Gastos (últimos 6 meses)</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-primary" />
                <span className="text-muted-foreground">Ingresos</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-destructive" />
                <span className="text-muted-foreground">Gastos</span>
              </div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`€${value.toLocaleString()}`, '']}
                />
                <Bar dataKey="income" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Distribution */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-2">Distribución de Gastos</h3>
          <p className="text-sm text-muted-foreground mb-4">Diciembre 2024</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseCategories}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {expenseCategories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`€${value.toLocaleString()}`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {expenseCategories.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-muted-foreground">{cat.name}</span>
                </div>
                <span className="font-medium text-foreground">€{cat.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending Payments & Revenue by Client */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Payments */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-4">Pagos Pendientes</h3>
          <div className="space-y-3">
            {pendingPayments.map((payment, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-foreground">{payment.client}</p>
                  <p className="text-sm text-muted-foreground">
                    Vence: {new Date(payment.dueDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">€{payment.amount.toLocaleString()}</p>
                  <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
                    Pendiente
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue by Client */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Ingresos por Cliente</h3>
            <span className="text-sm text-muted-foreground">Total: €{totalMonthlyRevenue.toLocaleString()}/mes</span>
          </div>
          <div className="space-y-3">
            {activeClients.map((client) => {
              const percentage = (client.monthlyBudget / totalMonthlyRevenue) * 100;
              return (
                <div key={client.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{client.company}</span>
                    <span className="text-muted-foreground">€{client.monthlyBudget.toLocaleString()}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
