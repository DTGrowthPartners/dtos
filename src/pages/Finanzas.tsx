import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, CreditCard, ArrowUpRight, ArrowDownRight, Calendar, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface FinanceData {
  month: string;
  income: number;
  expenses: number;
}

interface ExpenseCategory {
  name: string;
  value: number;
  color: string;
}

interface FinanceResponse {
  financeByMonth: FinanceData[];
  expenseCategories: ExpenseCategory[];
  totalIncome: number;
  totalExpenses: number;
}

export default function Finanzas() {
  const [financeData, setFinanceData] = useState<FinanceData[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchFinanceData();
  }, []);

  const fetchFinanceData = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.get<FinanceResponse>('/api/finance/data');

      setFinanceData(data.financeByMonth);
      setExpenseCategories(data.expenseCategories);
      setTotalIncome(data.totalIncome);
      setTotalExpenses(data.totalExpenses);
    } catch (error) {
      console.error('Error fetching finance data:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos financieros desde Google Sheets',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Cargando datos financieros...</p>
        </div>
      </div>
    );
  }

  const currentMonth = financeData[financeData.length - 1] || { month: '', income: 0, expenses: 0 };
  const previousMonth = financeData[financeData.length - 2] || { month: '', income: 0, expenses: 0 };

  const incomeGrowth = previousMonth.income > 0
    ? ((currentMonth.income - previousMonth.income) / previousMonth.income) * 100
    : 0;
  const expensesGrowth = previousMonth.expenses > 0
    ? ((currentMonth.expenses - previousMonth.expenses) / previousMonth.expenses) * 100
    : 0;

  const netProfit = currentMonth.income - currentMonth.expenses;
  const profitMargin = currentMonth.income > 0 ? (netProfit / currentMonth.income) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finanzas</h1>
          <p className="text-muted-foreground">Datos desde Google Sheets - {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={fetchFinanceData}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Actualizar
          </Button>
          <Button className="w-full sm:w-auto">
            <Calendar className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Ingresos Totales</p>
              <p className="text-2xl font-bold text-foreground mt-1">€{totalIncome.toLocaleString()}</p>
              {incomeGrowth !== 0 && (
                <div className={cn('flex items-center gap-1 mt-2 text-sm', incomeGrowth >= 0 ? 'text-success' : 'text-destructive')}>
                  {incomeGrowth >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  <span>{Math.abs(incomeGrowth).toFixed(1)}%</span>
                </div>
              )}
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Gastos Totales</p>
              <p className="text-2xl font-bold text-foreground mt-1">€{totalExpenses.toLocaleString()}</p>
              {expensesGrowth !== 0 && (
                <div className={cn('flex items-center gap-1 mt-2 text-sm', expensesGrowth <= 0 ? 'text-success' : 'text-destructive')}>
                  {expensesGrowth >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  <span>{Math.abs(expensesGrowth).toFixed(1)}%</span>
                </div>
              )}
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
              <p className="text-sm text-muted-foreground">Categorías</p>
              <p className="text-2xl font-bold text-foreground mt-1">{expenseCategories.length}</p>
              <p className="text-sm text-muted-foreground mt-2">de gastos</p>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
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
          <p className="text-sm text-muted-foreground mb-4">Por categoría</p>
          {expenseCategories.length > 0 ? (
            <>
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
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-muted-foreground truncate">{cat.name}</span>
                    </div>
                    <span className="font-medium text-foreground whitespace-nowrap ml-2">€{cat.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              No hay categorías de gastos
            </div>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">Datos desde Google Sheets</h3>
            <p className="text-sm text-muted-foreground">
              Los datos financieros se cargan automáticamente desde tu hoja de cálculo de Google Sheets.
              Las hojas "Entrada" y "Salida" contienen los registros de ingresos y gastos respectivamente.
              Haz clic en "Actualizar" para obtener los datos más recientes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
