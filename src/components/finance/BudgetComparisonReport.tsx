import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, RefreshCw, Target, Calendar, CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
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
  // Presupuesto mensual recurrente (hoja "Presupuesto Mensual"), aplica a Abr-Dic
  monthlyBudget?: { categorias: Record<string, number>; total: number };
}

interface BudgetComparisonReportProps {
  gastos: Transaction[];
}

const ALL_MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'] as const;
type MonthKey = typeof ALL_MONTHS[number];
type Q1Key = 'enero' | 'febrero' | 'marzo';
type SelectedPeriod = MonthKey | 'q1' | 'custom';

const Q1_MONTHS: readonly Q1Key[] = ['enero','febrero','marzo'];
const BUDGET_YEAR = 2026;
const isQ1Key = (k: MonthKey): k is Q1Key => (Q1_MONTHS as readonly string[]).includes(k);
const monthNumberOf = (k: MonthKey) => ALL_MONTHS.indexOf(k) + 1;
const monthYmPrefix = (k: MonthKey) => `${BUDGET_YEAR}-${String(monthNumberOf(k)).padStart(2, '0')}`;

const DEFAULT_MONTH_TOTALS = { proyectado: 0, real: 0 };
const MONTH_NAMES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTH_NAMES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const isExcludedCategory = (categoria: string | undefined | null): boolean => {
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
  } catch { /* ignore */ }
  return dateStr;
};

const formatDateShort = (date: Date): string => {
  return `${date.getDate()} ${MONTH_NAMES_SHORT[date.getMonth()]} ${date.getFullYear()}`;
};

const fmt = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BudgetComparisonReport({ gastos }: BudgetComparisonReportProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [budgetData, setBudgetData] = useState<BudgetQ1Data | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<SelectedPeriod>('q1');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const currentDate = new Date();
  const currentMonthIndex = currentDate.getMonth();
  const currentMonthKey: MonthKey | null = ALL_MONTHS[currentMonthIndex] ?? null;

  useEffect(() => {
    const fetchBudget = async () => {
      try {
        setIsLoading(true);
        const data = await apiClient.get<BudgetQ1Data>('/api/finance/budget');
        setBudgetData(data);
      } catch (error) {
        console.error('Error fetching budget data:', error);
        toast({ title: 'Error', description: 'No se pudieron cargar los datos del presupuesto desde Google Sheets', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchBudget();
  }, [toast]);

  const filteredGastos = useMemo(() => {
    const notExcluded = (t: Transaction) => !isExcludedCategory(t.categoria);
    if (selectedMonth === 'custom') {
      if (!dateRange?.from) return gastos.filter(notExcluded);
      const fromStr = `${dateRange.from.getFullYear()}-${String(dateRange.from.getMonth() + 1).padStart(2, '0')}-${String(dateRange.from.getDate()).padStart(2, '0')}`;
      const toDate = dateRange.to || dateRange.from;
      const toStr = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;
      return gastos.filter(t => notExcluded(t) && (() => { const n = normalizeDate(t.fecha); return n >= fromStr && n <= toStr; })());
    }
    if (selectedMonth === 'q1') {
      const from = `${BUDGET_YEAR}-01-01`; const to = `${BUDGET_YEAR}-03-31`;
      return gastos.filter(t => { if (!notExcluded(t)) return false; const n = normalizeDate(t.fecha); return n >= from && n <= to; });
    }
    const ym = monthYmPrefix(selectedMonth);
    return gastos.filter(t => notExcluded(t) && normalizeDate(t.fecha).startsWith(ym));
  }, [gastos, selectedMonth, dateRange]);

  // Category breakdown derived from actual gastos[] for any non-Q1 period (covers abril..diciembre + custom)
  const gastosCategoryBreakdown = useMemo(() => {
    const categoryMap = new Map<string, number>();
    filteredGastos.forEach(t => {
      if (t.categoria) categoryMap.set(t.categoria, (categoryMap.get(t.categoria) || 0) + t.importe);
    });
    return Array.from(categoryMap.entries())
      .map(([categoria, real]) => ({ categoria, proyectado: 0, real, diferencia: -real, percentUsed: 0, status: 'ok' as const }))
      .sort((a, b) => b.real - a.real);
  }, [filteredGastos]);

  const filteredGastosTotals = useMemo(() => {
    const real = filteredGastos.reduce((sum, t) => sum + t.importe, 0);
    return { proyectado: 0, real, percentUsed: 0 };
  }, [filteredGastos]);

  const q1Totals = useMemo(() => {
    if (!budgetData?.gastos?.totales) return { proyectado: 0, real: 0, percentUsed: 0 };
    const totales = budgetData.gastos.totales;
    const enero = totales.enero || DEFAULT_MONTH_TOTALS;
    const febrero = totales.febrero || DEFAULT_MONTH_TOTALS;
    const marzo = totales.marzo || DEFAULT_MONTH_TOTALS;
    const proyectado = enero.proyectado + febrero.proyectado + marzo.proyectado;
    const real = enero.real + febrero.real + marzo.real;
    return { proyectado, real, percentUsed: proyectado > 0 ? (real / proyectado) * 100 : 0 };
  }, [budgetData]);

  const monthlyComparisonData = useMemo(() => {
    const monthlyTotal = budgetData?.monthlyBudget?.total || 0;
    return ALL_MONTHS.map((key) => {
      const name = MONTH_NAMES_FULL[monthNumberOf(key) - 1];
      const budgetTotales = isQ1Key(key) ? (budgetData?.gastos?.totales?.[key] || DEFAULT_MONTH_TOTALS) : DEFAULT_MONTH_TOTALS;
      // Real gastos: prefer the budget's "real" for Q1 (keeps parity with sheet), else compute from gastos[]
      const ym = monthYmPrefix(key);
      const realFromGastos = gastos.filter(t => !isExcludedCategory(t.categoria) && normalizeDate(t.fecha).startsWith(ym))
        .reduce((sum, t) => sum + t.importe, 0);
      const real = isQ1Key(key) && budgetTotales.real ? budgetTotales.real : realFromGastos;
      // Proyectado: Q1 usa Presupuesto Q1; Abr-Dic usan total de Presupuesto Mensual recurrente
      const proyectado = isQ1Key(key) ? budgetTotales.proyectado : monthlyTotal;
      const percentUsed = proyectado > 0 ? (real / proyectado) * 100 : 0;
      return { month: name, monthKey: key, proyectado, real, diferencia: proyectado - real, percentUsed, isCurrent: key === currentMonthKey };
    });
  }, [budgetData, gastos, currentMonthKey]);

  // Helper: matches a real category in gastos[] against a budget category from Presupuesto Mensual.
  // Tolerant: case-insensitive contains in either direction.
  const matchesMonthlyCategory = (realCat: string, budgetCat: string): boolean => {
    const a = realCat.trim().toUpperCase();
    const b = budgetCat.trim().toUpperCase();
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.includes(b) || b.includes(a)) return true;
    return false;
  };

  const categoryBreakdown = useMemo(() => {
    if (selectedMonth === 'custom') return gastosCategoryBreakdown;

    // Q1 (enero/febrero/marzo/q1): usa Presupuesto Q1
    if (selectedMonth === 'q1' || isQ1Key(selectedMonth as MonthKey)) {
      if (!budgetData?.gastos?.categorias) return [];
      return Object.entries(budgetData.gastos.categorias).map(([categoria, data]) => {
        const enero = data?.enero || DEFAULT_MONTH_TOTALS;
        const febrero = data?.febrero || DEFAULT_MONTH_TOTALS;
        const marzo = data?.marzo || DEFAULT_MONTH_TOTALS;
        let proyectado: number, real: number;
        if (selectedMonth === 'q1') { proyectado = enero.proyectado + febrero.proyectado + marzo.proyectado; real = enero.real + febrero.real + marzo.real; }
        else { const md = data?.[selectedMonth as Q1Key] || DEFAULT_MONTH_TOTALS; proyectado = md.proyectado; real = md.real; }
        const diferencia = proyectado - real;
        const percentUsed = proyectado > 0 ? (real / proyectado) * 100 : (real > 0 ? 100 : 0);
        return { categoria, proyectado, real, diferencia, percentUsed, status: percentUsed > 100 ? 'over' : percentUsed > 80 ? 'warning' : 'ok' as 'over' | 'warning' | 'ok' };
      }).filter(item => {
        const u = item.categoria.toUpperCase();
        return !(u.includes('UTILIDAD') || u.includes('MARGEN') || u.includes('DIVIDENDO') || u.includes('RESERVA') || u.includes('TOTAL DAIRO')) && (item.proyectado > 0 || item.real > 0);
      }).sort((a, b) => b.proyectado - a.proyectado);
    }

    // Abr..Dic: cruza el real del mes con el Presupuesto Mensual recurrente
    const monthly = budgetData?.monthlyBudget?.categorias || {};
    const monthlyEntries = Object.entries(monthly);
    if (monthlyEntries.length === 0) return gastosCategoryBreakdown;

    const realByCategory = new Map<string, number>();
    filteredGastos.forEach(t => {
      if (t.categoria) realByCategory.set(t.categoria, (realByCategory.get(t.categoria) || 0) + t.importe);
    });

    // Match each budget category with realByCategory entries
    const matched = monthlyEntries.map(([budgetCat, proyectado]) => {
      let real = 0;
      const matchedRealKeys: string[] = [];
      realByCategory.forEach((amount, realCat) => {
        if (matchesMonthlyCategory(realCat, budgetCat)) { real += amount; matchedRealKeys.push(realCat); }
      });
      matchedRealKeys.forEach(k => realByCategory.delete(k));
      const diferencia = proyectado - real;
      const percentUsed = proyectado > 0 ? (real / proyectado) * 100 : (real > 0 ? 100 : 0);
      const status: 'over' | 'warning' | 'ok' = percentUsed > 100 ? 'over' : percentUsed > 80 ? 'warning' : 'ok';
      return { categoria: budgetCat, proyectado, real, diferencia, percentUsed, status };
    });

    // Add unmatched real categories (no budget) at the end
    const unmatched = Array.from(realByCategory.entries()).map(([categoria, real]) => ({
      categoria, proyectado: 0, real, diferencia: -real, percentUsed: real > 0 ? 100 : 0, status: 'ok' as 'over' | 'warning' | 'ok',
    }));

    return [...matched, ...unmatched]
      .filter(r => r.proyectado > 0 || r.real > 0)
      .sort((a, b) => b.proyectado - a.proyectado);
  }, [budgetData, selectedMonth, gastosCategoryBreakdown, filteredGastos]);

  const selectedPeriodTotals = useMemo(() => {
    if (selectedMonth === 'custom') return filteredGastosTotals;
    if (selectedMonth === 'q1') return q1Totals;
    if (isQ1Key(selectedMonth as MonthKey) && budgetData?.gastos?.totales) {
      const totales = budgetData.gastos.totales[selectedMonth as Q1Key] || DEFAULT_MONTH_TOTALS;
      return { proyectado: totales.proyectado, real: totales.real, percentUsed: totales.proyectado > 0 ? (totales.real / totales.proyectado) * 100 : 0 };
    }
    // Abr..Dic: presupuesto recurrente desde Presupuesto Mensual
    const proyectado = budgetData?.monthlyBudget?.total || 0;
    const real = filteredGastosTotals.real;
    return { proyectado, real, percentUsed: proyectado > 0 ? (real / proyectado) * 100 : 0 };
  }, [budgetData, selectedMonth, q1Totals, filteredGastosTotals]);

  const formatCurrency = (value: number) => { if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`; return `$${(value / 1000).toFixed(0)}k`; };
  const formatCurrencyFull = (value: number) => `$${fmt(Math.round(value))}`;

  if (isLoading && !budgetData) {
    return (<div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>);
  }

  const periodLabels: Record<string, string> = {
    q1: `Q1ㅤ${BUDGET_YEAR}`,
    ...Object.fromEntries(ALL_MONTHS.map((k, i) => [k, `${MONTH_NAMES_FULL[i]} ${BUDGET_YEAR}`])),
    custom: dateRange?.from ? `${formatDateShort(dateRange.from)}${dateRange.to ? ` - ${formatDateShort(dateRange.to)}` : ''}` : 'Rango personalizado',
  };
  periodLabels.q1 = `Q1 ${BUDGET_YEAR}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Presupuesto vs Real - {periodLabels[selectedMonth] || `Q1 ${BUDGET_YEAR}`}</h2>
          <p className="text-sm text-muted-foreground">
            {selectedMonth === 'custom'
              ? 'Gasto real desde movimientos (rango personalizado, sin presupuesto)'
              : selectedMonth === 'q1' || isQ1Key(selectedMonth as MonthKey)
              ? 'Comparación de gastos operativos desde Google Sheets (Presupuesto Q1)'
              : 'Comparación contra presupuesto recurrente mensual (hoja Presupuesto Mensual)'}
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} /> Actualizar
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant={selectedMonth === 'q1' ? 'default' : 'outline'} size="sm" onClick={() => { setSelectedMonth('q1'); setDateRange(undefined); }}>
          <Target className="h-4 w-4 mr-1" /> Q1 Completo
        </Button>
        {ALL_MONTHS.map((month) => (
          <Button key={month} variant={selectedMonth === month ? 'default' : 'outline'} size="sm" onClick={() => { setSelectedMonth(month); setDateRange(undefined); }} className={cn(month === currentMonthKey && selectedMonth !== month && 'border-primary')}>
            {month === currentMonthKey && <Calendar className="h-4 w-4 mr-1" />}
            {month.charAt(0).toUpperCase() + month.slice(1)}
          </Button>
        ))}
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant={selectedMonth === 'custom' ? 'default' : 'outline'} size="sm">
              <CalendarRange className="h-4 w-4 mr-1" />
              {selectedMonth === 'custom' && dateRange?.from ? periodLabels.custom : 'Rango personalizado'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarPicker mode="range" selected={dateRange} onSelect={(range) => { setDateRange(range); if (range?.from) setSelectedMonth('custom'); if (range?.from && range?.to) setTimeout(() => setIsCalendarOpen(false), 300); }} numberOfMonths={2} defaultMonth={new Date(2026, 0)} />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{selectedMonth === 'custom' ? 'Período' : `Presupuesto ${periodLabels[selectedMonth]}`}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{selectedMonth === 'custom' ? periodLabels.custom : formatCurrency(selectedPeriodTotals.proyectado)}</p>
          {selectedMonth !== 'custom' && <p className="text-xs text-muted-foreground mt-1">{formatCurrencyFull(selectedPeriodTotals.proyectado)}</p>}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Gasto Real</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(selectedPeriodTotals.real)}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatCurrencyFull(selectedPeriodTotals.real)}</p>
        </div>
        {selectedMonth !== 'custom' ? (
          <>
            <div className={cn("rounded-xl border p-4", (selectedPeriodTotals.proyectado - selectedPeriodTotals.real) >= 0 ? "border-success/50 bg-success/10" : "border-destructive/50 bg-destructive/10")}>
              <p className="text-sm text-muted-foreground">Diferencia</p>
              <div className="flex items-center gap-2 mt-1">
                {(selectedPeriodTotals.proyectado - selectedPeriodTotals.real) >= 0 ? <TrendingDown className="h-5 w-5 text-success" /> : <TrendingUp className="h-5 w-5 text-destructive" />}
                <p className={cn("text-2xl font-bold", (selectedPeriodTotals.proyectado - selectedPeriodTotals.real) >= 0 ? "text-success" : "text-destructive")}>
                  {(selectedPeriodTotals.proyectado - selectedPeriodTotals.real) >= 0 ? '-' : '+'}{formatCurrency(Math.abs(selectedPeriodTotals.proyectado - selectedPeriodTotals.real))}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{(selectedPeriodTotals.proyectado - selectedPeriodTotals.real) >= 0 ? 'Ahorro' : 'Exceso'}</p>
            </div>
            <div className={cn("rounded-xl border p-4", selectedPeriodTotals.percentUsed <= 80 ? "border-success/50 bg-success/10" : selectedPeriodTotals.percentUsed <= 100 ? "border-warning/50 bg-warning/10" : "border-destructive/50 bg-destructive/10")}>
              <p className="text-sm text-muted-foreground">% Ejecutado</p>
              <div className="flex items-center gap-2 mt-1">
                {selectedPeriodTotals.percentUsed <= 80 ? <CheckCircle className="h-5 w-5 text-success" /> : <AlertTriangle className={cn("h-5 w-5", selectedPeriodTotals.percentUsed <= 100 ? "text-warning" : "text-destructive")} />}
                <p className={cn("text-2xl font-bold", selectedPeriodTotals.percentUsed <= 80 ? "text-success" : selectedPeriodTotals.percentUsed <= 100 ? "text-warning" : "text-destructive")}>{selectedPeriodTotals.percentUsed.toFixed(1)}%</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{selectedPeriodTotals.percentUsed <= 100 ? `Disponible: ${(100 - selectedPeriodTotals.percentUsed).toFixed(1)}%` : `Excedido: ${(selectedPeriodTotals.percentUsed - 100).toFixed(1)}%`}</p>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-sm text-muted-foreground">Transacciones</p><p className="text-2xl font-bold text-foreground mt-1">{filteredGastos.filter(t => !isExcludedCategory(t.categoria)).length}</p></div>
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-sm text-muted-foreground">Categorías</p><p className="text-2xl font-bold text-foreground mt-1">{gastosCategoryBreakdown.length}</p></div>
          </>
        )}
      </div>

      {selectedMonth !== 'custom' && monthlyComparisonData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-1">Ejecución Presupuestal</h3>
          <p className="text-xs text-muted-foreground mb-5">Presupuesto vs gasto real por mes</p>
          <div className="space-y-5">
            {monthlyComparisonData.map((month) => {
              const maxVal = Math.max(...monthlyComparisonData.map(m => Math.max(m.proyectado, m.real)));
              const budgetWidth = maxVal > 0 ? (month.proyectado / maxVal) * 100 : 0;
              const realWidth = maxVal > 0 ? (month.real / maxVal) * 100 : 0;
              return (
                <div key={month.monthKey} className={cn("group", month.isCurrent && "relative")}>
                  {month.isCurrent && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-primary rounded-full" />}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-semibold text-foreground", month.isCurrent && "text-primary")}>{month.month}</span>
                      {month.isCurrent && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Actual</span>}
                    </div>
                    <span className={cn(
                      "text-sm font-bold",
                      month.percentUsed <= 80 ? "text-success" : month.percentUsed <= 100 ? "text-warning" : "text-destructive"
                    )}>
                      {month.percentUsed.toFixed(0)}%
                    </span>
                  </div>
                  {/* Budget bar (background) */}
                  <div className="relative h-8 mb-1">
                    <div
                      className="absolute top-0 left-0 h-full bg-muted/60 rounded-lg"
                      style={{ width: `${budgetWidth}%` }}
                    />
                    <div
                      className={cn(
                        "absolute top-1 left-0 h-6 rounded-md transition-all duration-500",
                        month.percentUsed <= 80 ? "bg-emerald-500/80" : month.percentUsed <= 100 ? "bg-amber-500/80" : "bg-red-500/80"
                      )}
                      style={{ width: `${realWidth}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-between px-3">
                      <span className="text-xs font-medium text-foreground/80">{formatCurrency(month.real)}</span>
                      <span className="text-xs text-muted-foreground">{formatCurrency(month.proyectado)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 mt-5 pt-4 border-t border-border">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-muted/60" />
              <span className="text-xs text-muted-foreground">Presupuesto</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-500/80" />
              <span className="text-xs text-muted-foreground">Gasto real</span>
            </div>
          </div>
        </div>
      )}

      {categoryBreakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-1">Desglose por Categoría</h3>
          <p className="text-xs text-muted-foreground mb-5">{periodLabels[selectedMonth]}</p>
          <div className="space-y-4">
            {categoryBreakdown.map((row, index) => {
              // Bar width = % ejecutado (capped at 100% visually)
              const execPct = selectedMonth !== 'custom' && row.proyectado > 0
                ? Math.min((row.real / row.proyectado) * 100, 100)
                : 0;
              // For custom mode, show proportional to max
              const maxVal = Math.max(...categoryBreakdown.map(r => r.real));
              const customWidth = maxVal > 0 ? (row.real / maxVal) * 100 : 0;
              const barWidth = selectedMonth === 'custom' ? customWidth : execPct;

              return (
                <div key={index} className="group">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-foreground truncate" title={row.categoria}>
                      {row.categoria}
                    </span>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                        {formatCurrency(row.real)}
                      </span>
                      {selectedMonth !== 'custom' && (
                        <span className={cn(
                          "text-xs font-medium px-1.5 py-0.5 rounded-full",
                          row.status === 'over' ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : row.status === 'warning' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        )}>
                          {Math.round(row.percentUsed)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="relative h-5">
                    {selectedMonth !== 'custom' && (
                      <div
                        className="absolute top-0 left-0 h-full bg-muted/50 rounded-full"
                        style={{ width: '100%' }}
                      />
                    )}
                    <div
                      className={cn(
                        "absolute top-0.5 left-0 h-4 rounded-full transition-all duration-500",
                        selectedMonth === 'custom' ? "bg-primary/70"
                          : row.status === 'over' ? "bg-red-500/70"
                          : row.status === 'warning' ? "bg-amber-500/70"
                          : "bg-emerald-500/70"
                      )}
                      style={{ width: `${barWidth}%`, minWidth: barWidth > 0 ? '4px' : '0' }}
                    />
                  </div>
                  {selectedMonth !== 'custom' && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[11px] text-muted-foreground">Real: ${fmt(row.real)}</span>
                      <span className="text-[11px] text-muted-foreground">Ppto: ${fmt(row.proyectado)}</span>
                    </div>
                  )}
                </div>
              );
            })}
            {/* Total */}
            <div className="pt-4 mt-2 border-t-2 border-border">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-foreground">TOTAL</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{formatCurrency(selectedPeriodTotals.real)}</span>
                  {selectedMonth !== 'custom' && (
                    <span className={cn(
                      "text-xs font-bold px-1.5 py-0.5 rounded-full",
                      selectedPeriodTotals.percentUsed > 100 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : selectedPeriodTotals.percentUsed > 80 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    )}>
                      {Math.round(selectedPeriodTotals.percentUsed)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="relative h-5">
                {selectedMonth !== 'custom' && (
                  <div className="absolute top-0 left-0 h-full bg-muted/50 rounded-full w-full" />
                )}
                <div
                  className={cn(
                    "absolute top-0.5 left-0 h-4 rounded-full transition-all duration-500",
                    selectedMonth === 'custom' ? "bg-primary/70"
                      : selectedPeriodTotals.percentUsed > 100 ? "bg-red-500/70"
                      : selectedPeriodTotals.percentUsed > 80 ? "bg-amber-500/70"
                      : "bg-emerald-500/70"
                  )}
                  style={{ width: `${selectedMonth === 'custom' ? 100 : Math.min(selectedPeriodTotals.percentUsed, 100)}%` }}
                />
              </div>
              {selectedMonth !== 'custom' && (
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] text-muted-foreground">Real: ${fmt(selectedPeriodTotals.real)}</span>
                  <span className="text-[11px] text-muted-foreground">Ppto: ${fmt(selectedPeriodTotals.proyectado)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedMonth !== 'custom' && categoryBreakdown.length > 0 && (
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
                    <td className="py-3 px-2 text-right text-muted-foreground">${fmt(row.proyectado)}</td>
                    <td className="py-3 px-2 text-right text-foreground font-medium">${fmt(row.real)}</td>
                    <td className={cn("py-3 px-2 text-right font-medium", row.diferencia >= 0 ? "text-success" : "text-destructive")}>{row.diferencia >= 0 ? '-' : '+'}${fmt(Math.abs(row.diferencia))}</td>
                    <td className={cn("py-3 px-2 text-right font-medium", row.percentUsed <= 80 ? "text-success" : row.percentUsed <= 100 ? "text-warning" : "text-destructive")}>{row.percentUsed.toFixed(1)}%</td>
                    <td className="py-3 px-2 text-center">
                      <span className={cn("inline-flex items-center px-2 py-1 rounded-full text-xs font-medium", row.status === 'over' ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : row.status === 'warning' ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400")}>
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

      {categoryBreakdown.length === 0 && !isLoading && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0"><TrendingUp className="h-5 w-5 text-primary" /></div>
            <div><h3 className="font-semibold text-foreground mb-2">Datos desde Google Sheets</h3><p className="text-sm text-muted-foreground">El presupuesto se carga desde la hoja "Presupuesto Q1" de Google Sheets.</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
