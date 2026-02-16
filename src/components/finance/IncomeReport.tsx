import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, DollarSign, Users, Tag, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Transaction {
  fecha: string;
  importe: number;
  descripcion: string;
  categoria: string;
  cuenta: string;
  entidad: string;
}

interface IncomeReportProps {
  ingresos: Transaction[];
}

// Helper to check if a category is AJUSTE SALDO (case-insensitive)
const isAjusteSaldo = (categoria: string | undefined | null): boolean => {
  if (!categoria) return false;
  return categoria.trim().toUpperCase() === 'AJUSTE SALDO';
};

// Helper to check if a category is a transfer (TRASLADO)
const isTransfer = (categoria: string | undefined | null): boolean => {
  if (!categoria) return false;
  const upper = categoria.trim().toUpperCase();
  return upper.startsWith('TRASLADO');
};

// Helper to check if a category is REEMBOLSO (should not appear in reports)
const isReembolso = (categoria: string | undefined | null): boolean => {
  if (!categoria) return false;
  const upper = categoria.trim().toUpperCase();
  return upper.includes('REEMBOLSO');
};

export default function IncomeReport({ ingresos }: IncomeReportProps) {
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

  // Filter out AJUSTE SALDO, transfers, and REEMBOLSO for real income analysis
  const realIncome = useMemo(() => {
    return ingresos.filter(t =>
      !isAjusteSaldo(t.categoria) &&
      !isTransfer(t.categoria) &&
      !isReembolso(t.categoria)
    );
  }, [ingresos]);

  // Income by category
  const incomeByCategory = useMemo(() => {
    const categoryMap = new Map<string, number>();

    realIncome.forEach(t => {
      if (t.categoria) {
        const current = categoryMap.get(t.categoria) || 0;
        categoryMap.set(t.categoria, current + t.importe);
      }
    });

    const colors = [
      'hsl(var(--success))',
      'hsl(var(--primary))',
      'hsl(var(--warning))',
      '#8884d8',
      '#82ca9d',
      '#ffc658',
      '#ff7c43',
      '#665191',
    ];

    return Array.from(categoryMap.entries())
      .map(([name, value], index) => ({
        name,
        value,
        color: colors[index % colors.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [realIncome]);

  // Income by entity/client
  const incomeByEntity = useMemo(() => {
    const entityMap = new Map<string, { total: number; count: number }>();

    realIncome.forEach(t => {
      if (t.entidad) {
        const current = entityMap.get(t.entidad) || { total: 0, count: 0 };
        entityMap.set(t.entidad, {
          total: current.total + t.importe,
          count: current.count + 1
        });
      }
    });

    return Array.from(entityMap.entries())
      .map(([name, data]) => ({
        name: name.length > 25 ? name.substring(0, 25) + '...' : name,
        fullName: name,
        total: data.total,
        count: data.count,
        average: data.total / data.count,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [realIncome]);

  // Monthly income trend
  const monthlyIncome = useMemo(() => {
    const monthlyData = new Map<string, number>();

    realIncome.forEach(t => {
      const normalized = normalizeDate(t.fecha);
      if (normalized) {
        const monthKey = normalized.substring(0, 7); // YYYY-MM
        const current = monthlyData.get(monthKey) || 0;
        monthlyData.set(monthKey, current + t.importe);
      }
    });

    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    return Array.from(monthlyData.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6) // Last 6 months
      .map(([monthKey, total]) => {
        const [year, month] = monthKey.split('-');
        const monthIndex = parseInt(month) - 1;
        return {
          month: `${monthNames[monthIndex]} ${year.slice(2)}`,
          ingresos: total,
        };
      });
  }, [realIncome]);

  // Calculate totals and stats
  const stats = useMemo(() => {
    const total = realIncome.reduce((sum, t) => sum + t.importe, 0);
    const count = realIncome.length;
    const average = count > 0 ? total / count : 0;
    const topCategory = incomeByCategory[0]?.name || 'N/A';
    const topCategoryAmount = incomeByCategory[0]?.value || 0;
    const topClient = incomeByEntity[0]?.fullName || 'N/A';
    const topClientAmount = incomeByEntity[0]?.total || 0;

    // Current month income
    const currentDate = new Date();
    const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthIncome = realIncome
      .filter(t => normalizeDate(t.fecha).startsWith(currentMonthKey))
      .reduce((sum, t) => sum + t.importe, 0);

    // Previous month income
    const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const prevMonthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
    const prevMonthIncome = realIncome
      .filter(t => normalizeDate(t.fecha).startsWith(prevMonthKey))
      .reduce((sum, t) => sum + t.importe, 0);

    const monthGrowth = prevMonthIncome > 0
      ? ((currentMonthIncome - prevMonthIncome) / prevMonthIncome) * 100
      : 0;

    return {
      total,
      count,
      average,
      topCategory,
      topCategoryAmount,
      topClient,
      topClientAmount,
      currentMonthIncome,
      prevMonthIncome,
      monthGrowth,
    };
  }, [realIncome, incomeByCategory, incomeByEntity]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toLocaleString()}`;
  };

  const currentMonth = new Date().toLocaleString('es-ES', { month: 'long' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Reporte de Ingresos</h2>
        <p className="text-sm text-muted-foreground">
          Análisis de entradas de dinero - {currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1)}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ingresos Totales</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.total)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Este Mes</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.currentMonthIncome)}</p>
              {stats.monthGrowth !== 0 && (
                <p className={cn(
                  "text-xs flex items-center gap-1",
                  stats.monthGrowth >= 0 ? "text-success" : "text-destructive"
                )}>
                  <ArrowUpRight className={cn("h-3 w-3", stats.monthGrowth < 0 && "rotate-180")} />
                  {Math.abs(stats.monthGrowth).toFixed(1)}% vs mes anterior
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Tag className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Top Categoría</p>
              <p className="text-lg font-bold text-foreground truncate" title={stats.topCategory}>
                {stats.topCategory.length > 15 ? stats.topCategory.substring(0, 15) + '...' : stats.topCategory}
              </p>
              <p className="text-xs text-muted-foreground">{formatCurrency(stats.topCategoryAmount)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
              <Users className="h-5 w-5 text-chart-4" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Top Cliente</p>
              <p className="text-lg font-bold text-foreground truncate" title={stats.topClient}>
                {stats.topClient.length > 15 ? stats.topClient.substring(0, 15) + '...' : stats.topClient}
              </p>
              <p className="text-xs text-muted-foreground">{formatCurrency(stats.topClientAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Income by Category Pie Chart */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-4">Ingresos por Categoría</h3>
          {incomeByCategory.length > 0 ? (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={incomeByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {incomeByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">
                {incomeByCategory.slice(0, 5).map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-muted-foreground truncate">{cat.name}</span>
                    </div>
                    <span className="font-medium text-foreground whitespace-nowrap ml-2">${cat.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              No hay datos de ingresos por categoría
            </div>
          )}
        </div>

        {/* Monthly Income Trend */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-4">Tendencia Mensual de Ingresos</h3>
          {monthlyIncome.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyIncome} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Ingresos']}
                  />
                  <Bar dataKey="ingresos" name="Ingresos" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              No hay datos de tendencia mensual
            </div>
          )}
        </div>
      </div>

      {/* Income by Entity/Client Table */}
      {incomeByEntity.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-4">Ingresos por Cliente/Entidad</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Cliente/Entidad</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Total</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Transacciones</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Promedio</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">% del Total</th>
                </tr>
              </thead>
              <tbody>
                {incomeByEntity.map((entity, index) => {
                  const percentage = stats.total > 0 ? (entity.total / stats.total) * 100 : 0;
                  return (
                    <tr key={index} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-2 text-foreground" title={entity.fullName}>{entity.name}</td>
                      <td className="py-3 px-2 text-right font-medium text-success">${entity.total.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">{entity.count}</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">${Math.round(entity.average).toLocaleString()}</td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-success rounded-full"
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground w-12 text-right">{percentage.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-bold">
                  <td className="py-3 px-2 text-foreground">TOTAL</td>
                  <td className="py-3 px-2 text-right text-success">${stats.total.toLocaleString()}</td>
                  <td className="py-3 px-2 text-right text-muted-foreground">{stats.count}</td>
                  <td className="py-3 px-2 text-right text-muted-foreground">${Math.round(stats.average).toLocaleString()}</td>
                  <td className="py-3 px-2 text-right text-muted-foreground">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-4">Resumen Estadístico</h3>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          <div className="text-center p-4 rounded-lg bg-success/5 border border-success/20">
            <p className="text-sm text-muted-foreground">Total Ingresos</p>
            <p className="text-xl font-bold text-success mt-1">{formatCurrency(stats.total)}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-muted-foreground">Transacciones</p>
            <p className="text-xl font-bold text-primary mt-1">{stats.count}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-warning/5 border border-warning/20">
            <p className="text-sm text-muted-foreground">Promedio</p>
            <p className="text-xl font-bold text-warning mt-1">{formatCurrency(stats.average)}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-chart-4/5 border border-chart-4/20">
            <p className="text-sm text-muted-foreground">Clientes Únicos</p>
            <p className="text-xl font-bold text-chart-4 mt-1">{incomeByEntity.length}</p>
          </div>
        </div>
      </div>

      {/* Info Card */}
      {realIncome.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Sin Datos de Ingresos</h3>
              <p className="text-sm text-muted-foreground">
                No hay ingresos registrados en el período seleccionado.
                Los datos de ingresos se cargan desde la hoja "Entrada" de Google Sheets.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
