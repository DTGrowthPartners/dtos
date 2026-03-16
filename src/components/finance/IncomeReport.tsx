import { useState, useMemo, useEffect } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { TrendingUp, DollarSign, Users, Tag, ArrowUpRight, Calendar as CalendarIcon, Target, CalendarRange, AlertCircle } from 'lucide-react';
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

interface InvoiceData {
  id: string;
  servicio: string | null;
  concepto: string | null;
  totalAmount: number;
  status: string;
  clientName: string;
  fecha: string;
}

const fmt = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type FilterMode = 'all' | 'month' | 'custom';

export default function IncomeReport({ ingresos }: IncomeReportProps) {
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [budgetData, setBudgetData] = useState<BudgetQ1Data | null>(null);
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [budgetRes, invoicesRes] = await Promise.all([
          apiClient.get<BudgetQ1Data>('/api/finance/budget'),
          apiClient.get<InvoiceData[]>('/api/invoices').catch(() => [] as InvoiceData[]),
        ]);
        setBudgetData(budgetRes);
        setInvoices(invoicesRes);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
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

  const trendChartData = useMemo(() => {
    if (filterMode === 'all') {
      // Q1: group by month
      const monthlyData = new Map<string, number>();
      realIncome.forEach(t => {
        const normalized = normalizeDate(t.fecha);
        if (normalized && /^\d{4}-\d{2}/.test(normalized)) {
          const monthKey = normalized.substring(0, 7);
          monthlyData.set(monthKey, (monthlyData.get(monthKey) || 0) + t.importe);
        }
      });
      return Array.from(monthlyData.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-6)
        .map(([monthKey, total]) => {
          const [year, month] = monthKey.split('-');
          const budgetKey = MONTH_TO_BUDGET_KEY[month];
          const meta = budgetKey && budgetData?.ingresos?.totales?.[budgetKey]?.proyectado || 0;
          return { label: `${MONTH_NAMES_SHORT[parseInt(month) - 1]} ${year.slice(2)}`, ingresos: total, meta };
        });
    }

    if (filterMode === 'month' && selectedMonth) {
      // Single month: group by week
      const [yearStr, monthStr] = selectedMonth.split('-');
      const year = parseInt(yearStr);
      const monthIdx = parseInt(monthStr) - 1;
      const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
      const budgetKey = MONTH_TO_BUDGET_KEY[monthStr];
      const monthMeta = budgetKey && budgetData?.ingresos?.totales?.[budgetKey]?.proyectado || 0;

      const weeks: { label: string; startDay: number; endDay: number }[] = [];
      let dayStart = 1;
      while (dayStart <= daysInMonth) {
        const dayEnd = Math.min(dayStart + 6, daysInMonth);
        weeks.push({ label: `${dayStart}-${dayEnd} ${MONTH_NAMES_SHORT[monthIdx]}`, startDay: dayStart, endDay: dayEnd });
        dayStart = dayEnd + 1;
      }

      const weekMeta = weeks.length > 0 ? monthMeta / weeks.length : 0;

      return weeks.map(w => {
        let weekTotal = 0;
        for (let d = w.startDay; d <= w.endDay; d++) {
          const isoKey = `${year}-${monthStr}-${String(d).padStart(2, '0')}`;
          filteredIncome.forEach(t => {
            if (normalizeDate(t.fecha) === isoKey) weekTotal += t.importe;
          });
        }
        return { label: w.label, ingresos: weekTotal, meta: weekMeta };
      });
    }

    if (filterMode === 'custom' && dateRange?.from) {
      const from = dateRange.from;
      const to = dateRange.to || dateRange.from;
      const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      if (diffDays <= 14) {
        // Group by day
        const result: { label: string; ingresos: number; meta: number }[] = [];
        const cur = new Date(from);
        while (cur <= to) {
          const isoKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
          const label = `${cur.getDate()} ${MONTH_NAMES_SHORT[cur.getMonth()]}`;
          const dayTotal = filteredIncome.filter(t => normalizeDate(t.fecha) === isoKey).reduce((s, t) => s + t.importe, 0);
          result.push({ label, ingresos: dayTotal, meta: 0 });
          cur.setDate(cur.getDate() + 1);
        }
        return result;
      } else {
        // Group by week
        const result: { label: string; ingresos: number; meta: number }[] = [];
        let weekStart = new Date(from);
        let weekNum = 1;
        while (weekStart <= to) {
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          const actualEnd = weekEnd > to ? to : weekEnd;
          let weekTotal = 0;
          const cur = new Date(weekStart);
          while (cur <= actualEnd) {
            const isoKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
            filteredIncome.forEach(t => {
              if (normalizeDate(t.fecha) === isoKey) weekTotal += t.importe;
            });
            cur.setDate(cur.getDate() + 1);
          }
          result.push({ label: `Sem ${weekNum}`, ingresos: weekTotal, meta: 0 });
          weekStart = new Date(actualEnd);
          weekStart.setDate(weekStart.getDate() + 1);
          weekNum++;
        }
        return result;
      }
    }

    return [];
  }, [realIncome, filteredIncome, filterMode, selectedMonth, dateRange, budgetData]);

  // Filter invoices by period
  const filteredInvoices = useMemo(() => {
    if (filterMode === 'all') return invoices;
    if (filterMode === 'month' && selectedMonth) {
      return invoices.filter(inv => normalizeDate(inv.fecha).startsWith(selectedMonth));
    }
    if (filterMode === 'custom' && dateRange?.from) {
      const fromStr = `${dateRange.from.getFullYear()}-${String(dateRange.from.getMonth() + 1).padStart(2, '0')}-${String(dateRange.from.getDate()).padStart(2, '0')}`;
      const toDate = dateRange.to || dateRange.from;
      const toStr = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;
      return invoices.filter(inv => {
        const normalized = normalizeDate(inv.fecha);
        return normalized >= fromStr && normalized <= toStr;
      });
    }
    return invoices;
  }, [invoices, filterMode, selectedMonth, dateRange]);

  // Services from invoices (cuentas por cobrar)
  const servicesByInvoice = useMemo(() => {
    const serviceMap = new Map<string, number>();
    filteredInvoices.forEach(inv => {
      const serviceName = inv.servicio || inv.concepto || 'Sin clasificar';
      serviceMap.set(serviceName, (serviceMap.get(serviceName) || 0) + inv.totalAmount);
    });
    const colors = ['hsl(var(--success))', 'hsl(var(--primary))', 'hsl(var(--warning))', '#8884d8', '#82ca9d', '#ffc658', '#ff7c43', '#665191'];
    return Array.from(serviceMap.entries())
      .map(([name, value], index) => ({ name, value, color: colors[index % colors.length] }))
      .sort((a, b) => b.value - a.value);
  }, [filteredInvoices]);

  // Cartera por cobrar: facturas no pagadas agrupadas por cliente
  const carteraPorCobrar = useMemo(() => {
    const pendientes = filteredInvoices.filter(inv => inv.status !== 'pagada');
    const clientMap = new Map<string, { total: number; count: number; statuses: Set<string> }>();
    pendientes.forEach(inv => {
      const client = inv.clientName || 'Sin cliente';
      const current = clientMap.get(client) || { total: 0, count: 0, statuses: new Set<string>() };
      current.total += inv.totalAmount;
      current.count += 1;
      current.statuses.add(inv.status);
      clientMap.set(client, current);
    });
    const totalCartera = pendientes.reduce((s, inv) => s + inv.totalAmount, 0);
    const items = Array.from(clientMap.entries())
      .map(([name, data]) => ({ name, total: data.total, count: data.count, statuses: Array.from(data.statuses) }))
      .sort((a, b) => b.total - a.total);
    return { items, total: totalCartera, count: pendientes.length };
  }, [filteredInvoices]);

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
        {/* 1. Line Chart - Tendencia Mensual + Meta */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-1">Tendencia de Ingresos</h3>
          <p className="text-xs text-muted-foreground mb-4">
            {getFilterDisplayName()} - Crecimiento {filterMode === 'month' ? 'semanal' : filterMode === 'custom' ? 'por período' : 'mes a mes'} + meta
          </p>
          {trendChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value: number) => formatCurrency(value)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number, name: string) => [`$${fmt(value)}`, name === 'ingresos' ? 'Ingresos' : 'Meta']}
                  />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    formatter={(value: string) => value === 'ingresos' ? 'Ingresos Reales' : 'Meta Proyectada'}
                  />
                  <Line
                    type="monotone"
                    dataKey="ingresos"
                    name="ingresos"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{ r: 5, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                    activeDot={{ r: 7, strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="meta"
                    name="meta"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={{ r: 4, fill: 'hsl(var(--muted-foreground))', strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (<div className="flex items-center justify-center h-64 text-muted-foreground text-sm">No hay datos de tendencia mensual</div>)}
        </div>

        {/* Cartera por Cobrar */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-foreground">Cartera por Cobrar</h3>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              <span className="text-sm font-bold text-warning">{carteraPorCobrar.count} facturas</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Facturas pendientes de pago por cliente</p>
          <div className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/20 mb-4">
            <span className="text-sm text-muted-foreground">Total Cartera</span>
            <span className="text-lg font-bold text-warning">${fmt(carteraPorCobrar.total)}</span>
          </div>
          {carteraPorCobrar.items.length > 0 ? (
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {carteraPorCobrar.items.map((client, idx) => {
                const pct = carteraPorCobrar.total > 0 ? (client.total / carteraPorCobrar.total) * 100 : 0;
                return (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate" title={client.name}>{client.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{client.count} factura{client.count > 1 ? 's' : ''}</span>
                        {client.statuses.map(st => (
                          <span key={st} className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                            st === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                            st === 'enviada' ? 'bg-blue-100 text-blue-800' :
                            st === 'parcial' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'
                          )}>
                            {st === 'pendiente' ? 'Pendiente' : st === 'enviada' ? 'Enviada' : st === 'parcial' ? 'Parcial' : st}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right ml-3 whitespace-nowrap">
                      <p className="text-sm font-bold text-foreground">${fmt(client.total)}</p>
                      <p className="text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              No hay cartera pendiente
            </div>
          )}
        </div>
      </div>

      {/* 2. Donut Chart - Servicios de Cuentas por Cobrar + 3. Horizontal Bar - Ingresos por Cliente */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Donut: Servicios facturados */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-1">Servicios Facturados</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribución por tipo de servicio en cuentas por cobrar</p>
          {servicesByInvoice.length > 0 ? (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={servicesByInvoice}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="hsl(var(--card))"
                      strokeWidth={2}
                    >
                      {servicesByInvoice.map((entry, index) => (<Cell key={`svc-${index}`} fill={entry.color} />))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value: number) => {
                        const totalSvc = servicesByInvoice.reduce((s, v) => s + v.value, 0);
                        const pct = totalSvc > 0 ? ((value / totalSvc) * 100).toFixed(1) : '0';
                        return [`$${fmt(value)} (${pct}%)`, ''];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {servicesByInvoice.map((svc) => {
                  const totalSvc = servicesByInvoice.reduce((s, v) => s + v.value, 0);
                  const pct = totalSvc > 0 ? ((svc.value / totalSvc) * 100).toFixed(1) : '0';
                  return (
                    <div key={svc.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: svc.color }} />
                        <span className="text-muted-foreground truncate">{svc.name}</span>
                      </div>
                      <div className="flex items-center gap-2 whitespace-nowrap ml-2">
                        <span className="font-medium text-foreground">${fmt(svc.value)}</span>
                        <span className="text-xs text-muted-foreground">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-52 text-muted-foreground text-sm">
              No hay datos de servicios facturados
            </div>
          )}
        </div>

        {/* Horizontal Bar Chart: Ingresos por Cliente */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-1">Ingresos por Cliente</h3>
          <p className="text-xs text-muted-foreground mb-4">Importancia de cada cliente por ingreso</p>
          {incomeByEntity.length > 0 ? (
            <div className="space-y-3">
              {incomeByEntity.slice(0, 8).map((entity, index) => {
                const maxTotal = incomeByEntity[0]?.total || 1;
                const barWidth = (entity.total / maxTotal) * 100;
                const barColors = [
                  'bg-primary', 'bg-primary/80', 'bg-primary/65', 'bg-primary/50',
                  'bg-primary/40', 'bg-primary/30', 'bg-primary/25', 'bg-primary/20',
                ];
                return (
                  <div key={index} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground truncate" title={entity.fullName}>
                        {entity.fullName.length > 20 ? entity.fullName.substring(0, 20) + '...' : entity.fullName}
                      </span>
                      <span className="text-sm font-bold text-foreground ml-2 whitespace-nowrap">
                        {formatCurrency(entity.total)}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", barColors[index] || 'bg-primary/20')}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-52 text-muted-foreground text-sm">
              No hay datos de ingresos por cliente
            </div>
          )}
        </div>
      </div>

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
