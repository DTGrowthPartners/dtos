import { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, DollarSign, Users, Tag, ArrowUpRight, Calendar as CalendarIcon, Target, CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { DateRange } from 'react-day-picker';

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
    categorias: Record<string, { enero: { proyectado: number; real: number }; febrero: { proyectado: number; real: number }; marzo: { proyectado: number; real: number } }>;
    totales: {
      enero: { proyectado: number; real: number };
      febrero: { proyectado: number; real: number };
      marzo: { proyectado: number; real: number };
    };
  };
}

const isExcluded = (categoria: string | undefined | null): boolean => {
  if (!categoria) return false;
  const upper = categoria.trim().toUpperCase();
  return upper === 'AJUSTE SALDO' || upper === 'RESERVAS' || upper.startsWith('TRASLADO') || upper.startsWith('REEMBOLSO');
};

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

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTH_NAMES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const MONTH_TO_BUDGET_KEY: Record<string, 'enero' | 'febrero' | 'marzo'> = {
  '01': 'enero',
  '02': 'febrero',
  '03': 'marzo',
};

const fmt = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type FilterMode = 'all' | 'month' | 'custom';

export default function IncomeReport({ ingresos }: IncomeReportProps) {
  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [budgetData, setBudgetData] = useState<BudgetQ1Data | null>(null);

  useEffect(() => {
    const fetchBudget = async () => {
      try {
        const data = await apiClient.get<BudgetQ1Data>('/api/finance/budget');
        setBudgetData(data);
      } catch (error) {
        console.error('Error fetching budget data:', error);
      }
    };
    fetchBudget();
  }, []);

  const realIncome = useMemo(() => {
    return ingresos.filter(t => !isExcluded(t.categoria));
  }, [ingresos]);

  const availableMonths = useMemo(() => {
    const monthCounts = new Map<string, number>();
    realIncome.forEach(t => {
      const normalized = normalizeDate(t.fecha);
      if (normalized && /^\d{4}-\d{2}/.test(normalized)) {
        const monthKey = normalized.substring(0, 7);
        monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + 1);
      }
    });
    return Array.from(monthCounts.entries())
      .filter(([, count]) => count > 0)
      .map(([key]) => key)
      .sort();
  }, [realIncome]);

  useEffect(() => {
    if (selectedMonth === null && availableMonths.length > 0) {
      const currentDate = new Date();
      const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      if (availableMonths.includes(currentMonthKey)) {
        setSelectedMonth(currentMonthKey);
      } else {
        setSelectedMonth(availableMonths[availableMonths.length - 1]);
      }
    }
  }, [availableMonths, selectedMonth]);

  const filteredIncome = useMemo(() => {
    if (filterMode === 'all') return realIncome;
    if (filterMode === 'month' && selectedMonth) {
      return realIncome.filter(t => normalizeDate(t.fecha).startsWith(selectedMonth));
    }
    if (filterMode === 'custom' && dateRange?.from) {
      const fromStr = `${dateRange.from.getFullYear()}-${String(dateRange.from.getMonth() + 1).padStart(2, '0')}-${String(dateRange.from.getDate()).padStart(2, '0')}`;
      const toDate = dateRange.to || dateRange.from;
      const toStr = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;
      return realIncome.filter(t => {
        const normalized = normalizeDate(t.fecha);
        return normalized >= fromStr && normalized <= toStr;
      });
    }
    return realIncome;
  }, [realIncome, filterMode, selectedMonth, dateRange]);

  const handleMonthClick = (monthKey: string) => { setFilterMode('month'); setSelectedMonth(monthKey); setDateRange(undefined); };
  const handleAllClick = () => { setFilterMode('all'); setSelectedMonth(null); setDateRange(undefined); };
  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from) { setFilterMode('custom'); setSelectedMonth(null); }
    if (range?.from && range?.to) { setTimeout(() => setIsCalendarOpen(false), 300); }
  };

  const formatDate = (date: Date): string => `${date.getDate()} ${MONTH_NAMES_SHORT[date.getMonth()]} ${date.getFullYear()}`;

  const budgetProjection = useMemo(() => {
    if (!budgetData?.ingresos?.totales) return { proyectado: 0, ejecutado: 0, porcentaje: 0 };
    const ejecutado = filteredIncome.reduce((sum, t) => sum + t.importe, 0);
    if (filterMode === 'month' && selectedMonth) {
      const monthNum = selectedMonth.split('-')[1];
      const budgetKey = MONTH_TO_BUDGET_KEY[monthNum];
      if (budgetKey && budgetData.ingresos.totales[budgetKey]) {
        const proyectado = budgetData.ingresos.totales[budgetKey].proyectado;
        const porcentaje = proyectado > 0 ? (ejecutado / proyectado) * 100 : 0;
        return { proyectado, ejecutado, porcentaje };
      }
    } else {
      const totales = budgetData.ingresos.totales;
      const proyectado = (totales.enero?.proyectado || 0) + (totales.febrero?.proyectado || 0) + (totales.marzo?.proyectado || 0);
      const porcentaje = proyectado > 0 ? (ejecutado / proyectado) * 100 : 0;
      return { proyectado, ejecutado, porcentaje };
    }
    return { proyectado: 0, ejecutado: 0, porcentaje: 0 };
  }, [budgetData, filterMode, selectedMonth, filteredIncome]);

  const incomeByCategory = useMemo(() => {
    const categoryMap = new Map<string, number>();
    filteredIncome.forEach(t => { if (t.categoria) { categoryMap.set(t.categoria, (categoryMap.get(t.categoria) || 0) + t.importe); } });
    const colors = ['hsl(var(--success))', 'hsl(var(--primary))', 'hsl(var(--warning))', '#8884d8', '#82ca9d', '#ffc658', '#ff7c43', '#665191'];
    return Array.from(categoryMap.entries())
      .map(([name, value], index) => ({ name, value, color: colors[index % colors.length] }))
      .sort((a, b) => b.value - a.value);
  }, [filteredIncome]);

  const incomeByEntity = useMemo(() => {
    const entityMap = new Map<string, { total: number; count: number }>();
    filteredIncome.forEach(t => {
      if (t.entidad) {
        const current = entityMap.get(t.entidad) || { total: 0, count: 0 };
        entityMap.set(t.entidad, { total: current.total + t.importe, count: current.count + 1 });
      }
    });
    return Array.from(entityMap.entries())
      .map(([name, data]) => ({ name: name.length > 25 ? name.substring(0, 25) + '...' : name, fullName: name, total: data.total, count: data.count, average: data.total / data.count }))
      .sort((a, b) => b.total - a.total).slice(0, 10);
  }, [filteredIncome]);

  const monthlyIncome = useMemo(() => {
    const monthlyData = new Map<string, number>();
    realIncome.forEach(t => {
      const normalized = normalizeDate(t.fecha);
      if (normalized && /^\d{4}-\d{2}/.test(normalized)) {
        const monthKey = normalized.substring(0, 7);
        monthlyData.set(monthKey, (monthlyData.get(monthKey) || 0) + t.importe);
      }
    });
    return Array.from(monthlyData.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-6)
      .map(([monthKey, total]) => { const [year, month] = monthKey.split('-'); return { month: `${MONTH_NAMES_SHORT[parseInt(month) - 1]} ${year.slice(2)}`, ingresos: total }; });
  }, [realIncome]);

  const stats = useMemo(() => {
    const total = filteredIncome.reduce((sum, t) => sum + t.importe, 0);
    const count = filteredIncome.length;
    const average = count > 0 ? total / count : 0;
    return { total, count, average, topCategory: incomeByCategory[0]?.name || 'N/A', topCategoryAmount: incomeByCategory[0]?.value || 0, topClient: incomeByEntity[0]?.fullName || 'N/A', topClientAmount: incomeByEntity[0]?.total || 0 };
  }, [filteredIncome, incomeByCategory, incomeByEntity]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${fmt(value)}`;
  };

  const getFilterDisplayName = (): string => {
    if (filterMode === 'all') return 'Q1 2026';
    if (filterMode === 'month' && selectedMonth) { const [year, month] = selectedMonth.split('-'); return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`; }
    if (filterMode === 'custom' && dateRange?.from) { return `${formatDate(dateRange.from)} - ${dateRange.to ? formatDate(dateRange.to) : formatDate(dateRange.from)}`; }
    return 'Todos los meses';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Reporte de Ingresos</h2>
        <p className="text-sm text-muted-foreground">Análisis de entradas de dinero - {getFilterDisplayName()}</p>
      </div>

      {availableMonths.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleAllClick} className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors", filterMode === 'all' ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
            <CalendarIcon className="h-3.5 w-3.5" /> Q1 Completo
          </button>
          {availableMonths.map((monthKey) => {
            const [, month] = monthKey.split('-');
            return (
              <button key={monthKey} onClick={() => handleMonthClick(monthKey)} className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors", filterMode === 'month' && selectedMonth === monthKey ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                <CalendarIcon className="h-3.5 w-3.5" /> {MONTH_NAMES[parseInt(month) - 1]}
              </button>
            );
          })}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <button className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors", filterMode === 'custom' ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                <CalendarRange className="h-3.5 w-3.5" />
                {filterMode === 'custom' && dateRange?.from ? `${formatDate(dateRange.from)}${dateRange.to ? ` - ${formatDate(dateRange.to)}` : ''}` : 'Rango personalizado'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="range" selected={dateRange} onSelect={handleDateRangeSelect} numberOfMonths={2} defaultMonth={new Date(2026, 0)} />
            </PopoverContent>
          </Popover>
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10"><DollarSign className="h-5 w-5 text-success" /></div>
            <div>
              <p className="text-sm text-muted-foreground">{filterMode === 'month' ? 'Ingresos del Mes' : 'Ingresos del Período'}</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.total)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Target className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Proyección de Ingresos</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(budgetProjection.proyectado)}</p>
              {budgetProjection.proyectado > 0 && (
                <p className={cn("text-xs flex items-center gap-1", budgetProjection.porcentaje >= 100 ? "text-success" : budgetProjection.porcentaje >= 70 ? "text-warning" : "text-destructive")}>
                  <ArrowUpRight className={cn("h-3 w-3", budgetProjection.porcentaje < 100 && "rotate-90")} />
                  {budgetProjection.porcentaje.toFixed(1)}% ejecutado
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10"><Tag className="h-5 w-5 text-warning" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Top Categoría</p>
              <p className="text-lg font-bold text-foreground truncate" title={stats.topCategory}>{stats.topCategory.length > 15 ? stats.topCategory.substring(0, 15) + '...' : stats.topCategory}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(stats.topCategoryAmount)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10"><Users className="h-5 w-5 text-chart-4" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Top Cliente</p>
              <p className="text-lg font-bold text-foreground truncate" title={stats.topClient}>{stats.topClient.length > 15 ? stats.topClient.substring(0, 15) + '...' : stats.topClient}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(stats.topClientAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-4">Ingresos por Categoría</h3>
          {incomeByCategory.length > 0 ? (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={incomeByCategory} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                      {incomeByCategory.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(value: number) => [`$${fmt(value)}`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">
                {incomeByCategory.slice(0, 5).map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0 flex-1"><div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} /><span className="text-muted-foreground truncate">{cat.name}</span></div>
                    <span className="font-medium text-foreground whitespace-nowrap ml-2">${fmt(cat.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (<div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No hay datos de ingresos por categoría</div>)}
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-4">Tendencia Mensual de Ingresos</h3>
          {monthlyIncome.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyIncome} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(value: number) => [`$${fmt(value)}`, 'Ingresos']} />
                  <Bar dataKey="ingresos" name="Ingresos" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (<div className="flex items-center justify-center h-64 text-muted-foreground text-sm">No hay datos de tendencia mensual</div>)}
        </div>
      </div>

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
                      <td className="py-3 px-2 text-right font-medium text-success">${fmt(entity.total)}</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">{entity.count}</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">${fmt(Math.round(entity.average))}</td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-success rounded-full" style={{ width: `${Math.min(percentage, 100)}%` }} /></div>
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
                  <td className="py-3 px-2 text-right text-success">${fmt(stats.total)}</td>
                  <td className="py-3 px-2 text-right text-muted-foreground">{stats.count}</td>
                  <td className="py-3 px-2 text-right text-muted-foreground">${fmt(Math.round(stats.average))}</td>
                  <td className="py-3 px-2 text-right text-muted-foreground">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-4">Resumen Estadístico</h3>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          <div className="text-center p-4 rounded-lg bg-success/5 border border-success/20"><p className="text-sm text-muted-foreground">Total Ingresos</p><p className="text-xl font-bold text-success mt-1">{formatCurrency(stats.total)}</p></div>
          <div className="text-center p-4 rounded-lg bg-primary/5 border border-primary/20"><p className="text-sm text-muted-foreground">Transacciones</p><p className="text-xl font-bold text-primary mt-1">{stats.count}</p></div>
          <div className="text-center p-4 rounded-lg bg-warning/5 border border-warning/20"><p className="text-sm text-muted-foreground">Promedio</p><p className="text-xl font-bold text-warning mt-1">{formatCurrency(stats.average)}</p></div>
          <div className="text-center p-4 rounded-lg bg-chart-4/5 border border-chart-4/20"><p className="text-sm text-muted-foreground">Clientes Únicos</p><p className="text-xl font-bold text-chart-4 mt-1">{incomeByEntity.length}</p></div>
        </div>
      </div>

      {filteredIncome.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 flex-shrink-0"><TrendingUp className="h-5 w-5 text-success" /></div>
            <div><h3 className="font-semibold text-foreground mb-2">Sin Datos de Ingresos</h3><p className="text-sm text-muted-foreground">No hay ingresos registrados en el período seleccionado.</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
