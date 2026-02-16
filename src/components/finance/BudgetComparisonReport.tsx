import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, RefreshCw, Target, Calendar } from 'lucide-react';
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

// New budget data structure from Presupuesto Q1
interface BudgetQ1Data {
  ingresos: {
    categorias: Record<string, { proyectado: number; real: number }>;
    totales: {
      enero: { proyectado: number; real: number };
      febrero: { proyectado: number; real: number };
      marzo: { proyectado: number; real: number };
    };
  };
  gastos: {
    categorias: Record<string, {
      enero: { proyectado: number; real: number };
      febrero: { proyectado: number; real: number };
      marzo: { proyectado: number; real: number };
    }>;
    totales: {
      enero: { proyectado: number; real: number };
      febrero: { proyectado: number; real: number };
      marzo: { proyectado: number; real: number };
    };
  };
}

interface BudgetComparisonReportProps {
  gastos: Transaction[];
  ingresos: Transaction[];
}

type MonthKey = 'enero' | 'febrero' | 'marzo';

// Default values for safe access
const DEFAULT_MONTH_TOTALS = { proyectado: 0, real: 0 };

// Helper to normalize dates to YYYY-MM-DD for comparison
const normalizeDateStr = (dateStr: string): string => {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, part1, part2, year] = slashMatch;
    const num1 = parseInt(part1);
    if (num1 > 12) {
      return `${year}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`;
    }
    return `${year}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`;
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  } catch {}
  return dateStr;
};

export default function BudgetComparisonReport({ gastos, ingresos }: BudgetComparisonReportProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [budgetData, setBudgetData] = useState<BudgetQ1Data | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<MonthKey | 'q1'>('febrero');

  // Get current month for highlighting
  const currentDate = new Date();
  const currentMonthIndex = currentDate.getMonth(); // 0 = January

  // Map month index to month key
  const getMonthKey = (index: number): MonthKey | null => {
    if (index === 0) return 'enero';
    if (index === 1) return 'febrero';
    if (index === 2) return 'marzo';
    return null;
  };

  const currentMonthKey = getMonthKey(currentMonthIndex);

  // Current year for Q1 filtering
  const currentYear = currentDate.getFullYear();

  // Calculate real expense totals from actual transaction data (gastos prop)
  // grouped by category and month (Q1 current year: Jan, Feb, Mar)
  const realExpensesByCategory = useMemo(() => {
    const result: Record<string, { enero: number; febrero: number; marzo: number }> = {};
    const monthTotals = { enero: 0, febrero: 0, marzo: 0 };

    for (const t of gastos) {
      const normalized = normalizeDateStr(t.fecha);
      if (!normalized) continue;

      const [yearStr, monthStr] = normalized.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);

      // Only Q1 of current year
      if (year !== currentYear || month < 1 || month > 3) continue;

      const monthKey: MonthKey = month === 1 ? 'enero' : month === 2 ? 'febrero' : 'marzo';
      const cat = t.categoria?.trim();
      if (!cat) continue;

      // Skip AJUSTE SALDO and REEMBOLSO categories (not real expenses)
      const catUpper = cat.toUpperCase();
      if (catUpper === 'AJUSTE SALDO' || catUpper.includes('REEMBOLSO')) continue;

      if (!result[cat]) {
        result[cat] = { enero: 0, febrero: 0, marzo: 0 };
      }
      result[cat][monthKey] += t.importe;
      monthTotals[monthKey] += t.importe;
    }

    return { byCategory: result, totals: monthTotals };
  }, [gastos]);

  // Calculate real income totals from actual transaction data (ingresos prop)
  // grouped by month (Q1 current year: Jan, Feb, Mar)
  // Only count PAGO DE CLIENTE and FINANCIEROS as real income
  const realIncomeByMonth = useMemo(() => {
    const monthTotals = { enero: 0, febrero: 0, marzo: 0 };

    for (const t of ingresos) {
      const normalized = normalizeDateStr(t.fecha);
      if (!normalized) continue;

      const [yearStr, monthStr] = normalized.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);

      // Only Q1 of current year
      if (year !== currentYear || month < 1 || month > 3) continue;

      const monthKey: MonthKey = month === 1 ? 'enero' : month === 2 ? 'febrero' : 'marzo';
      const cat = t.categoria?.trim().toUpperCase();
      if (!cat) continue;

      // Only count PAGO DE CLIENTE and FINANCIEROS as real income (exclude REEMBOLSO, TRASLADOS, etc.)
      if (cat !== 'PAGO DE CLIENTE' && cat !== 'FINANCIEROS') continue;

      monthTotals[monthKey] += t.importe;
    }

    return monthTotals;
  }, [ingresos, currentYear]);

  // Fetch budget data from Google Sheets
  useEffect(() => {
    const fetchBudget = async () => {
      try {
        setIsLoading(true);
        const data = await apiClient.get<BudgetQ1Data>('/api/finance/budget');
        setBudgetData(data);
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
  }, [toast]);

  // Calculate Q1 totals - proyectado from budget sheet, real from actual transactions
  const q1Totals = useMemo(() => {
    if (!budgetData?.gastos?.totales) return { proyectado: 0, real: 0, percentUsed: 0 };

    const totales = budgetData.gastos.totales;
    const enero = totales.enero || DEFAULT_MONTH_TOTALS;
    const febrero = totales.febrero || DEFAULT_MONTH_TOTALS;
    const marzo = totales.marzo || DEFAULT_MONTH_TOTALS;

    const proyectado = enero.proyectado + febrero.proyectado + marzo.proyectado;
    // Use REAL transaction data instead of stale sheet values
    const real = realExpensesByCategory.totals.enero + realExpensesByCategory.totals.febrero + realExpensesByCategory.totals.marzo;
    const percentUsed = proyectado > 0 ? (real / proyectado) * 100 : 0;

    return { proyectado, real, percentUsed };
  }, [budgetData, realExpensesByCategory]);

  // Monthly comparison data for chart - real from transactions
  const monthlyComparisonData = useMemo(() => {
    if (!budgetData?.gastos?.totales) return [];

    const months: { key: MonthKey; name: string }[] = [
      { key: 'enero', name: 'Enero' },
      { key: 'febrero', name: 'Febrero' },
      { key: 'marzo', name: 'Marzo' },
    ];

    return months.map(({ key, name }) => {
      const totales = budgetData.gastos.totales[key] || DEFAULT_MONTH_TOTALS;
      const real = realExpensesByCategory.totals[key];
      const percentUsed = totales.proyectado > 0 ? (real / totales.proyectado) * 100 : 0;

      return {
        month: name,
        monthKey: key,
        proyectado: totales.proyectado,
        real,
        diferencia: totales.proyectado - real,
        percentUsed,
        isCurrent: key === currentMonthKey,
      };
    });
  }, [budgetData, currentMonthKey, realExpensesByCategory]);

  // Category breakdown for selected month or Q1 - real from actual transactions
  const categoryBreakdown = useMemo(() => {
    if (!budgetData?.gastos?.categorias) return [];

    const categories = budgetData.gastos.categorias;

    // Build a lookup for real transaction data by category
    // We need to match budget category names to transaction category names
    const realByCategory = realExpensesByCategory.byCategory;

    // Helper: find the best matching real category for a budget category
    const findRealForCategory = (budgetCat: string): { enero: number; febrero: number; marzo: number } => {
      // Exact match first
      if (realByCategory[budgetCat]) return realByCategory[budgetCat];

      // Case-insensitive match
      const budgetUpper = budgetCat.toUpperCase().trim();
      for (const [realCat, values] of Object.entries(realByCategory)) {
        if (realCat.toUpperCase().trim() === budgetUpper) return values;
      }

      // Partial/contains match (budget category name contained in real category or vice versa)
      for (const [realCat, values] of Object.entries(realByCategory)) {
        const realUpper = realCat.toUpperCase().trim();
        if (realUpper.includes(budgetUpper) || budgetUpper.includes(realUpper)) return values;
      }

      return { enero: 0, febrero: 0, marzo: 0 };
    };

    return Object.entries(categories).map(([categoria, data]) => {
      let proyectado: number;

      const enero = data?.enero || DEFAULT_MONTH_TOTALS;
      const febrero = data?.febrero || DEFAULT_MONTH_TOTALS;
      const marzo = data?.marzo || DEFAULT_MONTH_TOTALS;

      const realData = findRealForCategory(categoria);

      let real: number;
      if (selectedMonth === 'q1') {
        proyectado = enero.proyectado + febrero.proyectado + marzo.proyectado;
        real = realData.enero + realData.febrero + realData.marzo;
      } else {
        const monthData = data?.[selectedMonth] || DEFAULT_MONTH_TOTALS;
        proyectado = monthData.proyectado;
        real = realData[selectedMonth];
      }

      const diferencia = proyectado - real;
      const percentUsed = proyectado > 0 ? (real / proyectado) * 100 : (real > 0 ? 100 : 0);
      const status = percentUsed > 100 ? 'over' : percentUsed > 80 ? 'warning' : 'ok';

      return {
        categoria,
        proyectado,
        real,
        diferencia,
        percentUsed,
        status,
      };
    }).filter(item => {
      // Exclude calculated result rows - not actual expense categories
      const upperCategoria = item.categoria.toUpperCase();
      if (upperCategoria.includes('UTILIDAD')) return false;
      if (upperCategoria.includes('MARGEN')) return false;
      if (upperCategoria.includes('DIVIDENDO')) return false;
      if (upperCategoria.includes('RESERVA')) return false;
      if (upperCategoria.includes('TOTAL DAIRO')) return false;
      return item.proyectado > 0 || item.real > 0;
    }).sort((a, b) => b.proyectado - a.proyectado);
  }, [budgetData, selectedMonth, realExpensesByCategory]);

  // Selected period totals - real from transactions
  const selectedPeriodTotals = useMemo(() => {
    if (!budgetData?.gastos?.totales) return { proyectado: 0, real: 0, percentUsed: 0 };

    if (selectedMonth === 'q1') {
      return q1Totals;
    }

    const totales = budgetData.gastos.totales[selectedMonth] || DEFAULT_MONTH_TOTALS;
    const real = realExpensesByCategory.totals[selectedMonth];
    const percentUsed = totales.proyectado > 0 ? (real / totales.proyectado) * 100 : 0;

    return {
      proyectado: totales.proyectado,
      real,
      percentUsed,
    };
  }, [budgetData, selectedMonth, q1Totals, realExpensesByCategory]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    return `$${(value / 1000).toFixed(0)}k`;
  };

  const formatCurrencyFull = (value: number) => {
    return `$${value.toLocaleString()}`;
  };

  // Loading state
  if (isLoading && !budgetData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const periodLabels = {
    q1: `Q1 ${currentYear}`,
    enero: `Enero ${currentYear}`,
    febrero: `Febrero ${currentYear}`,
    marzo: `Marzo ${currentYear}`,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Presupuesto vs Real - Q1 {currentYear}</h2>
          <p className="text-sm text-muted-foreground">
            Comparación de gastos operativos desde Google Sheets (Presupuesto Q1)
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
          Actualizar
        </Button>
      </div>

      {/* Period Selector */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedMonth === 'q1' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedMonth('q1')}
        >
          <Target className="h-4 w-4 mr-1" />
          Q1 Completo
        </Button>
        {(['enero', 'febrero', 'marzo'] as MonthKey[]).map((month) => (
          <Button
            key={month}
            variant={selectedMonth === month ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedMonth(month)}
            className={cn(month === currentMonthKey && selectedMonth !== month && 'border-primary')}
          >
            {month === currentMonthKey && <Calendar className="h-4 w-4 mr-1" />}
            {month.charAt(0).toUpperCase() + month.slice(1)}
          </Button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Presupuesto {periodLabels[selectedMonth]}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(selectedPeriodTotals.proyectado)}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatCurrencyFull(selectedPeriodTotals.proyectado)}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Gasto Real</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(selectedPeriodTotals.real)}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatCurrencyFull(selectedPeriodTotals.real)}</p>
        </div>

        <div className={cn(
          "rounded-xl border p-4",
          (selectedPeriodTotals.proyectado - selectedPeriodTotals.real) >= 0
            ? "border-success/50 bg-success/10"
            : "border-destructive/50 bg-destructive/10"
        )}>
          <p className="text-sm text-muted-foreground">Diferencia</p>
          <div className="flex items-center gap-2 mt-1">
            {(selectedPeriodTotals.proyectado - selectedPeriodTotals.real) >= 0 ? (
              <TrendingDown className="h-5 w-5 text-success" />
            ) : (
              <TrendingUp className="h-5 w-5 text-destructive" />
            )}
            <p className={cn(
              "text-2xl font-bold",
              (selectedPeriodTotals.proyectado - selectedPeriodTotals.real) >= 0 ? "text-success" : "text-destructive"
            )}>
              {(selectedPeriodTotals.proyectado - selectedPeriodTotals.real) >= 0 ? '-' : '+'}
              {formatCurrency(Math.abs(selectedPeriodTotals.proyectado - selectedPeriodTotals.real))}
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {(selectedPeriodTotals.proyectado - selectedPeriodTotals.real) >= 0 ? 'Ahorro' : 'Exceso'}
          </p>
        </div>

        <div className={cn(
          "rounded-xl border p-4",
          selectedPeriodTotals.percentUsed <= 80 ? "border-success/50 bg-success/10" :
          selectedPeriodTotals.percentUsed <= 100 ? "border-warning/50 bg-warning/10" :
          "border-destructive/50 bg-destructive/10"
        )}>
          <p className="text-sm text-muted-foreground">% Ejecutado</p>
          <div className="flex items-center gap-2 mt-1">
            {selectedPeriodTotals.percentUsed <= 80 ? (
              <CheckCircle className="h-5 w-5 text-success" />
            ) : selectedPeriodTotals.percentUsed <= 100 ? (
              <AlertTriangle className="h-5 w-5 text-warning" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            )}
            <p className={cn(
              "text-2xl font-bold",
              selectedPeriodTotals.percentUsed <= 80 ? "text-success" :
              selectedPeriodTotals.percentUsed <= 100 ? "text-warning" :
              "text-destructive"
            )}>
              {selectedPeriodTotals.percentUsed.toFixed(1)}%
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedPeriodTotals.percentUsed <= 100
              ? `Disponible: ${(100 - selectedPeriodTotals.percentUsed).toFixed(1)}%`
              : `Excedido: ${(selectedPeriodTotals.percentUsed - 100).toFixed(1)}%`
            }
          </p>
        </div>
      </div>

      {/* Monthly Comparison Chart */}
      {monthlyComparisonData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-4">Comparación Mensual Q1</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyComparisonData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                  formatter={(value: number, name: string) => [
                    `$${value.toLocaleString()}`,
                    name === 'proyectado' ? 'Presupuesto' : 'Real'
                  ]}
                />
                <Legend
                  formatter={(value) => value === 'proyectado' ? 'Presupuesto' : 'Real'}
                />
                <Bar dataKey="proyectado" name="proyectado" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="real" name="real" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            {monthlyComparisonData.map((month) => (
              <div
                key={month.monthKey}
                className={cn(
                  "p-3 rounded-lg border",
                  month.isCurrent && "ring-2 ring-primary",
                  month.percentUsed <= 80 ? "bg-success/5 border-success/20" :
                  month.percentUsed <= 100 ? "bg-warning/5 border-warning/20" :
                  "bg-destructive/5 border-destructive/20"
                )}
              >
                <p className="text-sm font-medium text-foreground">{month.month}</p>
                <p className={cn(
                  "text-lg font-bold mt-1",
                  month.percentUsed <= 80 ? "text-success" :
                  month.percentUsed <= 100 ? "text-warning" :
                  "text-destructive"
                )}>
                  {month.percentUsed.toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(month.real)} / {formatCurrency(month.proyectado)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {categoryBreakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-4">
            Desglose por Categoría - {periodLabels[selectedMonth]}
          </h3>
          <div className="space-y-3">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b border-border">
              <div className="col-span-4">Categoría</div>
              <div className="col-span-5 text-center">Ejecutado</div>
              <div className="col-span-3 text-right">Presupuesto</div>
            </div>

            {/* Rows */}
            {categoryBreakdown.map((row, index) => {
              const percentCapped = Math.min(row.percentUsed, 100);
              return (
                <div key={index} className="grid grid-cols-12 gap-2 items-center py-1">
                  {/* Category Name */}
                  <div className="col-span-4 text-sm text-foreground truncate" title={row.categoria}>
                    {row.categoria}
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
                            "bg-green-400"
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
                      "text-success"
                    )}>
                      {Math.round(row.percentUsed)}%
                    </span>
                  </div>

                  {/* Budget */}
                  <div className="col-span-3 text-sm text-right text-muted-foreground">
                    {row.proyectado >= 1000000
                      ? `${(row.proyectado / 1000000).toFixed(1).replace('.0', '')}M`
                      : row.proyectado >= 1000
                        ? `${(row.proyectado / 1000).toFixed(0)}K`
                        : row.proyectado.toLocaleString()
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
                        selectedPeriodTotals.percentUsed > 100 ? "bg-red-400" :
                        selectedPeriodTotals.percentUsed > 80 ? "bg-yellow-400" :
                        "bg-green-400"
                      )}
                      style={{ width: `${Math.min(selectedPeriodTotals.percentUsed, 100)}%` }}
                    />
                  </div>
                  <div className="absolute inset-0 flex items-center px-2">
                    <span className="text-xs font-bold text-foreground">
                      {selectedPeriodTotals.real >= 1000000
                        ? `${(selectedPeriodTotals.real / 1000000).toFixed(1)}M`
                        : `${(selectedPeriodTotals.real / 1000).toFixed(0)}K`
                      }
                    </span>
                  </div>
                </div>
                <span className={cn(
                  "text-xs font-bold w-10 text-right",
                  selectedPeriodTotals.percentUsed > 100 ? "text-destructive" :
                  selectedPeriodTotals.percentUsed > 80 ? "text-warning" :
                  "text-success"
                )}>
                  {Math.round(selectedPeriodTotals.percentUsed)}%
                </span>
              </div>
              <div className="col-span-3 text-sm text-right text-muted-foreground">
                {selectedPeriodTotals.proyectado >= 1000000
                  ? `${(selectedPeriodTotals.proyectado / 1000000).toFixed(1)}M`
                  : `${(selectedPeriodTotals.proyectado / 1000).toFixed(0)}K`
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Table */}
      {categoryBreakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-4">Detalle de Ejecución - {periodLabels[selectedMonth]}</h3>
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
                {categoryBreakdown.map((row, index) => (
                  <tr key={index} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-2 text-foreground">{row.categoria}</td>
                    <td className="py-3 px-2 text-right text-muted-foreground">${row.proyectado.toLocaleString()}</td>
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
                        {row.status === 'over' ? 'Excedido' : row.status === 'warning' ? 'Alerta' : 'OK'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empresa y Dividendo Section */}
      {budgetData?.gastos?.categorias && (() => {
        const dividendoCategories = Object.entries(budgetData.gastos.categorias)
          .filter(([cat]) => {
            const upper = cat.toUpperCase();
            return upper.includes('DIVIDENDO') || upper.includes('RESERVA') || upper.includes('TOTAL DAIRO');
          })
          .map(([categoria, data]) => {
            const enero = data?.enero || DEFAULT_MONTH_TOTALS;
            const febrero = data?.febrero || DEFAULT_MONTH_TOTALS;
            const marzo = data?.marzo || DEFAULT_MONTH_TOTALS;

            let proyectado: number;
            let real: number;

            if (selectedMonth === 'q1') {
              proyectado = enero.proyectado + febrero.proyectado + marzo.proyectado;
              real = enero.real + febrero.real + marzo.real;
            } else {
              const monthData = data?.[selectedMonth] || DEFAULT_MONTH_TOTALS;
              proyectado = monthData.proyectado;
              real = monthData.real;
            }

            return { categoria, proyectado, real };
          })
          .filter(item => item.proyectado > 0 || item.real > 0);

        if (dividendoCategories.length === 0) return null;

        return (
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-foreground mb-4">
              Empresa y Dividendo (75% Reserva) - {periodLabels[selectedMonth]}
            </h3>
            <div className="space-y-3">
              {dividendoCategories.map((item) => {
                const percentUsed = item.proyectado > 0 ? (item.real / item.proyectado) * 100 : 0;
                return (
                  <div key={item.categoria} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="text-sm text-foreground">{item.categoria}</span>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">${item.real.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">de ${item.proyectado.toLocaleString()}</p>
                      </div>
                      <span className={cn(
                        "text-xs font-medium px-2 py-1 rounded-full",
                        percentUsed > 100 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                        percentUsed > 80 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      )}>
                        {percentUsed.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Info Card */}
      {categoryBreakdown.length === 0 && !isLoading && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Datos desde Google Sheets</h3>
              <p className="text-sm text-muted-foreground">
                El presupuesto se carga desde la hoja "Presupuesto Q1" de Google Sheets.
                Estructura: Columna A = Categoría, B-C = Enero (Proy/Real), D-E = Febrero (Proy/Real), F-G = Marzo (Proy/Real).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
