import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface Transaction {
  fecha: string;
  importe: number;
  descripcion: string;
  categoria: string;
  cuenta: string;
  entidad: string;
}

interface BudgetData {
  presupuesto: Record<string, Record<string, number>>;
  totales: Record<string, number>;
}

interface BudgetComparisonReportProps {
  gastos: Transaction[];
}

// Map categories from transactions to budget categories
const categoryMapping: Record<string, string> = {
  'Arriendo': 'Arriendo oficina',
  'Nómina (Dairo)': 'Nómina (Dairo)',
  'Nómina (Edgardo)': 'Nómina (Edgardo)',
  'Nómina (Stiven)': 'Nómina (Stiven)',
  'Almuerzos': 'Almuerzos',
  'Transportes - Gasolina': 'Transportes - Gasolina',
  'Servidores/Hosting/Dominios': 'Servidores/Hosting/Dominios',
  'Herramientas (Claude, GPT, Lovable, Twilio, Etc)': 'Herramientas (Claude, GPT, Lovable, Twilio, Etc)',
  'Honorarios Contador': 'Honorarios Contador',
  'Publicidad': 'Publicidad',
};

export default function BudgetComparisonReport({ gastos }: BudgetComparisonReportProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);

  // Get current month
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('es-ES', { month: 'long' }).toLowerCase();
  const currentMonthKey = currentMonth === 'enero' ? 'enero' : currentMonth === 'febrero' ? 'febrero' : currentMonth === 'marzo' ? 'marzo' : 'enero';

  // Fetch budget data from Google Sheets
  useEffect(() => {
    const fetchBudget = async () => {
      try {
        setIsLoading(true);
        const data = await apiClient.get<BudgetData>('/api/finance/budget');
        setBudgetData(data);
        console.log('Budget data fetched from Google Sheets:', data);
      } catch (error) {
        console.error('Error fetching budget data:', error);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los datos del presupuesto desde Google Sheets',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchBudget();
  }, []);

  // Normalize date helper
  const normalizeDate = (dateStr: string): string => {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const [, part1, part2, year] = slashMatch;
      const num1 = parseInt(part1);
      const num2 = parseInt(part2);
      if (num1 > 12) return `${year}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`;
      else if (num2 > 12) return `${year}-${part1.padStart(2, '0')}-${part2.padStart(2, '0')}`;
      else return `${year}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`;
    }

    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }
    } catch {
      console.warn('Could not parse date:', dateStr);
    }
    return dateStr;
  };

  // Filter gastos for current month
  const currentMonthGastos = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const monthStr = String(month).padStart(2, '0');
    const yearMonthPrefix = `${year}-${monthStr}`;

    return gastos.filter(g => {
      const normalized = normalizeDate(g.fecha);
      return normalized.startsWith(yearMonthPrefix);
    });
  }, [gastos, currentDate]);

  // Calculate actual spending by budget category
  const actualSpendingByCategory = useMemo(() => {
    const spending: Record<string, number> = {};

    // Get budget categories from real data or use default
    const presupuesto = budgetData?.presupuesto;
    const budgetCategories = presupuesto 
      ? Object.keys(presupuesto[currentMonthKey] || {})
      : [];
    
    // Initialize with budget categories
    if (budgetCategories.length > 0) {
      budgetCategories.forEach(cat => {
        spending[cat] = 0;
      });
    } else {
      // Fallback to empty if no budget data
      console.log('No budget categories found for month:', currentMonthKey);
    }

    // Add "Otros" category for variable expenses that don't match budget categories
    spending['Otros'] = 0;

    // Sum up actual spending (excluding "AJUSTE SALDO" - it's just a balance adjustment)
    currentMonthGastos.forEach(g => {
      // Skip "AJUSTE SALDO" category
      if (g.categoria === 'AJUSTE SALDO') return;

      const budgetCategory = categoryMapping[g.categoria] || g.categoria;
      if (spending[budgetCategory] !== undefined) {
        spending[budgetCategory] += g.importe;
      } else {
        // Try partial match
        const matchedKey = Object.keys(spending).find(key =>
          key !== 'Otros' && (
            g.categoria.toLowerCase().includes(key.toLowerCase()) ||
            key.toLowerCase().includes(g.categoria.toLowerCase())
          )
        );
        if (matchedKey) {
          spending[matchedKey] += g.importe;
        } else {
          // If no match, add to "Otros" category (variable expenses)
          spending['Otros'] += g.importe;
        }
      }
    });

    return spending;
  }, [currentMonthGastos, currentMonthKey, budgetData]);

  // Get budget for current month
  const currentMonthBudget = useMemo(() => {
    if (!budgetData) return {};
    return budgetData.presupuesto[currentMonthKey] || {};
  }, [budgetData, currentMonthKey]);

  // Get total budget for current month
  const currentMonthBudgetTotal = useMemo(() => {
    if (!budgetData) return 0;
    return budgetData.totales[currentMonthKey] || 0;
  }, [budgetData, currentMonthKey]);

  // Prepare comparison data for chart
  const comparisonData = useMemo(() => {
    const budget = currentMonthBudget;

    const data = Object.entries(budget).map(([category, budgeted]) => {
      const actual = actualSpendingByCategory[category] || 0;
      const difference = budgeted - actual;
      const percentUsed = budgeted > 0 ? (actual / budgeted) * 100 : 0;

      return {
        category: category.length > 20 ? category.substring(0, 20) + '...' : category,
        fullCategory: category,
        presupuesto: budgeted,
        real: actual,
        diferencia: difference,
        percentUsed,
        status: percentUsed > 100 ? 'over' : percentUsed > 80 ? 'warning' : 'ok',
      };
    });

    // Add "Otros" category for variable expenses (gastos variables)
    const otrosActual = actualSpendingByCategory['Otros'] || 0;
    if (otrosActual > 0) {
      data.push({
        category: 'Otros',
        fullCategory: 'Otros (Gastos Variables)',
        presupuesto: 0,
        real: otrosActual,
        diferencia: -otrosActual,
        percentUsed: 0,
        status: 'warning',
      });
    }

    return data.sort((a, b) => b.presupuesto - a.presupuesto);
  }, [currentMonthBudget, actualSpendingByCategory]);

  // Calculate totals
  const totals = useMemo(() => {
    const budgetTotal = currentMonthBudgetTotal;
    const actualTotal = Object.values(actualSpendingByCategory).reduce((sum, val) => sum + val, 0);
    const difference = budgetTotal - actualTotal;
    const percentUsed = budgetTotal > 0 ? (actualTotal / budgetTotal) * 100 : 0;

    return {
      budgetTotal,
      actualTotal,
      difference,
      percentUsed,
    };
  }, [currentMonthBudgetTotal, actualSpendingByCategory]);

  // Monthly comparison data
  const monthlyComparison = useMemo(() => {
    if (!budgetData) return [];

    const months = ['enero', 'febrero', 'marzo'];
    const monthNames = ['Ene', 'Feb', 'Mar'];
    const year = currentDate.getFullYear();

    return months.map((month, idx) => {
      const budget = budgetData.totales[month] || 0;

      // Calculate actual for this month
      const monthNum = idx + 1;
      const monthStr = String(monthNum).padStart(2, '0');
      const yearMonthPrefix = `${year}-${monthStr}`;

      const monthGastos = gastos.filter(g => {
        const normalized = normalizeDate(g.fecha);
        return normalized.startsWith(yearMonthPrefix);
      });

      // Exclude "AJUSTE SALDO" from actual totals
      const actual = monthGastos
        .filter(g => g.categoria !== 'AJUSTE SALDO')
        .reduce((sum, g) => sum + g.importe, 0);

      return {
        month: monthNames[idx],
        presupuesto: budget,
        real: actual,
        diferencia: budget - actual,
      };
    });
  }, [budgetData, gastos, currentDate]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    return `$${(value / 1000).toFixed(0)}k`;
  };

  // Loading state
  if (isLoading && !budgetData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Presupuesto vs Real</h2>
          <p className="text-sm text-muted-foreground">
            Comparación de gastos operativos desde Google Sheets - {currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1)}
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
          Actualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Presupuesto {currentMonth}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totals.budgetTotal)}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Gasto Real</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totals.actualTotal)}</p>
        </div>

        <div className={cn(
          "rounded-xl border p-4",
          totals.difference >= 0
            ? "border-success/50 bg-success/10"
            : "border-destructive/50 bg-destructive/10"
        )}>
          <p className="text-sm text-muted-foreground">Diferencia</p>
          <div className="flex items-center gap-2 mt-1">
            {totals.difference >= 0 ? (
              <TrendingDown className="h-5 w-5 text-success" />
            ) : (
              <TrendingUp className="h-5 w-5 text-destructive" />
            )}
            <p className={cn(
              "text-2xl font-bold",
              totals.difference >= 0 ? "text-success" : "text-destructive"
            )}>
              {totals.difference >= 0 ? '-' : '+'}{formatCurrency(Math.abs(totals.difference))}
            </p>
          </div>
        </div>

        <div className={cn(
          "rounded-xl border p-4",
          totals.percentUsed <= 80 ? "border-success/50 bg-success/10" :
          totals.percentUsed <= 100 ? "border-warning/50 bg-warning/10" :
          "border-destructive/50 bg-destructive/10"
        )}>
          <p className="text-sm text-muted-foreground">% Ejecutado</p>
          <div className="flex items-center gap-2 mt-1">
            {totals.percentUsed <= 80 ? (
              <CheckCircle className="h-5 w-5 text-success" />
            ) : totals.percentUsed <= 100 ? (
              <AlertTriangle className="h-5 w-5 text-warning" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            )}
            <p className={cn(
              "text-2xl font-bold",
              totals.percentUsed <= 80 ? "text-success" :
              totals.percentUsed <= 100 ? "text-warning" :
              "text-destructive"
            )}>
              {totals.percentUsed.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Monthly Comparison Chart */}
      {monthlyComparison.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-4">Comparación Mensual</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyComparison} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                />
                <Legend />
                <Bar dataKey="presupuesto" name="Presupuesto" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="real" name="Real" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Category Breakdown - Custom Bar Style */}
      {comparisonData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-4">Desglose por Categoría - {currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1)}</h3>
          <div className="space-y-3">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b border-border">
              <div className="col-span-4">Categoría</div>
              <div className="col-span-5 text-center">Gastado</div>
              <div className="col-span-3 text-right">Presupuestado</div>
            </div>

            {/* Rows */}
            {comparisonData.map((row, index) => {
              const percentCapped = Math.min(row.percentUsed, 100);
              return (
                <div key={index} className="grid grid-cols-12 gap-2 items-center py-1">
                  {/* Category Name */}
                  <div className="col-span-4 text-sm text-foreground truncate" title={row.fullCategory}>
                    {row.fullCategory}
                  </div>

                  {/* Bar + Value + Percentage */}
                  <div className="col-span-5 flex items-center gap-2">
                    {/* Progress Bar Container */}
                    <div className="flex-1 relative">
                      <div className="h-6 bg-muted/50 rounded overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded transition-all duration-300",
                            row.status === 'over' ? "bg-red-400" :
                            row.status === 'warning' ? "bg-yellow-400" :
                            "bg-yellow-400"
                          )}
                          style={{ width: `${percentCapped}%` }}
                        />
                      </div>
                      {/* Value inside bar */}
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-xs font-medium text-foreground">
                          {row.real >= 1000000
                            ? `${(row.real / 1000000).toFixed(1).replace('.0', '')}M`
                            : row.real >= 1000
                              ? `${(row.real / 1000).toFixed(0)}K`
                              : row.real.toLocaleString()
                          }
                        </span>
                      </div>
                    </div>
                    {/* Percentage */}
                    <span className={cn(
                      "text-xs font-medium w-10 text-right",
                      row.status === 'over' ? "text-destructive" :
                      row.status === 'warning' ? "text-warning" :
                      "text-muted-foreground"
                    )}>
                      {Math.round(row.percentUsed)}%
                    </span>
                  </div>

                  {/* Budget */}
                  <div className="col-span-3 text-sm text-right text-muted-foreground">
                    {row.presupuesto >= 1000000
                      ? `${(row.presupuesto / 1000000).toFixed(1).replace('.0', '')}M`
                      : row.presupuesto >= 1000
                        ? `${(row.presupuesto / 1000).toFixed(0)}K`
                        : row.presupuesto.toLocaleString()
                    }
                  </div>
                </div>
              );
            })}

            {/* Total Row */}
            <div className="grid grid-cols-12 gap-2 items-center py-2 mt-2 border-t-2 border-border font-bold">
              <div className="col-span-4 text-sm text-foreground">TOTAL</div>
              <div className="col-span-5 flex items-center gap-2">
                <div className="flex-1 relative">
                  <div className="h-6 bg-muted/50 rounded overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded transition-all duration-300",
                        totals.percentUsed > 100 ? "bg-red-400" :
                        totals.percentUsed > 80 ? "bg-yellow-400" :
                        "bg-green-400"
                      )}
                      style={{ width: `${Math.min(totals.percentUsed, 100)}%` }}
                    />
                  </div>
                  <div className="absolute inset-0 flex items-center px-2">
                    <span className="text-xs font-bold text-foreground">
                      {totals.actualTotal >= 1000000
                        ? `${(totals.actualTotal / 1000000).toFixed(1)}M`
                        : `${(totals.actualTotal / 1000).toFixed(0)}K`
                      }
                    </span>
                  </div>
                </div>
                <span className={cn(
                  "text-xs font-bold w-10 text-right",
                  totals.percentUsed > 100 ? "text-destructive" :
                  totals.percentUsed > 80 ? "text-warning" :
                  "text-success"
                )}>
                  {Math.round(totals.percentUsed)}%
                </span>
              </div>
              <div className="col-span-3 text-sm text-right text-muted-foreground">
                {totals.budgetTotal >= 1000000
                  ? `${(totals.budgetTotal / 1000000).toFixed(1)}M`
                  : `${(totals.budgetTotal / 1000).toFixed(0)}K`
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Table */}
      {comparisonData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-4">Detalle de Ejecución</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Categoría</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Presupuesto</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Real</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Diferencia</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">% Usado</th>
                  <th className="text-center py-3 px-2 font-medium text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, index) => (
                  <tr key={index} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-2 text-foreground" title={row.fullCategory}>{row.category}</td>
                    <td className="py-3 px-2 text-right text-muted-foreground">${row.presupuesto.toLocaleString()}</td>
                    <td className="py-3 px-2 text-right text-foreground font-medium">${row.real.toLocaleString()}</td>
                    <td className={cn(
                      "py-3 px-2 text-right font-medium",
                      row.diferencia >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {row.diferencia >= 0 ? '-' : '+'}${Math.abs(row.diferencia).toLocaleString()}
                    </td>
                    <td className={cn(
                      "py-3 px-2 text-right font-medium",
                      row.percentUsed <= 80 ? "text-success" :
                      row.percentUsed <= 100 ? "text-warning" :
                      "text-destructive"
                    )}>
                      {row.percentUsed.toFixed(1)}%
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className={cn(
                        "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                        row.status === 'over' ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                        row.status === 'warning' ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      )}>
                        {row.status === 'over' ? 'Sobre presupuesto' : row.status === 'warning' ? 'Cerca del límite' : 'Dentro del presupuesto'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Card */}
      {comparisonData.length === 0 && !isLoading && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Datos desde Google Sheets</h3>
              <p className="text-sm text-muted-foreground">
                El presupuesto se carga desde la hoja "Presupuesto" de Google Sheets.
                Asegúrate de que la hoja exista y tenga el formato correcto: Columna A = Categoría, Columnas B-D = Meses (Enero-Marzo).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
