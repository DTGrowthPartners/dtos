import { useState, useEffect, useMemo } from 'react';
import { DollarSign, TrendingUp, TrendingDown, CreditCard, ArrowUpRight, ArrowDownRight, Calendar, RefreshCw, Filter, X, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, Area, AreaChart } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface Transaction {
  fecha: string;
  importe: number;
  descripcion: string;
  categoria: string;
  cuenta: string;
  entidad: string;
}

interface FinanceResponse {
  financeByMonth: FinanceData[];
  expenseCategories: ExpenseCategory[];
  totalIncome: number;
  totalExpenses: number;
  ingresos: Transaction[];
  gastos: Transaction[];
}

export default function Finanzas() {
  const [financeData, setFinanceData] = useState<FinanceData[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [ingresos, setIngresos] = useState<Transaction[]>([]);
  const [gastos, setGastos] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('todas');
  const [filterType, setFilterType] = useState<'todas' | 'ingresos' | 'gastos'>('todas');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterDatePreset, setFilterDatePreset] = useState<string>('todas');
  const [showFilters, setShowFilters] = useState(true);

  // Date preset options (Shopify style)
  const datePresets = [
    { value: 'todas', label: 'Todas las fechas' },
    { value: 'today', label: 'Hoy' },
    { value: 'yesterday', label: 'Ayer' },
    { value: 'last7days', label: 'Últimos 7 días' },
    { value: 'last30days', label: 'Últimos 30 días' },
    { value: 'thisMonth', label: 'Este mes' },
    { value: 'lastMonth', label: 'Mes anterior' },
    { value: 'thisQuarter', label: 'Este trimestre' },
    { value: 'lastQuarter', label: 'Trimestre anterior' },
    { value: 'thisYear', label: 'Este año' },
    { value: 'lastYear', label: 'Año anterior' },
    { value: 'custom', label: 'Personalizado' },
  ];

  // Apply date preset
  const applyDatePreset = (preset: string) => {
    setFilterDatePreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    switch (preset) {
      case 'todas':
        setFilterDateFrom('');
        setFilterDateTo('');
        break;
      case 'today':
        setFilterDateFrom(todayStr);
        setFilterDateTo(todayStr);
        break;
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        setFilterDateFrom(yesterdayStr);
        setFilterDateTo(yesterdayStr);
        break;
      }
      case 'last7days': {
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 7);
        setFilterDateFrom(last7.toISOString().split('T')[0]);
        setFilterDateTo(todayStr);
        break;
      }
      case 'last30days': {
        const last30 = new Date(today);
        last30.setDate(last30.getDate() - 30);
        setFilterDateFrom(last30.toISOString().split('T')[0]);
        setFilterDateTo(todayStr);
        break;
      }
      case 'thisMonth': {
        const firstDayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        setFilterDateFrom(firstDayMonth.toISOString().split('T')[0]);
        setFilterDateTo(todayStr);
        break;
      }
      case 'lastMonth': {
        const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        setFilterDateFrom(firstDayLastMonth.toISOString().split('T')[0]);
        setFilterDateTo(lastDayLastMonth.toISOString().split('T')[0]);
        break;
      }
      case 'thisQuarter': {
        const quarter = Math.floor(today.getMonth() / 3);
        const firstDayQuarter = new Date(today.getFullYear(), quarter * 3, 1);
        setFilterDateFrom(firstDayQuarter.toISOString().split('T')[0]);
        setFilterDateTo(todayStr);
        break;
      }
      case 'lastQuarter': {
        const currentQuarter = Math.floor(today.getMonth() / 3);
        const lastQuarter = currentQuarter - 1;
        const year = lastQuarter < 0 ? today.getFullYear() - 1 : today.getFullYear();
        const adjustedQuarter = lastQuarter < 0 ? 3 : lastQuarter;
        const firstDayLastQuarter = new Date(year, adjustedQuarter * 3, 1);
        const lastDayLastQuarter = new Date(year, adjustedQuarter * 3 + 3, 0);
        setFilterDateFrom(firstDayLastQuarter.toISOString().split('T')[0]);
        setFilterDateTo(lastDayLastQuarter.toISOString().split('T')[0]);
        break;
      }
      case 'thisYear': {
        const firstDayYear = new Date(today.getFullYear(), 0, 1);
        setFilterDateFrom(firstDayYear.toISOString().split('T')[0]);
        setFilterDateTo(todayStr);
        break;
      }
      case 'lastYear': {
        const firstDayLastYear = new Date(today.getFullYear() - 1, 0, 1);
        const lastDayLastYear = new Date(today.getFullYear() - 1, 11, 31);
        setFilterDateFrom(firstDayLastYear.toISOString().split('T')[0]);
        setFilterDateTo(lastDayLastYear.toISOString().split('T')[0]);
        break;
      }
      case 'custom':
        // Keep current dates for custom
        break;
    }
  };

  // Table filters and collapse states
  const [showIngresosTable, setShowIngresosTable] = useState(false);
  const [showGastosTable, setShowGastosTable] = useState(false);
  const [ingresosSearchTerm, setIngresosSearchTerm] = useState('');
  const [gastosSearchTerm, setGastosSearchTerm] = useState('');

  const { toast } = useToast();

  // Helper function to normalize dates to YYYY-MM-DD format for comparison
  const normalizeDate = (dateStr: string): string => {
    if (!dateStr) return '';

    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }

    // Try parsing DD/MM/YYYY format (most common in Spanish-speaking countries)
    const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const [, part1, part2, year] = slashMatch;
      const num1 = parseInt(part1);
      const num2 = parseInt(part2);

      // If first part is > 12, it must be day (DD/MM/YYYY format)
      if (num1 > 12) {
        return `${year}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`;
      }
      // If second part is > 12, it must be DD/MM/YYYY format
      else if (num2 > 12) {
        return `${year}-${part1.padStart(2, '0')}-${part2.padStart(2, '0')}`;
      }
      // Ambiguous case - assume DD/MM/YYYY format (common in Spanish/Latin America)
      else {
        return `${year}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`;
      }
    }

    // Try parsing YYYY/MM/DD format
    const yearFirstMatch = dateStr.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (yearFirstMatch) {
      const [, year, month, day] = yearFirstMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Try to parse as a general date
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {
      console.warn('Could not parse date:', dateStr);
    }

    return dateStr;
  };

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
      setIngresos(data.ingresos || []);
      setGastos(data.gastos || []);
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

  // Get all unique categories (must be before any conditional returns)
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    [...ingresos, ...gastos].forEach(t => {
      if (t.categoria) cats.add(t.categoria);
    });
    return ['todas', ...Array.from(cats)];
  }, [ingresos, gastos]);

  // Filter transactions with search and date range
  const filteredIngresos = useMemo(() => {
    return ingresos.filter(t => {
      if (filterType === 'gastos') return false;
      if (filterCategory !== 'todas' && t.categoria !== filterCategory) return false;

      // Date range filter with normalization
      if (filterDateFrom || filterDateTo) {
        const normalizedTransactionDate = normalizeDate(t.fecha);
        if (filterDateFrom && normalizedTransactionDate < filterDateFrom) return false;
        if (filterDateTo && normalizedTransactionDate > filterDateTo) return false;
      }

      // Search filter
      if (ingresosSearchTerm) {
        const searchLower = ingresosSearchTerm.toLowerCase();
        return (
          t.descripcion.toLowerCase().includes(searchLower) ||
          t.categoria.toLowerCase().includes(searchLower) ||
          t.entidad.toLowerCase().includes(searchLower) ||
          t.fecha.includes(searchLower)
        );
      }

      return true;
    });
  }, [ingresos, filterCategory, filterType, filterDateFrom, filterDateTo, ingresosSearchTerm]);

  const filteredGastos = useMemo(() => {
    return gastos.filter(t => {
      if (filterType === 'ingresos') return false;
      if (filterCategory !== 'todas' && t.categoria !== filterCategory) return false;

      // Date range filter with normalization
      if (filterDateFrom || filterDateTo) {
        const normalizedTransactionDate = normalizeDate(t.fecha);
        if (filterDateFrom && normalizedTransactionDate < filterDateFrom) return false;
        if (filterDateTo && normalizedTransactionDate > filterDateTo) return false;
      }

      // Search filter
      if (gastosSearchTerm) {
        const searchLower = gastosSearchTerm.toLowerCase();
        return (
          t.descripcion.toLowerCase().includes(searchLower) ||
          t.categoria.toLowerCase().includes(searchLower) ||
          t.entidad.toLowerCase().includes(searchLower) ||
          t.fecha.includes(searchLower)
        );
      }

      return true;
    });
  }, [gastos, filterCategory, filterType, filterDateFrom, filterDateTo, gastosSearchTerm]);

  // Calculate filtered totals
  const filteredTotalIncome = filteredIngresos.reduce((sum, t) => sum + t.importe, 0);
  const filteredTotalExpenses = filteredGastos.reduce((sum, t) => sum + t.importe, 0);

  // Helper to filter transactions by date range
  const filterByDateRange = (transactions: Transaction[], from: string, to: string) => {
    return transactions.filter(t => {
      const date = normalizeDate(t.fecha);
      return date >= from && date <= to;
    });
  };

  // Calculate period totals for quick filters
  const periodTotals = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // This week (last 7 days)
    const last7 = new Date(today);
    last7.setDate(last7.getDate() - 7);
    const last7Str = last7.toISOString().split('T')[0];

    // This month
    const firstDayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayMonthStr = firstDayMonth.toISOString().split('T')[0];

    // This year
    const firstDayYear = new Date(today.getFullYear(), 0, 1);
    const firstDayYearStr = firstDayYear.toISOString().split('T')[0];

    // Today
    const todayIngresos = filterByDateRange(ingresos, todayStr, todayStr);
    const todayGastos = filterByDateRange(gastos, todayStr, todayStr);

    // This week
    const weekIngresos = filterByDateRange(ingresos, last7Str, todayStr);
    const weekGastos = filterByDateRange(gastos, last7Str, todayStr);

    // This month
    const monthIngresos = filterByDateRange(ingresos, firstDayMonthStr, todayStr);
    const monthGastos = filterByDateRange(gastos, firstDayMonthStr, todayStr);

    // This year
    const yearIngresos = filterByDateRange(ingresos, firstDayYearStr, todayStr);
    const yearGastos = filterByDateRange(gastos, firstDayYearStr, todayStr);

    return {
      today: {
        income: todayIngresos.reduce((sum, t) => sum + t.importe, 0),
        expenses: todayGastos.reduce((sum, t) => sum + t.importe, 0),
      },
      week: {
        income: weekIngresos.reduce((sum, t) => sum + t.importe, 0),
        expenses: weekGastos.reduce((sum, t) => sum + t.importe, 0),
      },
      month: {
        income: monthIngresos.reduce((sum, t) => sum + t.importe, 0),
        expenses: monthGastos.reduce((sum, t) => sum + t.importe, 0),
      },
      year: {
        income: yearIngresos.reduce((sum, t) => sum + t.importe, 0),
        expenses: yearGastos.reduce((sum, t) => sum + t.importe, 0),
      },
    };
  }, [ingresos, gastos]);

  // Top 5 expenses and income
  const topExpenses = useMemo(() => {
    return [...gastos]
      .sort((a, b) => b.importe - a.importe)
      .slice(0, 5);
  }, [gastos]);

  const topIncome = useMemo(() => {
    return [...ingresos]
      .sort((a, b) => b.importe - a.importe)
      .slice(0, 5);
  }, [ingresos]);

  // Group by entity
  const entityStats = useMemo(() => {
    const stats = new Map<string, { income: number; expenses: number }>();

    ingresos.forEach(t => {
      const current = stats.get(t.entidad) || { income: 0, expenses: 0 };
      stats.set(t.entidad, { ...current, income: current.income + t.importe });
    });

    gastos.forEach(t => {
      const current = stats.get(t.entidad) || { income: 0, expenses: 0 };
      stats.set(t.entidad, { ...current, expenses: current.expenses + t.importe });
    });

    return Array.from(stats.entries())
      .map(([name, data]) => ({
        name,
        ingresos: data.income,
        gastos: data.expenses,
        balance: data.income - data.expenses
      }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
      .slice(0, 10);
  }, [ingresos, gastos]);

  const clearFilters = () => {
    setFilterCategory('todas');
    setFilterType('todas');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterDatePreset('todas');
  };

  const hasActiveFilters = filterCategory !== 'todas' || filterType !== 'todas' || filterDatePreset !== 'todas';

  // Calculations that depend on data
  const currentMonth = financeData[financeData.length - 1] || { month: '', income: 0, expenses: 0 };
  const previousMonth = financeData[financeData.length - 2] || { month: '', income: 0, expenses: 0 };

  const incomeGrowth = previousMonth.income > 0
    ? ((currentMonth.income - previousMonth.income) / previousMonth.income) * 100
    : 0;
  const expensesGrowth = previousMonth.expenses > 0
    ? ((currentMonth.expenses - previousMonth.expenses) / previousMonth.expenses) * 100
    : 0;

  // Use filtered totals for display
  const displayIncome = hasActiveFilters ? filteredTotalIncome : totalIncome;
  const displayExpenses = hasActiveFilters ? filteredTotalExpenses : totalExpenses;
  const netProfit = displayIncome - displayExpenses;
  const profitMargin = displayIncome > 0 ? (netProfit / displayIncome) * 100 : 0;

  // Loading state check AFTER all hooks
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Finanzas</h1>
            <p className="text-muted-foreground text-sm">Datos desde Google Sheets - {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="w-full sm:w-auto"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros
              {hasActiveFilters && <span className="ml-2 h-2 w-2 rounded-full bg-primary"></span>}
            </Button>
            <Button
              variant="outline"
              onClick={fetchFinanceData}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="rounded-xl border border-border bg-card p-4 animate-in slide-in-from-top-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              <div className="w-full">
                <label className="text-sm font-medium text-foreground mb-2 block">Tipo</label>
                <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las transacciones</SelectItem>
                    <SelectItem value="ingresos">Solo ingresos</SelectItem>
                    <SelectItem value="gastos">Solo gastos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full">
                <label className="text-sm font-medium text-foreground mb-2 block">Categoría</label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat === 'todas' ? 'Todas las categorías' : cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full">
                <label className="text-sm font-medium text-foreground mb-2 block">Período</label>
                <Select value={filterDatePreset} onValueChange={applyDatePreset}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar período" />
                  </SelectTrigger>
                  <SelectContent>
                    {datePresets.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Custom date range inputs - only show when "Personalizado" is selected */}
            {filterDatePreset === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
                <div className="w-full">
                  <label className="text-sm font-medium text-foreground mb-2 block">Fecha Desde</label>
                  <Input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="w-full"
                  />
                </div>

                <div className="w-full">
                  <label className="text-sm font-medium text-foreground mb-2 block">Fecha Hasta</label>
                  <Input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {/* Show selected date range info */}
            {filterDatePreset !== 'todas' && filterDateFrom && filterDateTo && (
              <div className="mt-3 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 inline mr-1" />
                {filterDateFrom} → {filterDateTo}
              </div>
            )}

            {hasActiveFilters && (
              <div className="mt-4 pt-4 border-t border-border flex justify-end">
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  size="sm"
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpiar filtros
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Filter Buttons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Hoy */}
        <button
          onClick={() => applyDatePreset('today')}
          className={cn(
            "p-4 rounded-xl border transition-all hover:shadow-md text-left",
            filterDatePreset === 'today'
              ? "border-primary bg-primary/10 shadow-sm"
              : "border-border bg-card hover:border-primary/50"
          )}
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hoy</p>
          <p className="text-sm font-semibold text-foreground mt-1 capitalize">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Ingresos</span>
              <span className="text-xs font-medium text-success">${periodTotals.today.income.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Gastos</span>
              <span className="text-xs font-medium text-destructive">${periodTotals.today.expenses.toLocaleString()}</span>
            </div>
          </div>
        </button>

        {/* Esta Semana */}
        <button
          onClick={() => applyDatePreset('last7days')}
          className={cn(
            "p-4 rounded-xl border transition-all hover:shadow-md text-left",
            filterDatePreset === 'last7days'
              ? "border-primary bg-primary/10 shadow-sm"
              : "border-border bg-card hover:border-primary/50"
          )}
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Esta Semana</p>
          <p className="text-sm font-semibold text-foreground mt-1">Últimos 7 días</p>
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Ingresos</span>
              <span className="text-xs font-medium text-success">${periodTotals.week.income.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Gastos</span>
              <span className="text-xs font-medium text-destructive">${periodTotals.week.expenses.toLocaleString()}</span>
            </div>
          </div>
        </button>

        {/* Este Mes */}
        <button
          onClick={() => applyDatePreset('thisMonth')}
          className={cn(
            "p-4 rounded-xl border transition-all hover:shadow-md text-left",
            filterDatePreset === 'thisMonth'
              ? "border-primary bg-primary/10 shadow-sm"
              : "border-border bg-card hover:border-primary/50"
          )}
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Este Mes</p>
          <p className="text-sm font-semibold text-foreground mt-1 capitalize">
            {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </p>
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Ingresos</span>
              <span className="text-xs font-medium text-success">${periodTotals.month.income.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Gastos</span>
              <span className="text-xs font-medium text-destructive">${periodTotals.month.expenses.toLocaleString()}</span>
            </div>
          </div>
        </button>

        {/* Este Año */}
        <button
          onClick={() => applyDatePreset('thisYear')}
          className={cn(
            "p-4 rounded-xl border transition-all hover:shadow-md text-left",
            filterDatePreset === 'thisYear'
              ? "border-primary bg-primary/10 shadow-sm"
              : "border-border bg-card hover:border-primary/50"
          )}
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Este Año</p>
          <p className="text-sm font-semibold text-foreground mt-1">{new Date().getFullYear()}</p>
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Ingresos</span>
              <span className="text-xs font-medium text-success">${periodTotals.year.income.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Gastos</span>
              <span className="text-xs font-medium text-destructive">${periodTotals.year.expenses.toLocaleString()}</span>
            </div>
          </div>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Ingresos {hasActiveFilters ? '(Filtrado)' : 'Totales'}
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">${displayIncome.toLocaleString()}</p>
              {hasActiveFilters && (
                <p className="text-xs text-muted-foreground mt-1">
                  Total: ${totalIncome.toLocaleString()}
                </p>
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
              <p className="text-sm text-muted-foreground">
                Gastos {hasActiveFilters ? '(Filtrado)' : 'Totales'}
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">${displayExpenses.toLocaleString()}</p>
              {hasActiveFilters && (
                <p className="text-xs text-muted-foreground mt-1">
                  Total: ${totalExpenses.toLocaleString()}
                </p>
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
              <p className="text-sm text-muted-foreground">
                Beneficio Neto {hasActiveFilters ? '(Filtrado)' : ''}
              </p>
              <p className={cn("text-2xl font-bold mt-1", netProfit >= 0 ? "text-success" : "text-destructive")}>
                ${netProfit.toLocaleString()}
              </p>
              <p className={cn("text-sm mt-2", profitMargin >= 0 ? "text-success" : "text-destructive")}>
                {profitMargin.toFixed(1)}% margen
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Transacciones</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {hasActiveFilters
                  ? filteredIngresos.length + filteredGastos.length
                  : ingresos.length + gastos.length
                }
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {hasActiveFilters
                  ? `${filteredIngresos.length} ing. / ${filteredGastos.length} gas.`
                  : `${ingresos.length} ing. / ${gastos.length} gas.`
                }
              </p>
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
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
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
                      formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
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
                    <span className="font-medium text-foreground whitespace-nowrap ml-2">${cat.value.toLocaleString()}</span>
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

      {/* Additional Charts Row */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Top Transactions */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-2">Top 5 Transacciones</h3>
          <p className="text-sm text-muted-foreground mb-4">Mayores montos</p>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-success mb-2">INGRESOS</p>
              <div className="space-y-2">
                {topIncome.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-success/5 hover:bg-success/10 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.descripcion}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.entidad}</p>
                    </div>
                    <span className="text-sm font-bold text-success ml-2 whitespace-nowrap">${item.importe.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-destructive mb-2">GASTOS</p>
              <div className="space-y-2">
                {topExpenses.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-destructive/5 hover:bg-destructive/10 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.descripcion}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.entidad}</p>
                    </div>
                    <span className="text-sm font-bold text-destructive ml-2 whitespace-nowrap">${item.importe.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Balance by Entity */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-2">Balance por Entidad</h3>
          <p className="text-sm text-muted-foreground mb-4">Top 6 entidades</p>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={entityStats.slice(0, 6)} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => `$${value.toLocaleString()}`}
                />
                <Legend />
                <Bar dataKey="ingresos" fill="hsl(var(--success))" name="Ingresos" radius={[0, 4, 4, 0]} />
                <Bar dataKey="gastos" fill="hsl(var(--destructive))" name="Gastos" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tablas de Transacciones */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tabla de Ingresos */}
        <div className="rounded-xl border border-border bg-card">
          <button
            onClick={() => setShowIngresosTable(!showIngresosTable)}
            className="w-full p-6 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-t-xl"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-foreground">Ingresos (Entradas)</h3>
                <p className="text-sm text-muted-foreground">
                  {filteredIngresos.length} transacciones • ${filteredTotalIncome.toLocaleString()}
                </p>
              </div>
            </div>
            {showIngresosTable ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>

          {showIngresosTable && (
            <div className="px-6 pb-6 space-y-4 border-t border-border">
              {/* Search Filter */}
              <div className="pt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Buscar por descripción, categoría, entidad o fecha..."
                    value={ingresosSearchTerm}
                    onChange={(e) => setIngresosSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
          <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
            <div className="min-w-[600px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground whitespace-nowrap">Fecha</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Descripción</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden sm:table-cell">Categoría</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden md:table-cell">Entidad</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground whitespace-nowrap">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIngresos.length > 0 ? (
                    filteredIngresos.map((ingreso, index) => (
                      <tr key={index} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-2 text-foreground whitespace-nowrap text-xs sm:text-sm">{ingreso.fecha}</td>
                        <td className="py-3 px-2 text-foreground">
                          <div className="max-w-[200px] sm:max-w-none">
                            <p className="truncate">{ingreso.descripcion}</p>
                            <p className="text-xs text-muted-foreground sm:hidden truncate">{ingreso.categoria} • {ingreso.entidad}</p>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">{ingreso.categoria}</td>
                        <td className="py-3 px-2 text-muted-foreground hidden md:table-cell truncate max-w-[150px]">{ingreso.entidad}</td>
                        <td className="py-3 px-2 text-right font-medium text-success whitespace-nowrap">${ingreso.importe.toLocaleString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        {hasActiveFilters ? 'No hay ingresos con los filtros aplicados' : 'No hay ingresos registrados'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
            </div>
          )}
        </div>

        {/* Tabla de Gastos */}
        <div className="rounded-xl border border-border bg-card">
          <button
            onClick={() => setShowGastosTable(!showGastosTable)}
            className="w-full p-6 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-t-xl"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-foreground">Gastos (Salidas)</h3>
                <p className="text-sm text-muted-foreground">
                  {filteredGastos.length} transacciones • ${filteredTotalExpenses.toLocaleString()}
                </p>
              </div>
            </div>
            {showGastosTable ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>

          {showGastosTable && (
            <div className="px-6 pb-6 space-y-4 border-t border-border">
              {/* Search Filter */}
              <div className="pt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Buscar por descripción, categoría, entidad o fecha..."
                    value={gastosSearchTerm}
                    onChange={(e) => setGastosSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
          <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
            <div className="min-w-[600px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground whitespace-nowrap">Fecha</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Descripción</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden sm:table-cell">Categoría</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden md:table-cell">Entidad</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground whitespace-nowrap">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGastos.length > 0 ? (
                    filteredGastos.map((gasto, index) => (
                      <tr key={index} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-2 text-foreground whitespace-nowrap text-xs sm:text-sm">{gasto.fecha}</td>
                        <td className="py-3 px-2 text-foreground">
                          <div className="max-w-[200px] sm:max-w-none">
                            <p className="truncate">{gasto.descripcion}</p>
                            <p className="text-xs text-muted-foreground sm:hidden truncate">{gasto.categoria} • {gasto.entidad}</p>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">{gasto.categoria}</td>
                        <td className="py-3 px-2 text-muted-foreground hidden md:table-cell truncate max-w-[150px]">{gasto.entidad}</td>
                        <td className="py-3 px-2 text-right font-medium text-destructive whitespace-nowrap">${gasto.importe.toLocaleString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        {hasActiveFilters ? 'No hay gastos con los filtros aplicados' : 'No hay gastos registrados'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
