import { useState, useEffect, useMemo } from 'react';
import { DollarSign, TrendingUp, TrendingDown, CreditCard, ArrowUpRight, ArrowDownRight, Calendar, RefreshCw, Filter, X, ChevronDown, ChevronUp, Search, Users, FileText, Receipt, Wallet, Building2 } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TercerosModal } from '@/components/modals/TercerosModal';
import { NominaModal } from '@/components/modals/NominaModal';
import AccountsPanel from '@/components/finance/AccountsPanel';
import InvoicesPanel from '@/components/finance/InvoicesPanel';
import BudgetComparisonReport from '@/components/finance/BudgetComparisonReport';
import IncomeReport from '@/components/finance/IncomeReport';
import ClientGoalsPanel from '@/components/finance/ClientGoalsPanel';

// Categorías predefinidas
const EXPENSE_CATEGORIES = [
  'Arriendo',
  'Nómina (Dairo)',
  'Nómina (Edgardo)',
  'Nómina (Stiven)',
  'Almuerzos',
  'Transportes - Gasolina',
  'Meriendas',
  'Herramientas (Claude, GPT, Lovable, Twilio, Etc)',
  'Publicidad',
  'Servidores/Hosting/Dominios',
  'Gastos de Representación',
  'Freelancers',
  'Comisiones de Cierre',
  'Honorarios Contador',
  'REEMBOLSO',
  'REEMBOLSO INVERSIÓN PUBLICIDAD',
  'TRASLADO DE NEQUI',
  'TRASLADO DE DAVIPLATA',
  'TRASLADO DE BANCOLOMBIA',
  'TRASLADO DE RAPPICUENTA',
  'AJUSTE SALDO',
  'TRASLADO CUENTA DAIRO',
];

const INCOME_CATEGORIES = [
  'PAGO DE CLIENTE',
  'TRASLADO DE NEQUI',
  'TRASLADO DE DAVIPLATA',
  'TRASLADO DE BANCOLOMBIA',
  'TRASLADO DE RAPPICUENTA',
  'POR DEFINIR',
  'OTROS',
  'FINANCIEROS',
  'REEMBOLSO',
  'REVERSIONES',
  'AJUSTE SALDO',
];

// Categorías que son traslados entre cuentas (requieren registro dual)
const TRANSFER_CATEGORIES = [
  'TRASLADO DE NEQUI',
  'TRASLADO DE DAVIPLATA',
  'TRASLADO DE BANCOLOMBIA',
  'TRASLADO DE RAPPICUENTA',
];

// Cuentas disponibles
const AVAILABLE_ACCOUNTS = [
  'Bancolombia *5993',
  'Bancolombia *7710',
  'Nequi',
  'Daviplata',
  'Rappicuenta',
];

// Bancos preestablecidos para entradas (alias para compatibilidad)
const PRESET_BANKS = AVAILABLE_ACCOUNTS;

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

interface CuentaDisponible {
  cuenta: string;
  saldo: number;
}

interface DisponibleResponse {
  cuentas: CuentaDisponible[];
  totalDisponible: number;
}

// Helper to check if a category is AJUSTE SALDO (case-insensitive, trim whitespace)
const isAjusteSaldo = (categoria: string | undefined | null): boolean => {
  if (!categoria) return false;
  return categoria.trim().toUpperCase() === 'AJUSTE SALDO';
};

// Helper function to format currency in a compact way
const formatCompactCurrency = (value: number): string => {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1000000) {
    // 1M+ -> show as X.XM
    return `${sign}$${(absValue / 1000000).toFixed(1)}M`;
  } else if (absValue >= 10000) {
    // 10K+ -> show as XK (no decimal)
    return `${sign}$${Math.round(absValue / 1000)}K`;
  } else if (absValue >= 1000) {
    // 1K-10K -> show as X.XK
    return `${sign}$${(absValue / 1000).toFixed(1)}K`;
  } else {
    // Less than 1K -> show full number
    return `${sign}$${Math.round(absValue).toLocaleString()}`;
  }
};

export default function Finanzas() {
  const [activeTab, setActiveTab] = useState<string>('resumen');
  const [financeData, setFinanceData] = useState<FinanceData[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [ingresos, setIngresos] = useState<Transaction[]>([]);
  const [gastos, setGastos] = useState<Transaction[]>([]);
  const [disponible, setDisponible] = useState<CuentaDisponible[]>([]);
  const [totalDisponible, setTotalDisponible] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('todas');
  const [filterType, setFilterType] = useState<'todas' | 'ingresos' | 'gastos'>('todas');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterDatePreset, setFilterDatePreset] = useState<string>('thisMonth');
  const [showFilters, setShowFilters] = useState(true);

  // Modals
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showAddIncomeModal, setShowAddIncomeModal] = useState(false);
  const [showTercerosModal, setShowTercerosModal] = useState(false);
  const [showNominaModal, setShowNominaModal] = useState(false);

  // Form states
  const [expenseForm, setExpenseForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    importe: '',
    descripcion: '',
    categoria: '',
    cuenta: '',
    entidad: '',
  });

  // Form state for income
  const [incomeForm, setIncomeForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    importe: '',
    descripcion: '',
    categoria: '',
    cuenta: '',
    entidad: '',
    cuentaOrigen: '', // For transfers: source account
  });

  // Check if selected category is a transfer
  const isTransferCategory = TRANSFER_CATEGORIES.includes(incomeForm.categoria);

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

  // Helper to get local date string YYYY-MM-DD
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Apply date preset
  const applyDatePreset = (preset: string) => {
    setFilterDatePreset(preset);
    const today = new Date();
    const todayStr = getLocalDateString(today);

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
        const yesterdayStr = getLocalDateString(yesterday);
        setFilterDateFrom(yesterdayStr);
        setFilterDateTo(yesterdayStr);
        break;
      }
      case 'last7days': {
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 7);
        setFilterDateFrom(getLocalDateString(last7));
        setFilterDateTo(todayStr);
        break;
      }
      case 'last30days': {
        const last30 = new Date(today);
        last30.setDate(last30.getDate() - 30);
        setFilterDateFrom(getLocalDateString(last30));
        setFilterDateTo(todayStr);
        break;
      }
      case 'thisMonth': {
        const firstDayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        setFilterDateFrom(getLocalDateString(firstDayMonth));
        setFilterDateTo(todayStr);
        break;
      }
      case 'lastMonth': {
        const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        setFilterDateFrom(getLocalDateString(firstDayLastMonth));
        setFilterDateTo(getLocalDateString(lastDayLastMonth));
        break;
      }
      case 'thisQuarter': {
        const quarter = Math.floor(today.getMonth() / 3);
        const firstDayQuarter = new Date(today.getFullYear(), quarter * 3, 1);
        setFilterDateFrom(getLocalDateString(firstDayQuarter));
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
        setFilterDateFrom(getLocalDateString(firstDayLastQuarter));
        setFilterDateTo(getLocalDateString(lastDayLastQuarter));
        break;
      }
      case 'thisYear': {
        const firstDayYear = new Date(today.getFullYear(), 0, 1);
        setFilterDateFrom(getLocalDateString(firstDayYear));
        setFilterDateTo(todayStr);
        break;
      }
      case 'lastYear': {
        const firstDayLastYear = new Date(today.getFullYear() - 1, 0, 1);
        const lastDayLastYear = new Date(today.getFullYear() - 1, 11, 31);
        setFilterDateFrom(getLocalDateString(firstDayLastYear));
        setFilterDateTo(getLocalDateString(lastDayLastYear));
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

  // Apply initial date preset filter
  useEffect(() => {
    applyDatePreset('thisMonth');
  }, []);

  const fetchFinanceData = async () => {
    try {
      setIsLoading(true);

      // Fetch finance data and disponible in parallel
      const [data, disponibleData] = await Promise.all([
        apiClient.get<FinanceResponse>('/api/finance/data'),
        apiClient.get<DisponibleResponse>('/api/finance/disponible'),
      ]);

      setFinanceData(data.financeByMonth);
      setExpenseCategories(data.expenseCategories);
      setTotalIncome(data.totalIncome);
      setTotalExpenses(data.totalExpenses);
      setIngresos(data.ingresos || []);
      setGastos(data.gastos || []);

      // Set disponible data
      setDisponible(disponibleData.cuentas || []);
      setTotalDisponible(disponibleData.totalDisponible || 0);
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

  // Get all unique categories (must be before any conditional returns, excluding AJUSTE SALDO)
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    [...ingresos, ...gastos].forEach(t => {
      if (t.categoria && !isAjusteSaldo(t.categoria)) cats.add(t.categoria);
    });
    return ['todas', ...Array.from(cats)];
  }, [ingresos, gastos]);

  // Filter transactions with search and date range (excluding AJUSTE SALDO)
  const filteredIngresos = useMemo(() => {
    return ingresos.filter(t => {
      // Always exclude AJUSTE SALDO - it's just a balance adjustment
      if (isAjusteSaldo(t.categoria)) return false;
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
      // Always exclude AJUSTE SALDO - it's just a balance adjustment
      if (isAjusteSaldo(t.categoria)) return false;
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

  // Calculate filtered totals (filteredIngresos/filteredGastos already exclude AJUSTE SALDO)
  const filteredTotalIncome = filteredIngresos.reduce((sum, t) => sum + t.importe, 0);
  const filteredTotalExpenses = filteredGastos.reduce((sum, t) => sum + t.importe, 0);

  // Debug filtered income
  console.log('========== FILTERED INCOME DEBUG ==========');
  console.log('Filter settings:', { filterDateFrom, filterDateTo, filterDatePreset, filterCategory, filterType });
  console.log('All ingresos count:', ingresos.length);
  console.log('Filtered ingresos count:', filteredIngresos.length);
  console.log('Filtered ingresos:', filteredIngresos.map(t => ({ fecha: t.fecha, importe: t.importe, descripcion: t.descripcion })));
  console.log('Filtered total income:', filteredTotalIncome);
  console.log('==========================================');

  // Calculate base totals (all transactions excluding AJUSTE SALDO, no other filters)
  const baseTotalIncome = useMemo(() => {
    const filtered = ingresos.filter(t => !isAjusteSaldo(t.categoria));
    const total = filtered.reduce((sum, t) => sum + t.importe, 0);
    // Debug log to verify calculation
    const excluded = ingresos.filter(t => isAjusteSaldo(t.categoria));
    console.log('Finanzas Debug - Income calculation:', {
      totalTransactions: ingresos.length,
      excludedAjusteSaldo: excluded.length,
      excludedCategories: excluded.map(t => t.categoria),
      excludedAmount: excluded.reduce((sum, t) => sum + t.importe, 0),
      includedTransactions: filtered.length,
      baseTotalIncome: total,
    });
    return total;
  }, [ingresos]);

  const baseTotalExpenses = useMemo(() =>
    gastos.filter(t => !isAjusteSaldo(t.categoria)).reduce((sum, t) => sum + t.importe, 0),
    [gastos]
  );

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
    const todayStr = getLocalDateString(today);

    // This week (last 7 days)
    const last7 = new Date(today);
    last7.setDate(last7.getDate() - 7);
    const last7Str = getLocalDateString(last7);

    // This month
    const firstDayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayMonthStr = getLocalDateString(firstDayMonth);

    // This year
    const firstDayYear = new Date(today.getFullYear(), 0, 1);
    const firstDayYearStr = getLocalDateString(firstDayYear);

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

    // Helper to exclude "AJUSTE SALDO" from totals
    const excludeAjuste = (arr: Transaction[]) => arr.filter(t => !isAjusteSaldo(t.categoria));

    return {
      today: {
        income: excludeAjuste(todayIngresos).reduce((sum, t) => sum + t.importe, 0),
        expenses: excludeAjuste(todayGastos).reduce((sum, t) => sum + t.importe, 0),
      },
      week: {
        income: excludeAjuste(weekIngresos).reduce((sum, t) => sum + t.importe, 0),
        expenses: excludeAjuste(weekGastos).reduce((sum, t) => sum + t.importe, 0),
      },
      month: {
        income: excludeAjuste(monthIngresos).reduce((sum, t) => sum + t.importe, 0),
        expenses: excludeAjuste(monthGastos).reduce((sum, t) => sum + t.importe, 0),
      },
      year: {
        income: excludeAjuste(yearIngresos).reduce((sum, t) => sum + t.importe, 0),
        expenses: excludeAjuste(yearGastos).reduce((sum, t) => sum + t.importe, 0),
      },
    };
  }, [ingresos, gastos]);

  // Top 5 expenses and income (filtered)
  const topExpenses = useMemo(() => {
    return [...filteredGastos]
      .sort((a, b) => b.importe - a.importe)
      .slice(0, 5);
  }, [filteredGastos]);

  const topIncome = useMemo(() => {
    return [...filteredIngresos]
      .sort((a, b) => b.importe - a.importe)
      .slice(0, 5);
  }, [filteredIngresos]);

  // Filtered expense categories for PieChart (excluding "AJUSTE SALDO")
  const filteredExpenseCategories = useMemo(() => {
    const categoryMap = new Map<string, number>();

    filteredGastos.forEach(t => {
      // Exclude "AJUSTE SALDO" from categories
      if (t.categoria && !isAjusteSaldo(t.categoria)) {
        const current = categoryMap.get(t.categoria) || 0;
        categoryMap.set(t.categoria, current + t.importe);
      }
    });

    const colors = [
      'hsl(var(--primary))',
      'hsl(var(--destructive))',
      'hsl(var(--success))',
      'hsl(var(--warning))',
      '#8884d8',
      '#82ca9d',
      '#ffc658',
      '#ff7c43',
      '#665191',
      '#a05195',
    ];

    return Array.from(categoryMap.entries())
      .map(([name, value], index) => ({
        name,
        value,
        color: colors[index % colors.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 categories
  }, [filteredGastos]);

  // Filtered finance by month data for BarChart
  const filteredFinanceByMonth = useMemo(() => {
    // Group filtered transactions by month
    const monthlyData = new Map<string, { income: number; expenses: number }>();

    filteredIngresos.forEach(t => {
      const normalizedDate = normalizeDate(t.fecha);
      if (normalizedDate) {
        const monthKey = normalizedDate.substring(0, 7); // YYYY-MM
        const current = monthlyData.get(monthKey) || { income: 0, expenses: 0 };
        monthlyData.set(monthKey, { ...current, income: current.income + t.importe });
      }
    });

    filteredGastos.forEach(t => {
      const normalizedDate = normalizeDate(t.fecha);
      if (normalizedDate) {
        const monthKey = normalizedDate.substring(0, 7); // YYYY-MM
        const current = monthlyData.get(monthKey) || { income: 0, expenses: 0 };
        monthlyData.set(monthKey, { ...current, expenses: current.expenses + t.importe });
      }
    });

    // Convert to array and sort by month
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    return Array.from(monthlyData.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6) // Last 6 months
      .map(([monthKey, data]) => {
        const [year, month] = monthKey.split('-');
        const monthIndex = parseInt(month) - 1;
        return {
          month: `${monthNames[monthIndex]} ${year.slice(2)}`,
          income: data.income,
          expenses: data.expenses,
        };
      });
  }, [filteredIngresos, filteredGastos]);

  // Filtered entity stats
  const filteredEntityStats = useMemo(() => {
    const stats = new Map<string, { income: number; expenses: number }>();

    filteredIngresos.forEach(t => {
      const current = stats.get(t.entidad) || { income: 0, expenses: 0 };
      stats.set(t.entidad, { ...current, income: current.income + t.importe });
    });

    filteredGastos.forEach(t => {
      const current = stats.get(t.entidad) || { income: 0, expenses: 0 };
      stats.set(t.entidad, { ...current, expenses: current.expenses + t.importe });
    });

    return Array.from(stats.entries())
      .map(([name, data]) => ({
        name: name.length > 12 ? name.substring(0, 12) + '...' : name,
        fullName: name,
        ingresos: data.income,
        gastos: data.expenses,
        balance: data.income - data.expenses
      }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
      .slice(0, 6);
  }, [filteredIngresos, filteredGastos]);

  // Group by entity (excluding AJUSTE SALDO)
  const entityStats = useMemo(() => {
    const stats = new Map<string, { income: number; expenses: number }>();

    ingresos
      .filter(t => !isAjusteSaldo(t.categoria))
      .forEach(t => {
        const current = stats.get(t.entidad) || { income: 0, expenses: 0 };
        stats.set(t.entidad, { ...current, income: current.income + t.importe });
      });

    gastos
      .filter(t => !isAjusteSaldo(t.categoria))
      .forEach(t => {
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

  // Use filtered totals for display (always use frontend-calculated totals to ensure AJUSTE SALDO is excluded)
  const displayIncome = hasActiveFilters ? filteredTotalIncome : baseTotalIncome;
  const displayExpenses = hasActiveFilters ? filteredTotalExpenses : baseTotalExpenses;
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

  // Handle form submissions
  const handleAddExpense = async () => {
    try {
      await apiClient.post('/api/finance/expense', expenseForm);
      toast({
        title: 'Éxito',
        description: 'Gasto agregado correctamente',
      });
      setShowAddExpenseModal(false);
      fetchFinanceData();
    } catch (error) {
      console.error('Error adding expense:', error);
      toast({
        title: 'Error',
        description: 'No se pudo agregar el gasto',
        variant: 'destructive',
      });
    }
  };

  const handleAddIncome = async () => {
    try {
      // Check if it's a transfer between accounts
      if (isTransferCategory && incomeForm.cuentaOrigen) {
        // Create dual records for transfers
        const cuentaOrigen = incomeForm.cuentaOrigen;
        const cuentaDestino = incomeForm.cuenta;

        // 1. Create SALIDA (expense) record - money leaving source account
        await apiClient.post('/api/finance/expense', {
          fecha: incomeForm.fecha,
          importe: incomeForm.importe,
          descripcion: incomeForm.descripcion || `Traslado a ${cuentaDestino}`,
          categoria: `TRASLADO A ${cuentaDestino.toUpperCase()}`,
          cuenta: cuentaOrigen,
          entidad: incomeForm.entidad || 'DT Growth Partners',
        });

        // 2. Create ENTRADA (income) record - money arriving to destination account
        await apiClient.post('/api/finance/income', {
          fecha: incomeForm.fecha,
          importe: incomeForm.importe,
          descripcion: incomeForm.descripcion || `Traslado de ${cuentaOrigen}`,
          categoria: `TRASLADO DE ${cuentaOrigen.toUpperCase()}`,
          cuenta: cuentaDestino,
          entidad: incomeForm.entidad || 'DT Growth Partners',
        });

        toast({
          title: 'Traslado registrado',
          description: `Traslado de ${cuentaOrigen} a ${cuentaDestino} registrado correctamente (Entrada + Salida)`,
        });
      } else {
        // Normal income registration
        await apiClient.post('/api/finance/income', {
          ...incomeForm,
          entidad: incomeForm.entidad || 'tercero', // Default to "tercero" if not specified
        });
        toast({
          title: 'Éxito',
          description: 'Ingreso agregado correctamente',
        });
      }

      setShowAddIncomeModal(false);
      // Reset form
      setIncomeForm({
        fecha: new Date().toISOString().split('T')[0],
        importe: '',
        descripcion: '',
        categoria: '',
        cuenta: '',
        entidad: '',
        cuentaOrigen: '',
      });
      fetchFinanceData();
    } catch (error) {
      console.error('Error adding income:', error);
      toast({
        title: 'Error',
        description: 'No se pudo agregar el ingreso',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Finanzas</h1>
            <p className="text-muted-foreground text-sm">Datos desde Google Sheets - {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</p>
          </div>
          {/* Botones de acción globales */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchFinanceData}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTercerosModal(true)}
            >
              <Users className="h-4 w-4 mr-2" />
              Terceros
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNominaModal(true)}
            >
              <FileText className="h-4 w-4 mr-2" />
              Nómina
            </Button>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <TabsList className="inline-flex w-max sm:w-auto gap-1">
                <TabsTrigger value="resumen" className="flex items-center gap-2 whitespace-nowrap">
                  <TrendingUp className="h-4 w-4" />
                  Resumen
                </TabsTrigger>
                <TabsTrigger value="cuentas" className="flex items-center gap-2 whitespace-nowrap px-4">
                  <Receipt className="h-4 w-4" />
                  Cuentas
                </TabsTrigger>
                <TabsTrigger value="cuentas-cobro" className="flex items-center gap-2 whitespace-nowrap">
                  <FileText className="h-4 w-4" />
                  Cuentas de Cobro
                </TabsTrigger>
                <TabsTrigger value="reportes" className="flex items-center gap-2 whitespace-nowrap">
                  <TrendingUp className="h-4 w-4" />
                  Reportes
                </TabsTrigger>
              </TabsList>
            </div>

            {activeTab === 'resumen' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                  {hasActiveFilters && <span className="ml-2 h-2 w-2 rounded-full bg-primary"></span>}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowAddIncomeModal(true)}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Ingreso
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowAddExpenseModal(true)}
                >
                  <TrendingDown className="h-4 w-4 mr-2" />
                  Gasto
                </Button>
              </div>
            )}
          </div>

          <TabsContent value="cuentas" className="mt-6">
            <AccountsPanel />
          </TabsContent>

          <TabsContent value="cuentas-cobro" className="mt-6">
            <InvoicesPanel />
          </TabsContent>

          <TabsContent value="reportes" className="mt-6">
            <Tabs defaultValue="gastos" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="gastos" className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  Gastos
                </TabsTrigger>
                <TabsTrigger value="ingresos" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Ingresos
                </TabsTrigger>
              </TabsList>
              <TabsContent value="gastos">
                <BudgetComparisonReport gastos={gastos} />
              </TabsContent>
              <TabsContent value="ingresos">
                <IncomeReport ingresos={ingresos} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="resumen" className="mt-6 space-y-6">

        {/* Filter Panel */}
        {showFilters && (
          <div className="rounded-xl border border-border bg-card p-4 animate-in slide-in-from-top-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              <div className="w-full">
                <label className="text-sm font-medium text-foreground mb-2 block">Tipo</label>
                <Select value={filterType} onValueChange={(value: 'todas' | 'ingresos' | 'gastos') => setFilterType(value)}>
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

        {/* Quick Filter Buttons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {/* Hoy */}
        <button
          onClick={() => applyDatePreset('today')}
          className={cn(
            "p-3 sm:p-4 rounded-xl border transition-all hover:shadow-md text-left",
            filterDatePreset === 'today'
              ? "border-primary bg-primary/10 shadow-sm"
              : "border-border bg-card hover:border-primary/50"
          )}
        >
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Hoy</p>
          <p className="text-xs sm:text-sm font-semibold text-foreground mt-0.5 sm:mt-1 capitalize line-clamp-1">
            {new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
          <div className="mt-2 sm:mt-3 space-y-0.5 sm:space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs text-muted-foreground">Ing.</span>
              <span className="text-[10px] sm:text-xs font-medium text-success">{formatCompactCurrency(periodTotals.today.income)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs text-muted-foreground">Gas.</span>
              <span className="text-[10px] sm:text-xs font-medium text-destructive">{formatCompactCurrency(periodTotals.today.expenses)}</span>
            </div>
          </div>
        </button>

        {/* Esta Semana */}
        <button
          onClick={() => applyDatePreset('last7days')}
          className={cn(
            "p-3 sm:p-4 rounded-xl border transition-all hover:shadow-md text-left",
            filterDatePreset === 'last7days'
              ? "border-primary bg-primary/10 shadow-sm"
              : "border-border bg-card hover:border-primary/50"
          )}
        >
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Semana</p>
          <p className="text-xs sm:text-sm font-semibold text-foreground mt-0.5 sm:mt-1">7 días</p>
          <div className="mt-2 sm:mt-3 space-y-0.5 sm:space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs text-muted-foreground">Ing.</span>
              <span className="text-[10px] sm:text-xs font-medium text-success">{formatCompactCurrency(periodTotals.week.income)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs text-muted-foreground">Gas.</span>
              <span className="text-[10px] sm:text-xs font-medium text-destructive">{formatCompactCurrency(periodTotals.week.expenses)}</span>
            </div>
          </div>
        </button>

        {/* Este Mes */}
        <button
          onClick={() => applyDatePreset('thisMonth')}
          className={cn(
            "p-3 sm:p-4 rounded-xl border transition-all hover:shadow-md text-left",
            filterDatePreset === 'thisMonth'
              ? "border-primary bg-primary/10 shadow-sm"
              : "border-border bg-card hover:border-primary/50"
          )}
        >
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Mes</p>
          <p className="text-xs sm:text-sm font-semibold text-foreground mt-0.5 sm:mt-1 capitalize line-clamp-1">
            {new Date().toLocaleDateString('es-ES', { month: 'short' })}
          </p>
          <div className="mt-2 sm:mt-3 space-y-0.5 sm:space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs text-muted-foreground">Ing.</span>
              <span className="text-[10px] sm:text-xs font-medium text-success">{formatCompactCurrency(periodTotals.month.income)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs text-muted-foreground">Gas.</span>
              <span className="text-[10px] sm:text-xs font-medium text-destructive">{formatCompactCurrency(periodTotals.month.expenses)}</span>
            </div>
          </div>
        </button>

        {/* Este Año */}
        <button
          onClick={() => applyDatePreset('thisYear')}
          className={cn(
            "p-3 sm:p-4 rounded-xl border transition-all hover:shadow-md text-left",
            filterDatePreset === 'thisYear'
              ? "border-primary bg-primary/10 shadow-sm"
              : "border-border bg-card hover:border-primary/50"
          )}
        >
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Año</p>
          <p className="text-xs sm:text-sm font-semibold text-foreground mt-0.5 sm:mt-1">{new Date().getFullYear()}</p>
          <div className="mt-2 sm:mt-3 space-y-0.5 sm:space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs text-muted-foreground">Ing.</span>
              <span className="text-[10px] sm:text-xs font-medium text-success">{formatCompactCurrency(periodTotals.year.income)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs text-muted-foreground">Gas.</span>
              <span className="text-[10px] sm:text-xs font-medium text-destructive">{formatCompactCurrency(periodTotals.year.expenses)}</span>
            </div>
          </div>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="stat-card p-3 sm:p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-sm text-muted-foreground truncate">
                Ingresos {hasActiveFilters ? '(Filt.)' : ''}
              </p>
              <p className="text-base sm:text-2xl font-bold text-foreground mt-0.5 sm:mt-1">{formatCompactCurrency(displayIncome)}</p>
              {hasActiveFilters && (
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">
                  Total: {formatCompactCurrency(baseTotalIncome)}
                </p>
              )}
            </div>
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-success/10 flex-shrink-0">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
            </div>
          </div>
        </div>

        <div className="stat-card p-3 sm:p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-sm text-muted-foreground truncate">
                Gastos {hasActiveFilters ? '(Filt.)' : ''}
              </p>
              <p className="text-base sm:text-2xl font-bold text-foreground mt-0.5 sm:mt-1">{formatCompactCurrency(displayExpenses)}</p>
              {hasActiveFilters && (
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">
                  Total: {formatCompactCurrency(baseTotalExpenses)}
                </p>
              )}
            </div>
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-destructive/10 flex-shrink-0">
              <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
            </div>
          </div>
        </div>

        <div className="stat-card p-3 sm:p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-sm text-muted-foreground truncate">
                Beneficio {hasActiveFilters ? '(Filt.)' : ''}
              </p>
              <p className={cn("text-base sm:text-2xl font-bold mt-0.5 sm:mt-1", netProfit >= 0 ? "text-success" : "text-destructive")}>
                {formatCompactCurrency(netProfit)}
              </p>
              <p className={cn("text-[10px] sm:text-sm mt-1 sm:mt-2", profitMargin >= 0 ? "text-success" : "text-destructive")}>
                {profitMargin.toFixed(1)}% margen
              </p>
            </div>
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
          </div>
        </div>

        <div className="stat-card p-3 sm:p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-sm text-muted-foreground">Transac.</p>
              <p className="text-base sm:text-2xl font-bold text-foreground mt-0.5 sm:mt-1">
                {hasActiveFilters
                  ? filteredIngresos.length + filteredGastos.length
                  : ingresos.length + gastos.length
                }
              </p>
              <p className="text-[10px] sm:text-sm text-muted-foreground mt-1 sm:mt-2">
                {hasActiveFilters
                  ? `${filteredIngresos.length}↑ / ${filteredGastos.length}↓`
                  : `${ingresos.length}↑ / ${gastos.length}↓`
                }
              </p>
            </div>
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-warning/10 flex-shrink-0">
              <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
            </div>
          </div>
        </div>
      </div>

      {/* Disponible - Saldo por Cuenta */}
      {disponible.length > 0 && (
        <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 to-primary/10 p-3 sm:p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/20">
                <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-foreground">Dinero Disponible</h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Saldo actual por cuenta</p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xl sm:text-2xl font-bold text-primary">
                ${Math.round(totalDisponible).toLocaleString()}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Total disponible</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {disponible.filter(c => c.saldo > 0).map((cuenta, index) => (
              <div
                key={index}
                className="p-2 sm:p-3 rounded-lg bg-card border border-border hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                  <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">
                    {cuenta.cuenta}
                  </span>
                </div>
                <p className="text-sm sm:text-base font-bold text-foreground">
                  ${Math.round(cuenta.saldo).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Expense Distribution */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h3 className="font-semibold text-foreground mb-1 sm:mb-2 text-sm sm:text-base">Distribución de Gastos</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
            {hasActiveFilters ? 'Filtrado por período' : 'Por categoría'}
          </p>
          {(hasActiveFilters ? filteredExpenseCategories : expenseCategories).length > 0 ? (
            <>
              <div className="h-40 sm:h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={hasActiveFilters ? filteredExpenseCategories : expenseCategories}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {(hasActiveFilters ? filteredExpenseCategories : expenseCategories).map((entry, index) => (
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
              {/* Total de Gastos */}
              <div className="mt-3 sm:mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-destructive">Total Gastos:</span>
                  <span className="text-lg font-bold text-destructive">${(hasActiveFilters ? filteredTotalExpenses : baseTotalExpenses).toLocaleString()}</span>
                </div>
              </div>
              {/* Lista de categorías sin scroll */}
              <div className="space-y-1.5 sm:space-y-2 mt-3 sm:mt-4">
                {(hasActiveFilters ? filteredExpenseCategories : expenseCategories).map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                      <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-muted-foreground">{cat.name}</span>
                    </div>
                    <span className="font-medium text-foreground whitespace-nowrap ml-2">${cat.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 sm:h-48 text-muted-foreground text-xs sm:text-sm">
              No hay categorías de gastos
            </div>
          )}
        </div>
      </div>

      {/* Meta de Clientes */}
      <ClientGoalsPanel />

      {/* Top Transactions */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h3 className="font-semibold text-foreground mb-1 sm:mb-2 text-sm sm:text-base">Top 5 Transacciones</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
            {hasActiveFilters ? 'Filtrado por período' : 'Mayores montos'}
          </p>

          <div className="space-y-3 sm:space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-success">INGRESOS</p>
                <p className="text-xs font-bold text-success">Total: ${filteredTotalIncome.toLocaleString()}</p>
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                {topIncome.length > 0 ? (
                  topIncome.map((item, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 rounded-lg bg-success/5 hover:bg-success/10 transition-colors gap-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-foreground break-words">{item.descripcion}</p>
                        <p className="text-xs text-muted-foreground break-words">{item.fecha} • {item.entidad}</p>
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-success whitespace-nowrap">${item.importe.toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground py-2">Sin ingresos en el período</p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-destructive">GASTOS</p>
                <p className="text-xs font-bold text-destructive">Total: ${filteredTotalExpenses.toLocaleString()}</p>
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                {topExpenses.length > 0 ? (
                  topExpenses.map((item, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 rounded-lg bg-destructive/5 hover:bg-destructive/10 transition-colors gap-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-foreground break-words">{item.descripcion}</p>
                        <p className="text-xs text-muted-foreground break-words">{item.fecha} • {item.entidad}</p>
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-destructive whitespace-nowrap">${item.importe.toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground py-2">Sin gastos en el período</p>
                )}
              </div>
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Income Modal */}
      {showAddIncomeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Agregar Ingreso</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowAddIncomeModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Fecha</label>
                <Input
                  type="date"
                  value={incomeForm.fecha}
                  onChange={(e) => setIncomeForm({ ...incomeForm, fecha: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Importe</label>
                <Input
                  type="number"
                  value={incomeForm.importe}
                  onChange={(e) => setIncomeForm({ ...incomeForm, importe: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Descripción</label>
                <Input
                  value={incomeForm.descripcion}
                  onChange={(e) => setIncomeForm({ ...incomeForm, descripcion: e.target.value })}
                  placeholder="Descripción del ingreso"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Categoría</label>
                <Select
                  value={incomeForm.categoria}
                  onValueChange={(value) => setIncomeForm({ ...incomeForm, categoria: value, cuentaOrigen: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOME_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Show source account field for transfers */}
              {isTransferCategory && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                    ⚡ Traslado entre cuentas - Se creará registro dual (Entrada + Salida)
                  </p>
                  <label className="text-sm font-medium text-foreground mb-2 block">Cuenta Origen (de donde sale)</label>
                  <Select
                    value={incomeForm.cuentaOrigen}
                    onValueChange={(value) => setIncomeForm({ ...incomeForm, cuentaOrigen: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona cuenta origen" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_ACCOUNTS.filter(acc => acc !== incomeForm.cuenta).map((acc) => (
                        <SelectItem key={acc} value={acc}>{acc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  {isTransferCategory ? 'Cuenta Destino (donde entra)' : 'Cuenta (Banco)'}
                </label>
                <Select
                  value={incomeForm.cuenta}
                  onValueChange={(value) => setIncomeForm({ ...incomeForm, cuenta: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_ACCOUNTS.filter(acc => acc !== incomeForm.cuentaOrigen).map((bank) => (
                      <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  {isTransferCategory ? 'Quién hace el traslado' : 'Quién paga (Tercero)'}
                </label>
                <Input
                  value={incomeForm.entidad}
                  onChange={(e) => setIncomeForm({ ...incomeForm, entidad: e.target.value })}
                  placeholder={isTransferCategory ? 'Ej: Dairo Traslaviña' : 'Ej: Nombre del cliente que paga'}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddIncomeModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddIncome}>
                <DollarSign className="h-4 w-4 mr-2" />
                Agregar Ingreso
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Agregar Gasto</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowAddExpenseModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Fecha</label>
                <Input
                  type="date"
                  value={expenseForm.fecha}
                  onChange={(e) => setExpenseForm({ ...expenseForm, fecha: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Importe</label>
                <Input
                  type="number"
                  value={expenseForm.importe}
                  onChange={(e) => setExpenseForm({ ...expenseForm, importe: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Descripción</label>
                <Input
                  value={expenseForm.descripcion}
                  onChange={(e) => setExpenseForm({ ...expenseForm, descripcion: e.target.value })}
                  placeholder="Descripción del gasto"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Categoría</label>
                <Select
                  value={expenseForm.categoria}
                  onValueChange={(value) => setExpenseForm({ ...expenseForm, categoria: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Cuenta</label>
                <Input
                  value={expenseForm.cuenta}
                  onChange={(e) => setExpenseForm({ ...expenseForm, cuenta: e.target.value })}
                  placeholder="Ej: Principal, Ahorros"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Entidad</label>
                <Input
                  value={expenseForm.entidad}
                  onChange={(e) => setExpenseForm({ ...expenseForm, entidad: e.target.value })}
                  placeholder="Ej: Proveedor X, Empleado Y"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddExpenseModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddExpense}>
                <DollarSign className="h-4 w-4 mr-2" />
                Agregar Gasto
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Terceros Modal */}
      {showTercerosModal && (
        <TercerosModal onClose={() => setShowTercerosModal(false)} />
      )}

      {/* Nómina Modal */}
      {showNominaModal && (
        <NominaModal onClose={() => setShowNominaModal(false)} />
      )}
    </div>
  );
}
