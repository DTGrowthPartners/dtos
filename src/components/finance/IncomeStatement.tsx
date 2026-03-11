import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Target, Calendar, CalendarRange, Minus } from 'lucide-react';
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
type SelectedPeriod = MonthKey | 'q1' | 'custom';

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
  const [selectedPeriod, setSelectedPeriod] = useState<SelectedPeriod>('febrero');
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
  const dividendosDairo = utilidadBruta > 0 ? utilidadBruta * 0.25 : 0;
  const reservaEmpresa = utilidadBruta > 0 ? utilidadBruta * 0.75 : 0;

  // Sueldo Dairo (from budget data or default)
  const sueldoDairo = useMemo(() => {
    if (!budgetData?.gastos?.categorias) return 0;
    
    // Look for Nómina (Dairo) in gastos
    const dairoKey = Object.keys(budgetData.gastos.categorias).find(k => 
      k.toUpperCase().includes('DAIRO') && k.toUpperCase().includes('MINA')
    );
    
    if (!dairoKey) return 0;
    const data = budgetData.gastos.categorias[dairoKey];
    
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

  // Monthly chart data for Q1
  const monthlyData = useMemo(() => {
    const months = [
      { key: '2026-01', name: 'Enero' },
      { key: '2026-02', name: 'Febrero' },
      { key: '2026-03', name: 'Marzo' },
    ];

    return months.map(({ key, name }) => {
      const monthIngresos = ingresos
        .filter(t => !isExcluded(t.categoria) && normalizeDate(t.fecha).startsWith(key))
        .reduce((sum, t) => sum + t.importe, 0);
      const monthGastos = gastos
        .filter(t => !isExcluded(t.categoria) && normalizeDate(t.fecha).startsWith(key))
        .reduce((sum, t) => sum + t.importe, 0);
      const utilidad = monthIngresos - monthGastos;

      return {
        month: name,
        ingresos: monthIngresos,
        gastos: monthGastos,
        utilidad,
      };
    });
  }, [ingresos, gastos]);

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  };

  const formatCurrencyFull = (value: number) => `$${value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

  const periodLabels: Record<string, string> = {
    q1: 'Q1 2026',
    enero: 'Enero 2026',
    febrero: 'Febrero 2026',
    marzo: 'Marzo 2026',
    custom: dateRange?.from
      ? `${formatDateShort(dateRange.from)}${dateRange.to ? ` - ${formatDateShort(dateRange.to)}` : ''}`
      : 'Rango personalizado',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Estado de Resultados</h2>
        <p className="text-sm text-muted-foreground">
          Resultados financieros reales - {periodLabels[selectedPeriod]}
        </p>
      </div>

      {/* Period Selector */}
      <div className="flex flex-wrap gap-2">
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

      {/* Monthly Comparison Chart - only for Q1 */}
      {selectedPeriod === 'q1' && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-4">Comparación Mensual Q1</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: number, name: string) => [
                    formatCurrencyFull(value),
                    name === 'ingresos' ? 'Ingresos' : name === 'gastos' ? 'Gastos' : 'Utilidad'
                  ]}
                />
                <Bar dataKey="ingresos" name="ingresos" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gastos" name="gastos" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="utilidad" name="utilidad" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            {monthlyData.map((month) => (
              <div
                key={month.month}
                className={cn(
                  "p-3 rounded-lg border",
                  month.utilidad >= 0 ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"
                )}
              >
                <p className="text-sm font-medium text-foreground">{month.month}</p>
                <p className={cn(
                  "text-lg font-bold mt-1",
                  month.utilidad >= 0 ? "text-success" : "text-destructive"
                )}>
                  {formatCurrency(month.utilidad)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(month.ingresos)} - {formatCurrency(month.gastos)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Margen: {month.ingresos > 0 ? ((month.utilidad / month.ingresos) * 100).toFixed(1) : 0}%
                </p>
              </div>
            ))}
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
