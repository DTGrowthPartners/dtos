import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Target, Calendar, CalendarRange, FileDown, FileSpreadsheet } from 'lucide-react';
import { exportIncomeStatementPDF, exportIncomeStatementExcel } from '@/lib/finance-exports';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
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

interface IncomeStatementProps {
  ingresos: Transaction[];
  gastos: Transaction[];
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
}

type MonthKey = 'enero' | 'febrero' | 'marzo';
type SelectedPeriod = MonthKey | 'q1' | '2025' | 'custom';

const DEFAULT_MONTH_TOTALS = { proyectado: 0, real: 0 };
const MONTH_NAMES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Helper to check if a category is excluded
const isExcluded = (categoria: string | undefined | null): boolean => {
  if (!categoria) return false;
  const upper = categoria.trim().toUpperCase();
  return upper === 'AJUSTE SALDO' || upper === 'RESERVAS' || upper.startsWith('TRASLADO') || upper.startsWith('REEMBOLSO');
};

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
  } catch { /* ignore */ }
  return dateStr;
};

const formatDateShort = (date: Date): string => {
  return `${date.getDate()} ${MONTH_NAMES_SHORT[date.getMonth()]} ${date.getFullYear()}`;
};

const MONTH_KEY_MAP: Record<string, MonthKey> = {
  '01': 'enero',
  '02': 'febrero',
  '03': 'marzo',
};

export default function IncomeStatement({ ingresos, gastos }: IncomeStatementProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<SelectedPeriod>('q1');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [budgetData, setBudgetData] = useState<BudgetQ1Data | null>(null);

  // Get current month
  const currentDate = new Date();
  const currentMonthIndex = currentDate.getMonth();
  const getMonthKey = (index: number): MonthKey | null => {
    if (index === 0) return 'enero';
    if (index === 1) return 'febrero';
    if (index === 2) return 'marzo';
    return null;
  };
  const currentMonthKey = getMonthKey(currentMonthIndex);

  // Fetch budget data
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

  // Filter transactions by period
  const filterByPeriod = (transactions: Transaction[]): Transaction[] => {
    const filtered = transactions.filter(t => !isExcluded(t.categoria));

    if (selectedPeriod === '2025') {
      return filtered.filter(t => normalizeDate(t.fecha).startsWith('2025-'));
    }

    if (selectedPeriod === 'q1') return filtered;

    if (selectedPeriod === 'custom' && dateRange?.from) {
      const fromStr = `${dateRange.from.getFullYear()}-${String(dateRange.from.getMonth() + 1).padStart(2, '0')}-${String(dateRange.from.getDate()).padStart(2, '0')}`;
      const toDate = dateRange.to || dateRange.from;
      const toStr = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;
      return filtered.filter(t => {
        const normalized = normalizeDate(t.fecha);
        return normalized >= fromStr && normalized <= toStr;
      });
    }

    // Month filter
    const monthMap: Record<string, string> = { enero: '2026-01', febrero: '2026-02', marzo: '2026-03' };
    const prefix = monthMap[selectedPeriod];
    if (prefix) {
      return filtered.filter(t => normalizeDate(t.fecha).startsWith(prefix));
    }

    return filtered;
  };

  const filteredIngresos = useMemo(() => filterByPeriod(ingresos), [ingresos, selectedPeriod, dateRange]);
  const filteredGastos = useMemo(() => filterByPeriod(gastos), [gastos, selectedPeriod, dateRange]);

  // Calculate real values
  const totalIngresos = useMemo(() => filteredIngresos.reduce((sum, t) => sum + t.importe, 0), [filteredIngresos]);
  const totalGastos = useMemo(() => filteredGastos.reduce((sum, t) => sum + t.importe, 0), [filteredGastos]);
  const utilidadBruta = totalIngresos - totalGastos;
  const margenBruto = totalIngresos > 0 ? (utilidadBruta / totalIngresos) * 100 : 0;

  // Comisión 1% sobre utilidad bruta — aplica a partir de febrero 2026
  const aplicaComision = useMemo(() => {
    if (selectedPeriod === 'enero' || selectedPeriod === '2025') return false;
    if (selectedPeriod === 'febrero' || selectedPeriod === 'marzo' || selectedPeriod === 'q1') return true;
    // Custom: aplica si el rango incluye febrero 2026 o posterior
    if (selectedPeriod === 'custom' && dateRange?.from) {
      const to = dateRange.to || dateRange.from;
      return to >= new Date(2026, 1, 1); // >= 1 Feb 2026
    }
    return false;
  }, [selectedPeriod, dateRange]);

  const comisionParticipacion = aplicaComision && utilidadBruta > 0 ? utilidadBruta * 0.01 : 0;
  const utilidadNeta = utilidadBruta - comisionParticipacion;
  const dividendosDairo = utilidadNeta > 0 ? utilidadNeta * 0.25 : 0;
  const reservaEmpresa = utilidadNeta > 0 ? utilidadNeta * 0.75 : 0;

  // Sueldo Dairo (from budget data or default)
  const sueldoDairo = useMemo(() => {
    if (!budgetData?.gastos?.categorias) return 0;
    
    // Look for Nómina (Dairo) in gastos
    const dairoKey = Object.keys(budgetData.gastos.categorias).find(k => 
      k.toUpperCase().includes('DAIRO') && k.toUpperCase().includes('MINA')
    );
    
    if (!dairoKey) return 0;
    const data = budgetData.gastos.categorias[dairoKey];
    
    if (selectedPeriod === '2025') {
      // For 2025, calculate from filtered gastos
      return filteredGastos
        .filter(t => t.categoria?.toUpperCase().includes('DAIRO'))
        .reduce((sum, t) => sum + t.importe, 0);
    }

    if (selectedPeriod === 'q1') {
      return (data?.enero?.real || 0) + (data?.febrero?.real || 0) + (data?.marzo?.real || 0);
    }
    if (selectedPeriod !== 'custom' && data?.[selectedPeriod]) {
      return data[selectedPeriod].real || 0;
    }
    
    // For custom, calculate from filtered gastos
    return filteredGastos
      .filter(t => t.categoria?.toUpperCase().includes('DAIRO'))
      .reduce((sum, t) => sum + t.importe, 0);
  }, [budgetData, selectedPeriod, filteredGastos]);

  const totalDairo = sueldoDairo + dividendosDairo;

  // Dynamic chart data based on selected period
  const chartData = useMemo(() => {
    // Helper: group transactions by a key function
    const groupBy = (
      ingresosArr: Transaction[],
      gastosArr: Transaction[],
      keyFn: (dateStr: string) => string,
      sortedKeys: string[]
    ) => {
      const ingMap: Record<string, number> = {};
      const gasMap: Record<string, number> = {};
      sortedKeys.forEach(k => { ingMap[k] = 0; gasMap[k] = 0; });

      ingresosArr.forEach(t => {
        const k = keyFn(normalizeDate(t.fecha));
        if (k && ingMap[k] !== undefined) ingMap[k] += t.importe;
      });
      gastosArr.forEach(t => {
        const k = keyFn(normalizeDate(t.fecha));
        if (k && gasMap[k] !== undefined) gasMap[k] += t.importe;
      });

      return sortedKeys.map(k => ({
        label: k,
        ingresos: ingMap[k] || 0,
        gastos: gasMap[k] || 0,
        utilidad: (ingMap[k] || 0) - (gasMap[k] || 0),
      }));
    };

    if (selectedPeriod === '2025') {
      // Single consolidated entry for 2025
      const totalIng = filteredIngresos.reduce((s, t) => s + t.importe, 0);
      const totalGas = filteredGastos.reduce((s, t) => s + t.importe, 0);
      return [{
        label: 'Año 2025',
        ingresos: totalIng,
        gastos: totalGas,
        utilidad: totalIng - totalGas,
      }];
    }

    if (selectedPeriod === 'q1') {
      // Group by month
      const months = [
        { key: '2026-01', name: 'Enero' },
        { key: '2026-02', name: 'Febrero' },
        { key: '2026-03', name: 'Marzo' },
      ];
      const keys = months.map(m => m.name);
      return groupBy(
        filteredIngresos, filteredGastos,
        (d) => {
          const m = months.find(m => d.startsWith(m.key));
          return m ? m.name : '';
        },
        keys
      );
    }

    if (selectedPeriod === 'custom' && dateRange?.from) {
      const from = dateRange.from;
      const to = dateRange.to || dateRange.from;
      const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      if (diffDays <= 14) {
        // Group by day
        const keys: string[] = [];
        const keyLabels: Record<string, string> = {};
        const cur = new Date(from);
        while (cur <= to) {
          const isoKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
          const label = `${cur.getDate()} ${MONTH_NAMES_SHORT[cur.getMonth()]}`;
          keys.push(label);
          keyLabels[isoKey] = label;
          cur.setDate(cur.getDate() + 1);
        }
        return groupBy(filteredIngresos, filteredGastos, (d) => keyLabels[d] || '', keys);
      } else {
        // Group by week
        const keys: string[] = [];
        const keyMap: Record<string, string> = {};
        let weekStart = new Date(from);
        let weekNum = 1;
        while (weekStart <= to) {
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          const actualEnd = weekEnd > to ? to : weekEnd;
          const label = `Sem ${weekNum}`;
          keys.push(label);
          const cur = new Date(weekStart);
          while (cur <= actualEnd) {
            const isoKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
            keyMap[isoKey] = label;
            cur.setDate(cur.getDate() + 1);
          }
          weekStart = new Date(actualEnd);
          weekStart.setDate(weekStart.getDate() + 1);
          weekNum++;
        }
        return groupBy(filteredIngresos, filteredGastos, (d) => keyMap[d] || '', keys);
      }
    }

    // Single month: group by week of month
    const monthMap: Record<string, number> = { enero: 0, febrero: 1, marzo: 2 };
    const monthIdx = monthMap[selectedPeriod as MonthKey];
    if (monthIdx !== undefined) {
      const year = 2026;
      const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
      const keys: string[] = [];
      const keyMap: Record<string, string> = {};
      let weekNum = 1;
      let dayStart = 1;
      while (dayStart <= daysInMonth) {
        const dayEnd = Math.min(dayStart + 6, daysInMonth);
        const label = `${dayStart}-${dayEnd} ${MONTH_NAMES_SHORT[monthIdx]}`;
        keys.push(label);
        for (let d = dayStart; d <= dayEnd; d++) {
          const isoKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          keyMap[isoKey] = label;
        }
        dayStart = dayEnd + 1;
        weekNum++;
      }
      return groupBy(filteredIngresos, filteredGastos, (d) => keyMap[d] || '', keys);
    }

    return [];
  }, [filteredIngresos, filteredGastos, selectedPeriod, dateRange]);

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  };

  const formatCurrencyFull = (value: number) => `$${value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

  const periodLabels: Record<string, string> = {
    '2025': 'Año 2025 (Cierre al 31 Dic)',
    q1: 'Q1 2026',
    enero: 'Enero 2026',
    febrero: 'Febrero 2026',
    marzo: 'Marzo 2026',
    custom: dateRange?.from
      ? `${formatDateShort(dateRange.from)}${dateRange.to ? ` - ${formatDateShort(dateRange.to)}` : ''}`
      : 'Rango personalizado',
  };

  const getExportData = () => ({
    periodLabel: periodLabels[selectedPeriod],
    totalIngresos,
    totalGastos,
    utilidadBruta,
    margenBruto,
    comisionParticipacion,
    dividendosDairo,
    reservaEmpresa,
    sueldoDairo,
    totalDairo,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Estado de Resultados</h2>
          <p className="text-sm text-muted-foreground">
            Resultados financieros reales - {periodLabels[selectedPeriod]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportIncomeStatementPDF(getExportData())}>
            <FileDown className="h-4 w-4 mr-1" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportIncomeStatementExcel(getExportData())}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Excel
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedPeriod === '2025' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setSelectedPeriod('2025'); setDateRange(undefined); }}
        >
          <Calendar className="h-4 w-4 mr-1" />
          2025
        </Button>
        <Button
          variant={selectedPeriod === 'q1' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setSelectedPeriod('q1'); setDateRange(undefined); }}
        >
          <Target className="h-4 w-4 mr-1" />
          Q1 Completo
        </Button>
        {(['enero', 'febrero', 'marzo'] as MonthKey[]).map((month) => (
          <Button
            key={month}
            variant={selectedPeriod === month ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setSelectedPeriod(month); setDateRange(undefined); }}
            className={cn(month === currentMonthKey && selectedPeriod !== month && 'border-primary')}
          >
            {month === currentMonthKey && <Calendar className="h-4 w-4 mr-1" />}
            {month.charAt(0).toUpperCase() + month.slice(1)}
          </Button>
        ))}

        {/* Date Range Picker */}
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant={selectedPeriod === 'custom' ? 'default' : 'outline'} size="sm">
              <CalendarRange className="h-4 w-4 mr-1" />
              {selectedPeriod === 'custom' && dateRange?.from
                ? periodLabels.custom
                : 'Rango personalizado'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarPicker
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                setDateRange(range);
                if (range?.from) setSelectedPeriod('custom');
                if (range?.from && range?.to) setTimeout(() => setIsCalendarOpen(false), 300);
              }}
              numberOfMonths={2}
              defaultMonth={new Date(2026, 0)}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Main Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Ingresos</p>
              <p className="text-2xl font-bold text-success">{formatCurrency(totalIngresos)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Gastos</p>
              <p className="text-2xl font-bold text-destructive">{formatCurrency(totalGastos)}</p>
            </div>
          </div>
        </div>

        <div className={cn(
          "rounded-xl border p-4",
          utilidadBruta >= 0 ? "border-success/50 bg-success/10" : "border-destructive/50 bg-destructive/10"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              utilidadBruta >= 0 ? "bg-success/20" : "bg-destructive/20"
            )}>
              <DollarSign className={cn("h-5 w-5", utilidadBruta >= 0 ? "text-success" : "text-destructive")} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Utilidad Bruta</p>
              <p className={cn("text-2xl font-bold", utilidadBruta >= 0 ? "text-success" : "text-destructive")}>
                {formatCurrency(utilidadBruta)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Margen Bruto</p>
              <p className={cn(
                "text-2xl font-bold",
                margenBruto >= 25 ? "text-success" : margenBruto >= 10 ? "text-warning" : "text-destructive"
              )}>
                {margenBruto.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Estado de Resultados Table */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-4">
          Estado de Resultados - {periodLabels[selectedPeriod]}
        </h3>
        <div className="space-y-1">
          {/* Ingresos */}
          <div className="flex items-center justify-between py-3 px-4 bg-success/5 rounded-lg border border-success/20">
            <span className="text-sm font-bold text-foreground">TOTAL INGRESOS</span>
            <span className="text-lg font-bold text-success">{formatCurrencyFull(totalIngresos)}</span>
          </div>

          {/* Gastos */}
          <div className="flex items-center justify-between py-3 px-4 bg-destructive/5 rounded-lg border border-destructive/20 mt-2">
            <span className="text-sm font-bold text-foreground">TOTAL GASTOS</span>
            <span className="text-lg font-bold text-destructive">{formatCurrencyFull(totalGastos)}</span>
          </div>

          {/* Línea divisora */}
          <div className="border-t-2 border-border my-3"></div>

          {/* Utilidad Bruta */}
          <div className={cn(
            "flex items-center justify-between py-3 px-4 rounded-lg border",
            utilidadBruta >= 0 ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30"
          )}>
            <div>
              <span className="text-sm font-bold text-foreground">UTILIDAD BRUTA</span>
              <span className={cn(
                "text-xs ml-2",
                margenBruto >= 25 ? "text-success" : margenBruto >= 10 ? "text-warning" : "text-destructive"
              )}>
                ({margenBruto.toFixed(2)}%)
              </span>
            </div>
            <span className={cn("text-lg font-bold", utilidadBruta >= 0 ? "text-success" : "text-destructive")}>
              {formatCurrencyFull(utilidadBruta)}
            </span>
          </div>

          {/* Comisión / Participación 1% */}
          {comisionParticipacion > 0 && (
            <>
              <div className="flex items-center justify-between py-2.5 px-4 hover:bg-muted/50 rounded-lg transition-colors mt-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                  <span className="text-sm text-foreground">(-)  Comisión / Participación (1%)</span>
                </div>
                <span className="text-sm font-medium text-foreground">{formatCurrencyFull(comisionParticipacion)}</span>
              </div>

              <div className={cn(
                "flex items-center justify-between py-3 px-4 rounded-lg border mt-1",
                utilidadNeta >= 0 ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"
              )}>
                <span className="text-sm font-bold text-foreground">(=)  UTILIDAD NETA DESPUÉS DE COMISIÓN</span>
                <span className={cn("text-lg font-bold", utilidadNeta >= 0 ? "text-success" : "text-destructive")}>
                  {formatCurrencyFull(utilidadNeta)}
                </span>
              </div>
            </>
          )}

          {/* Separador distribución */}
          <div className="border-t border-dashed border-border my-4"></div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider px-4 mb-2">
            Distribución de Utilidad
          </p>

          {/* Dividendos Dairo (25%) */}
          <div className="flex items-center justify-between py-2.5 px-4 hover:bg-muted/50 rounded-lg transition-colors">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              <span className="text-sm text-foreground">Dividendos Dairo (25%)</span>
            </div>
            <span className="text-sm font-medium text-foreground">{formatCurrencyFull(dividendosDairo)}</span>
          </div>

          {/* Reserva Empresa (75%) */}
          <div className="flex items-center justify-between py-2.5 px-4 hover:bg-muted/50 rounded-lg transition-colors">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-purple-500"></div>
              <span className="text-sm text-foreground">Reserva Empresa (75%)</span>
            </div>
            <span className="text-sm font-medium text-foreground">{formatCurrencyFull(reservaEmpresa)}</span>
          </div>

          {/* Línea divisora */}
          <div className="border-t border-dashed border-border my-3"></div>

          {/* Nómina Dairo */}
          {sueldoDairo > 0 && (
            <div className="flex items-center justify-between py-2.5 px-4 hover:bg-muted/50 rounded-lg transition-colors">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                <span className="text-sm text-foreground">Nómina (Dairo)</span>
              </div>
              <span className="text-sm font-medium text-foreground">{formatCurrencyFull(sueldoDairo)}</span>
            </div>
          )}

          {/* Total Dairo */}
          <div className="flex items-center justify-between py-3 px-4 bg-primary/5 rounded-lg border border-primary/20 mt-2">
            <span className="text-sm font-bold text-foreground">TOTAL DAIRO (Sueldo + Dividendos)</span>
            <span className="text-lg font-bold text-primary">{formatCurrencyFull(totalDairo)}</span>
          </div>

          {/* Utilidad Neta */}
          <div className={cn(
            "flex items-center justify-between py-3 px-4 rounded-lg border mt-3",
            (utilidadBruta - dividendosDairo) >= 0 ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"
          )}>
            <span className="text-sm font-bold text-foreground">UTILIDAD NETA (Reserva Empresa)</span>
            <span className={cn(
              "text-lg font-bold",
              reservaEmpresa >= 0 ? "text-success" : "text-destructive"
            )}>
              {formatCurrencyFull(reservaEmpresa)}
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Chart - responds to all filters */}
      {chartData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-1">
            Análisis Visual - {periodLabels[selectedPeriod]}
          </h3>
          <p className="text-xs text-muted-foreground mb-5">
            Comparación de ingresos, gastos y utilidad por período
          </p>

          <div className="space-y-5">
            {chartData.map((item) => {
              const maxVal = Math.max(...chartData.map(d => Math.max(d.ingresos, d.gastos)));
              const ingresosWidth = maxVal > 0 ? (item.ingresos / maxVal) * 100 : 0;
              const gastosWidth = maxVal > 0 ? (item.gastos / maxVal) * 100 : 0;
              const margen = item.ingresos > 0 ? ((item.utilidad / item.ingresos) * 100) : 0;

              return (
                <div key={item.label} className="group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-foreground">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-sm font-bold",
                        item.utilidad >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                      )}>
                        {item.utilidad >= 0 ? '+' : ''}{formatCurrency(item.utilidad)}
                      </span>
                      <span className={cn(
                        "text-xs font-medium px-1.5 py-0.5 rounded-full",
                        margen >= 25 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : margen >= 10 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      )}>
                        {margen.toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Ingresos bar */}
                  <div className="relative h-7 mb-1">
                    <div
                      className="absolute top-0 left-0 h-full bg-emerald-500/20 rounded-lg"
                      style={{ width: `${ingresosWidth}%`, minWidth: ingresosWidth > 0 ? '4px' : '0' }}
                    />
                    <div
                      className="absolute top-0.5 left-0 h-6 bg-emerald-500/70 rounded-md transition-all duration-500"
                      style={{ width: `${ingresosWidth}%`, minWidth: ingresosWidth > 0 ? '4px' : '0' }}
                    />
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className="text-xs font-medium text-foreground/80">
                        Ingresos: {formatCurrency(item.ingresos)}
                      </span>
                    </div>
                  </div>

                  {/* Gastos bar */}
                  <div className="relative h-7">
                    <div
                      className="absolute top-0 left-0 h-full bg-red-500/20 rounded-lg"
                      style={{ width: `${gastosWidth}%`, minWidth: gastosWidth > 0 ? '4px' : '0' }}
                    />
                    <div
                      className="absolute top-0.5 left-0 h-6 bg-red-500/70 rounded-md transition-all duration-500"
                      style={{ width: `${gastosWidth}%`, minWidth: gastosWidth > 0 ? '4px' : '0' }}
                    />
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className="text-xs font-medium text-foreground/80">
                        Gastos: {formatCurrency(item.gastos)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-5 pt-4 border-t border-border">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-500/70" />
              <span className="text-xs text-muted-foreground">Ingresos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-red-500/70" />
              <span className="text-xs text-muted-foreground">Gastos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1 rounded bg-foreground/30" />
              <span className="text-xs text-muted-foreground">Utilidad = Ingresos - Gastos</span>
            </div>
          </div>
        </div>
      )}

      {/* No Data */}
      {filteredIngresos.length === 0 && filteredGastos.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Sin Datos</h3>
              <p className="text-sm text-muted-foreground">
                No hay transacciones registradas en el período seleccionado.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
