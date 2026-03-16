import { useState, useEffect, useMemo } from 'react';
import { DollarSign, TrendingUp, TrendingDown, CreditCard, ArrowUpRight, ArrowDownRight, Calendar, RefreshCw, Filter, X, ChevronDown, ChevronUp, Search, Users, FileText, Receipt, Wallet, Building2, Pencil, Trash2, Check, MoreVertical } from 'lucide-react';
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
import IncomeStatement from '@/components/finance/IncomeStatement';
import BalanceSheet from '@/components/finance/BalanceSheet';import ClientGoalsPanel from '@/components/finance/ClientGoalsPanel';

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
  'Bancolombia',
  'Nequi',
  'Daviplata',
  'Efectivo',
  'Cuentas por Pagar a Clientes',
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
  rowIndex: number;
  fecha: string;
  importe: number;
  descripcion: string;
  categoria: string;
  cuenta: string;
  entidad: string;
  terceroId?: string;
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

// Check if a transaction account is "Cuentas por Pagar" (pasivo)
const isCuentaPorPagar = (cuenta: string | undefined | null): boolean => {
  if (!cuenta) return false;
  return cuenta.trim().toUpperCase().startsWith('CUENTAS POR PAGA');
};

// Helper to check if a category is AJUSTE SALDO (case-insensitive, trim whitespace)
const isAjusteSaldo = (categoria: string | undefined | null): boolean => {
  if (!categoria) return false;
  const upper = categoria.trim().toUpperCase();
  return upper === 'AJUSTE SALDO' || upper === 'RESERVAS' || upper.startsWith('TRASLADO') || upper.startsWith('REEMBOLSO');
};

// Helper to check if a category is REEMBOLSO (should not appear in reports)
const isReembolso = (categoria: string | undefined | null): boolean => {
  if (!categoria) return false;
  return categoria.trim().toUpperCase().includes('REEMBOLSO');
};

// Helper to check if income category is "real income" (PAGO DE CLIENTE or FINANCIEROS)
const isRealIncome = (categoria: string | undefined | null): boolean => {
  if (!categoria) return false;
  const cat = categoria.trim().toUpperCase();
  return cat === 'PAGO DE CLIENTE' || cat === 'FINANCIEROS';
};

// Helper to check if expense is "real expense" (exclude AJUSTE SALDO and REEMBOLSO)
const isRealExpense = (categoria: string | undefined | null): boolean => {
  if (!categoria) return false;
  return !isAjusteSaldo(categoria) && !isReembolso(categoria);
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
  const [resumenInvoices, setResumenInvoices] = useState<{ id: string; invoiceNumber: string; totalAmount: number; paidAmount: number; status: string; clientName: string; fecha: string; concepto: string | null; servicio: string | null }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

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

  // Inline edit state
  const [editingRow, setEditingRow] = useState<{ rowIndex: number; type: 'ingreso' | 'gasto' } | null>(null);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});
  const [savingRow, setSavingRow] = useState(false);

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
    clasificacionIngreso: '',
    noCuentaCobro: '',
    tipoTransaccion: '', // 'Pago Total' | 'Abono'
  });
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');

  // Check if selected category is a transfer
  const isTransferCategory = TRANSFER_CATEGORIES.includes(incomeForm.categoria);
  const isPagoCliente = incomeForm.categoria === 'PAGO DE CLIENTE';

  // Clients with pending invoices (for income modal)
  const clientesConCartera = useMemo(() => {
    const pendientes = resumenInvoices.filter(inv => inv.status !== 'pagada');
    const clientSet = new Set(pendientes.map(inv => inv.clientName).filter(Boolean));
    return Array.from(clientSet).sort();
  }, [resumenInvoices]);

  // Pending invoices for selected client
  const invoicesForSelectedClient = useMemo(() => {
    if (!incomeForm.entidad) return [];
    return resumenInvoices.filter(inv => inv.clientName === incomeForm.entidad && inv.status !== 'pagada');
  }, [resumenInvoices, incomeForm.entidad]);

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

    // Auto-refresh every 30 seconds for real-time data
    const intervalId = setInterval(() => {
      fetchFinanceData(true);
    }, 30000);

    // Refresh when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchFinanceData(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Apply initial date preset filter
  useEffect(() => {
    applyDatePreset('thisMonth');
  }, []);

  const fetchFinanceData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);

      // Fetch finance data, disponible and invoices in parallel
      const [data, disponibleData, invoicesData] = await Promise.all([
        apiClient.get<FinanceResponse>('/api/finance/data'),
        apiClient.get<DisponibleResponse>('/api/finance/disponible'),
        apiClient.get<{ id: string; invoiceNumber: string; totalAmount: number; paidAmount: number; status: string; clientName: string; fecha: string; concepto: string | null; servicio: string | null }[]>('/api/invoices').catch(() => []),
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
      setResumenInvoices(invoicesData || []);
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Error fetching finance data:', error);
      if (!silent) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los datos financieros desde Google Sheets',
          variant: 'destructive',
        });
      }
    } finally {
      if (!silent) setIsLoading(false);
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

  // Calculate filtered totals - income only counts PAGO DE CLIENTE + FINANCIEROS, expenses exclude AJUSTE SALDO and REEMBOLSO
  const filteredTotalIncome = filteredIngresos.filter(t => isRealIncome(t.categoria)).reduce((sum, t) => sum + t.importe, 0);
  const filteredTotalExpenses = filteredGastos.filter(t => isRealExpense(t.categoria)).reduce((sum, t) => sum + t.importe, 0);

// Calculate base totals - only "real income" (PAGO DE CLIENTE + FINANCIEROS) and "real expenses" (exclude AJUSTE SALDO and REEMBOLSO)
  const baseTotalIncome = useMemo(() => {
    const filtered = ingresos.filter(t => isRealIncome(t.categoria));
    return filtered.reduce((sum, t) => sum + t.importe, 0);
  }, [ingresos]);

  const baseTotalExpenses = useMemo(() =>
    gastos.filter(t => isRealExpense(t.categoria)).reduce((sum, t) => sum + t.importe, 0),
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

    // Helper: income only counts PAGO DE CLIENTE + FINANCIEROS; expenses exclude AJUSTE SALDO and REEMBOLSO
    const realIncome = (arr: Transaction[]) => arr.filter(t => isRealIncome(t.categoria));
    const realExpenses = (arr: Transaction[]) => arr.filter(t => isRealExpense(t.categoria));

    return {
      today: {
        income: realIncome(todayIngresos).reduce((sum, t) => sum + t.importe, 0),
        expenses: realExpenses(todayGastos).reduce((sum, t) => sum + t.importe, 0),
      },
      week: {
        income: realIncome(weekIngresos).reduce((sum, t) => sum + t.importe, 0),
        expenses: realExpenses(weekGastos).reduce((sum, t) => sum + t.importe, 0),
      },
      month: {
        income: realIncome(monthIngresos).reduce((sum, t) => sum + t.importe, 0),
        expenses: realExpenses(monthGastos).reduce((sum, t) => sum + t.importe, 0),
      },
      year: {
        income: realIncome(yearIngresos).reduce((sum, t) => sum + t.importe, 0),
        expenses: realExpenses(yearGastos).reduce((sum, t) => sum + t.importe, 0),
      },
    };
  }, [ingresos, gastos]);

  // Month-over-month trend calculation
  const monthTrends = useMemo(() => {
    const today = new Date();
    const firstDayThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    const thisMonthStr = getLocalDateString(firstDayThisMonth);
    const todayStr = getLocalDateString(today);
    const lastMonthStartStr = getLocalDateString(firstDayLastMonth);
    const lastMonthEndStr = getLocalDateString(lastDayLastMonth);

    const realIncome = (arr: Transaction[]) => arr.filter(t => isRealIncome(t.categoria));
    const realExpenses = (arr: Transaction[]) => arr.filter(t => isRealExpense(t.categoria));

    const thisMonthIncome = realIncome(filterByDateRange(ingresos, thisMonthStr, todayStr)).reduce((s, t) => s + t.importe, 0);
    const lastMonthIncome = realIncome(filterByDateRange(ingresos, lastMonthStartStr, lastMonthEndStr)).reduce((s, t) => s + t.importe, 0);
    const thisMonthExpenses = realExpenses(filterByDateRange(gastos, thisMonthStr, todayStr)).reduce((s, t) => s + t.importe, 0);
    const lastMonthExpenses = realExpenses(filterByDateRange(gastos, lastMonthStartStr, lastMonthEndStr)).reduce((s, t) => s + t.importe, 0);

    const incomeChange = lastMonthIncome > 0 ? ((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100 : 0;
    const expenseChange = lastMonthExpenses > 0 ? ((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100 : 0;

    const thisProfit = thisMonthIncome - thisMonthExpenses;
    const lastProfit = lastMonthIncome - lastMonthExpenses;
    const profitChange = lastProfit !== 0 ? ((thisProfit - lastProfit) / Math.abs(lastProfit)) * 100 : 0;

    return { incomeChange, expenseChange, profitChange };
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

  // Filtered expense categories for PieChart (excluding "AJUSTE SALDO" and "REEMBOLSO")
  const filteredExpenseCategories = useMemo(() => {
    const categoryMap = new Map<string, number>();

    filteredGastos.forEach(t => {
      // Exclude "AJUSTE SALDO" and "REEMBOLSO" from categories
      if (t.categoria && isRealExpense(t.categoria)) {
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

  // Top clientes por facturación (solo ingresos reales: PAGO DE CLIENTE)
  const topClientesByFacturacion = useMemo(() => {
    const source = hasActiveFilters ? filteredIngresos : ingresos;
    const clientMap = new Map<string, number>();
    source
      .filter(t => isRealIncome(t.categoria))
      .forEach(t => {
        if (t.entidad) {
          clientMap.set(t.entidad, (clientMap.get(t.entidad) || 0) + t.importe);
        }
      });
    const total = Array.from(clientMap.values()).reduce((s, v) => s + v, 0);
    return {
      items: Array.from(clientMap.entries())
        .map(([name, value]) => ({ name, value, pct: total > 0 ? (value / total) * 100 : 0 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
      total,
    };
  }, [hasActiveFilters, filteredIngresos, ingresos]);

  // Cuentas por cobrar filtradas
  // Cuentas por Cobrar (same logic as BalanceSheet: saldo > 0 and not pagada)
  // Fecha de corte para Estado de Resultados y Situación Financiera
  // Usa la misma lógica que IncomeStatement/BalanceSheet: fin de mes/período completo, no "hoy"
  const resumenPeriod = useMemo(() => {
    if (!hasActiveFilters || filterDatePreset === 'todas') {
      // "Todo" = Q1 completo en IncomeStatement = sin límite de fecha
      return { from: '', to: '2099-12-31' };
    }
    // Para meses: usar mes completo (como IncomeStatement que filtra por prefijo)
    if (filterDatePreset === 'thisMonth') {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: getLocalDateString(firstDay), to: getLocalDateString(lastDay) };
    }
    if (filterDatePreset === 'lastMonth') {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: getLocalDateString(firstDay), to: getLocalDateString(lastDay) };
    }
    if (filterDatePreset === 'thisQuarter') {
      const today = new Date();
      const quarter = Math.floor(today.getMonth() / 3);
      const firstDay = new Date(today.getFullYear(), quarter * 3, 1);
      const lastDay = new Date(today.getFullYear(), quarter * 3 + 3, 0);
      return { from: getLocalDateString(firstDay), to: getLocalDateString(lastDay) };
    }
    if (filterDatePreset === 'thisYear') {
      const today = new Date();
      return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31` };
    }
    // Custom u otros: usar las fechas exactas del filtro
    return { from: filterDateFrom, to: filterDateTo || '2099-12-31' };
  }, [hasActiveFilters, filterDatePreset, filterDateFrom, filterDateTo]);

  // Normalizar nombre de cuenta (misma lógica que BalanceSheet)
  const normalizeCuentaName = (cuenta: string): string => {
    const upper = cuenta.trim().toUpperCase();
    if (upper.startsWith('BANCOLOMBIA')) return 'Bancolombia';
    if (upper.startsWith('NEQUI')) return 'Nequi';
    if (upper.startsWith('DAVIPLATA')) return 'Daviplata';
    if (upper.startsWith('EFECTIVO')) return 'Efectivo';
    if (upper.startsWith('CRUCE')) return 'Cuentas por Pagar a Clientes';
    if (upper.startsWith('CUENTAS POR PAGA')) return 'Cuentas por Pagar a Clientes';
    if (upper.startsWith('RAPPICUENTA') || upper.startsWith('RAPPI')) return 'Rappicuenta';
    if (upper === 'PRINCIPAL') return 'Bancolombia';
    return cuenta.trim();
  };

  // Helper para retenciones (misma lógica que BalanceSheet)
  const isRetencionCuenta = (cuenta: string | undefined | null): boolean => {
    if (!cuenta) return false;
    const upper = cuenta.trim().toUpperCase();
    return upper.includes('RETENCION') || upper.includes('RETENCIÓN');
  };

  // Disponible y Retenciones ajustados al corte (misma lógica que BalanceSheet.disponibleAlCorte)
  const { disponibleSinPasivo, totalRetenciones } = useMemo(() => {
    const endDate = resumenPeriod.to;
    const movimientosDespues = new Map<string, number>();
    ingresos.forEach(t => {
      const fecha = normalizeDate(t.fecha);
      if (fecha && fecha > endDate && t.cuenta && !isCuentaPorPagar(t.cuenta)) {
        const cuentaNorm = normalizeCuentaName(t.cuenta);
        movimientosDespues.set(cuentaNorm, (movimientosDespues.get(cuentaNorm) || 0) - t.importe);
      }
    });
    gastos.forEach(t => {
      const fecha = normalizeDate(t.fecha);
      if (fecha && fecha > endDate && t.cuenta && !isCuentaPorPagar(t.cuenta)) {
        const cuentaNorm = normalizeCuentaName(t.cuenta);
        movimientosDespues.set(cuentaNorm, (movimientosDespues.get(cuentaNorm) || 0) + t.importe);
      }
    });
    const todasCuentas = disponible
      .filter(c => !isCuentaPorPagar(c.cuenta))
      .map(c => {
        const ajuste = movimientosDespues.get(normalizeCuentaName(c.cuenta)) || 0;
        return { cuenta: c.cuenta, saldo: c.saldo + ajuste };
      });
    const disp = todasCuentas.filter(c => !isRetencionCuenta(c.cuenta)).reduce((s, c) => s + c.saldo, 0);
    const ret = todasCuentas.filter(c => isRetencionCuenta(c.cuenta)).reduce((s, c) => s + c.saldo, 0);
    return { disponibleSinPasivo: disp, totalRetenciones: ret };
  }, [disponible, ingresos, gastos, resumenPeriod]);

  // Cuentas por Cobrar (misma lógica que BalanceSheet.cuentasPorCobrar)
  const cuentasPorCobrar = useMemo(() => {
    const endDate = resumenPeriod.to;
    return resumenInvoices
      .filter(inv => {
        const fechaInv = normalizeDate(inv.fecha);
        if (fechaInv > endDate) return false;
        const saldo = inv.totalAmount - (inv.paidAmount || 0);
        if (saldo <= 0 || inv.status === 'pagada') return false;
        return true;
      })
      .reduce((s, inv) => s + (inv.totalAmount - (inv.paidAmount || 0)), 0);
  }, [resumenInvoices, resumenPeriod]);

  // Cuentas por Pagar (misma lógica que BalanceSheet.cuentasPorPagar)
  const cuentasPorPagarTotal = useMemo(() => {
    const endDate = resumenPeriod.to;
    let total = 0;
    gastos.forEach(t => {
      const fecha = normalizeDate(t.fecha);
      if (fecha && fecha <= endDate && isCuentaPorPagar(t.cuenta)) {
        total += t.importe;
      }
    });
    ingresos.forEach(t => {
      const fecha = normalizeDate(t.fecha);
      if (fecha && fecha <= endDate && isCuentaPorPagar(t.cuenta)) {
        total -= t.importe;
      }
    });
    return total;
  }, [ingresos, gastos, resumenPeriod]);

  // Ecuación contable: Activo = Pasivo + Patrimonio
  const totalActivos = useMemo(() => disponibleSinPasivo + cuentasPorCobrar + totalRetenciones, [disponibleSinPasivo, cuentasPorCobrar, totalRetenciones]);
  const patrimonio = useMemo(() => totalActivos - cuentasPorPagarTotal, [totalActivos, cuentasPorPagarTotal]);

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

  // Estado de Resultados (misma lógica que IncomeStatement: excluye categorías + filtro de fechas por período completo)
  const edoResultados = useMemo(() => {
    const isExcluded = (cat: string | undefined | null) => {
      if (!cat) return false;
      const upper = cat.trim().toUpperCase();
      return upper === 'AJUSTE SALDO' || upper === 'RESERVAS' || upper.startsWith('TRASLADO') || upper.startsWith('REEMBOLSO');
    };
    const { from, to } = resumenPeriod;
    const inDateRange = (t: { fecha: string }) => {
      const fecha = normalizeDate(t.fecha);
      if (from && fecha < from) return false;
      if (to && fecha > to) return false;
      return true;
    };
    const ingresosEdoR = ingresos.filter(t => !isExcluded(t.categoria) && inDateRange(t));
    const gastosEdoR = gastos.filter(t => !isExcluded(t.categoria) && inDateRange(t));
    const totalIng = ingresosEdoR.reduce((s, t) => s + t.importe, 0);
    const totalGas = gastosEdoR.reduce((s, t) => s + t.importe, 0);
    const bruta = totalIng - totalGas;
    const margen = totalIng > 0 ? (bruta / totalIng) * 100 : 0;
    // Comisión aplica solo si el período incluye feb 2026+ (misma lógica que IncomeStatement)
    const aplicaComision = to >= '2026-02-01';
    const comision = aplicaComision && bruta > 0 ? bruta * 0.01 : 0;
    const netaDespuesComision = bruta - comision;
    const dividendos = netaDespuesComision > 0 ? netaDespuesComision * 0.25 : 0;
    const reserva = netaDespuesComision > 0 ? netaDespuesComision * 0.75 : 0;
    const margenNeto = totalIng > 0 ? (netaDespuesComision / totalIng) * 100 : 0;
    return { totalIng, totalGas, bruta, margen, comision, netaDespuesComision, dividendos, reserva, margenNeto };
  }, [ingresos, gastos, resumenPeriod]);

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
          fecha: incomeForm.fecha,
          importe: incomeForm.importe,
          descripcion: incomeForm.descripcion,
          categoria: incomeForm.categoria,
          cuenta: incomeForm.cuenta,
          entidad: incomeForm.entidad || 'tercero',
          tercero: incomeForm.entidad || '',
          clasificacionIngreso: incomeForm.clasificacionIngreso || '',
          noCuentaCobro: incomeForm.noCuentaCobro || '',
          tipoTransaccion: incomeForm.tipoTransaccion || '',
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
        clasificacionIngreso: '',
        noCuentaCobro: '',
        tipoTransaccion: '',
      });
      setSelectedInvoiceId('');
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

  // Handle inline edit
  const startEditing = (transaction: Transaction, type: 'ingreso' | 'gasto') => {
    setEditingRow({ rowIndex: transaction.rowIndex, type });
    setEditForm({ ...transaction });
  };

  const cancelEditing = () => {
    setEditingRow(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingRow || !editForm) return;
    setSavingRow(true);
    try {
      const endpoint = editingRow.type === 'ingreso' ? 'income' : 'expense';
      await apiClient.put(`/api/finance/${endpoint}/${editingRow.rowIndex}`, {
        fecha: editForm.fecha,
        importe: editForm.importe,
        descripcion: editForm.descripcion,
        categoria: editForm.categoria,
        cuenta: editForm.cuenta,
        entidad: editForm.entidad,
      });
      toast({ title: 'Actualizado', description: 'Movimiento actualizado correctamente' });
      setEditingRow(null);
      setEditForm({});
      fetchFinanceData();
    } catch (error) {
      console.error('Error updating:', error);
      toast({ title: 'Error', description: 'No se pudo actualizar el movimiento', variant: 'destructive' });
    } finally {
      setSavingRow(false);
    }
  };

  const handleDelete = async (rowIndex: number, type: 'ingreso' | 'gasto') => {
    if (!confirm('¿Estás seguro de eliminar este movimiento? Esta acción no se puede deshacer.')) return;
    try {
      const endpoint = type === 'ingreso' ? 'income' : 'expense';
      await apiClient.delete(`/api/finance/${endpoint}/${rowIndex}`);
      toast({ title: 'Eliminado', description: 'Movimiento eliminado correctamente' });
      fetchFinanceData();
    } catch (error) {
      console.error('Error deleting:', error);
      toast({ title: 'Error', description: 'No se pudo eliminar el movimiento', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Finanzas</h1>
            <p className="text-muted-foreground text-sm">
              Datos desde Google Sheets - {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
              {lastSyncTime && (
                <span className="ml-2 text-xs text-muted-foreground/70">
                  (Sync: {lastSyncTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })})
                </span>
              )}
            </p>
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
        <Tabs value={activeTab} onValueChange={(tab) => { setActiveTab(tab); if (tab === 'resumen') fetchFinanceData(true); }} className="w-full">
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
                  Facturas
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
              <TabsTrigger value="estado-resultados" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Estado de Resultados
                </TabsTrigger>
                <TabsTrigger value="balance-general" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Situación Financiera
                </TabsTrigger>
              </TabsList>
              <TabsContent value="gastos">
                <BudgetComparisonReport gastos={gastos} ingresos={ingresos} />
              </TabsContent>
              <TabsContent value="ingresos">
                <IncomeReport ingresos={ingresos} />
              </TabsContent>
              <TabsContent value="estado-resultados">
                <IncomeStatement ingresos={ingresos} gastos={gastos} />
              </TabsContent>
              <TabsContent value="balance-general">
                <BalanceSheet ingresos={ingresos} gastos={gastos} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="resumen" className="mt-6 space-y-6">

        {/* Time-based Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'thisMonth', label: 'Este Mes' },
            { key: 'lastMonth', label: 'Mes Anterior' },
            { key: 'thisQuarter', label: 'Trimestre' },
            { key: 'thisYear', label: 'Este Año' },
            { key: 'todas', label: 'Todo' },
            { key: 'custom', label: 'Personalizado' },
          ].map((btn) => (
            <button
              key={btn.key}
              onClick={() => applyDatePreset(btn.key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border transition-all",
                filterDatePreset === btn.key
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {btn.label}
            </button>
          ))}

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border border-destructive/30 text-destructive hover:bg-destructive/10 transition-all flex items-center gap-1"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar
            </button>
          )}
        </div>

        {/* Custom Date Range */}
        {filterDatePreset === 'custom' && (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Desde</label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-[160px] h-9"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Hasta</label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-[160px] h-9"
              />
            </div>
            {filterDateFrom && filterDateTo && (
              <span className="text-xs text-muted-foreground pb-2">
                <Calendar className="h-3.5 w-3.5 inline mr-1" />
                {filterDateFrom} → {filterDateTo}
              </span>
            )}
          </div>
        )}

        {/* Summary Cards: Estado de Resultados + Situación Financiera */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Estado de Resultados */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Estado de Resultados
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">Ingresos</span>
                <span className="text-xs sm:text-sm font-semibold text-success">${edoResultados.totalIng.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">Gastos</span>
                <span className="text-xs sm:text-sm font-semibold text-destructive">${edoResultados.totalGas.toLocaleString()}</span>
              </div>
              <div className="border-t border-border pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-medium text-foreground">Utilidad Bruta</span>
                  <span className={cn("text-xs sm:text-sm font-bold", edoResultados.bruta >= 0 ? "text-success" : "text-destructive")}>
                    ${edoResultados.bruta.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px] sm:text-xs text-muted-foreground">Margen Bruto</span>
                  <span className={cn("text-[10px] sm:text-xs font-medium", edoResultados.margen >= 0 ? "text-success" : "text-destructive")}>
                    {edoResultados.margen.toFixed(1)}%
                  </span>
                </div>
              </div>
              {edoResultados.comision > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-xs text-muted-foreground">(-) Comisión 1%</span>
                    <span className="text-[10px] sm:text-xs font-medium text-destructive">-${Math.round(edoResultados.comision).toLocaleString()}</span>
                  </div>
                  <div className="border-t border-border pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-medium text-foreground">(=) Utilidad Neta después de Comisión</span>
                      <span className={cn("text-xs sm:text-sm font-bold", edoResultados.netaDespuesComision >= 0 ? "text-success" : "text-destructive")}>
                        ${Math.round(edoResultados.netaDespuesComision).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </>
              )}
              {edoResultados.netaDespuesComision > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-xs text-muted-foreground">Dividendos (25%)</span>
                    <span className="text-[10px] sm:text-xs font-medium text-foreground">${Math.round(edoResultados.dividendos).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-xs text-muted-foreground">Reserva Empresa (75%)</span>
                    <span className="text-[10px] sm:text-xs font-medium text-foreground">${Math.round(edoResultados.reserva).toLocaleString()}</span>
                  </div>
                </>
              )}
              <div className="border-t border-border pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-medium text-foreground">Utilidad Neta (Reserva Empresa)</span>
                  <span className={cn("text-sm sm:text-base font-bold", edoResultados.reserva >= 0 ? "text-success" : "text-destructive")}>
                    ${Math.round(edoResultados.reserva).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px] sm:text-xs text-muted-foreground">Margen Neto</span>
                  <span className={cn("text-[10px] sm:text-xs font-medium", edoResultados.margenNeto >= 0 ? "text-success" : "text-destructive")}>
                    {edoResultados.margenNeto.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Situación Financiera */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Situación Financiera
            </h3>
            <div className="space-y-2">
              {/* Activos */}
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide">Activos</p>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">Disponible</span>
                <span className="text-xs sm:text-sm font-semibold text-primary">${Math.round(disponibleSinPasivo).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">Cuentas por Cobrar</span>
                <span className="text-xs sm:text-sm font-semibold text-warning">${Math.round(cuentasPorCobrar).toLocaleString()}</span>
              </div>
              {totalRetenciones > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-muted-foreground">Retenciones en la Fuente</span>
                  <span className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400">${Math.round(totalRetenciones).toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border pt-1">
                <span className="text-xs sm:text-sm font-medium text-foreground">Total Activos</span>
                <span className="text-xs sm:text-sm font-bold text-primary">${Math.round(totalActivos).toLocaleString()}</span>
              </div>

              {/* Pasivos */}
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Pasivos</p>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">Cuentas por Pagar</span>
                <span className="text-xs sm:text-sm font-semibold text-destructive">${Math.round(cuentasPorPagarTotal).toLocaleString()}</span>
              </div>

              {/* Patrimonio */}
              <div className="border-t border-border pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-medium text-foreground">Patrimonio</span>
                  <span className={cn("text-sm sm:text-base font-bold", patrimonio >= 0 ? "text-primary" : "text-destructive")}>
                    ${Math.round(patrimonio).toLocaleString()}
                  </span>
                </div>
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
                ${Math.round(disponibleSinPasivo).toLocaleString()}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Total disponible</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {disponible.filter(c => c.saldo > 0 && !isCuentaPorPagar(c.cuenta) && !isRetencionCuenta(c.cuenta)).map((cuenta, index) => (
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
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          cursor="pointer"
                          onClick={() => {
                            if (filterCategory === entry.name) {
                              setFilterCategory('todas');
                            } else {
                              setFilterCategory(entry.name);
                              setFilterType('gastos');
                            }
                          }}
                          opacity={filterCategory !== 'todas' && filterCategory !== entry.name ? 0.3 : 1}
                        />
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
              {/* Lista de categorías - click para filtrar */}
              <div className="space-y-1.5 sm:space-y-2 mt-3 sm:mt-4">
                {(hasActiveFilters ? filteredExpenseCategories : expenseCategories).map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => {
                      if (filterCategory === cat.name) {
                        setFilterCategory('todas');
                      } else {
                        setFilterCategory(cat.name);
                        setFilterType('gastos');
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between text-xs sm:text-sm w-full px-2 py-1 rounded-md transition-colors",
                      filterCategory === cat.name
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                      <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-muted-foreground text-left">{cat.name}</span>
                    </div>
                    <span className="font-medium text-foreground whitespace-nowrap ml-2">${cat.value.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 sm:h-48 text-muted-foreground text-xs sm:text-sm">
              No hay categorías de gastos
            </div>
          )}
        </div>

        {/* Top Clientes por Facturación */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h3 className="font-semibold text-foreground mb-1 sm:mb-2 text-sm sm:text-base">Top Clientes por Facturación</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
            {hasActiveFilters ? 'Filtrado por período' : 'Mayor facturación acumulada'}
          </p>
          {topClientesByFacturacion.items.length > 0 ? (
            <>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-primary">Total Facturado:</span>
                  <span className="text-lg font-bold text-primary">${topClientesByFacturacion.total.toLocaleString()}</span>
                </div>
              </div>
              <div className="space-y-2.5">
                {topClientesByFacturacion.items.map((client, idx) => {
                  const maxVal = topClientesByFacturacion.items[0]?.value || 1;
                  const barWidth = (client.value / maxVal) * 100;
                  return (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs sm:text-sm font-medium text-foreground truncate flex-1" title={client.name}>
                          {client.name.length > 22 ? client.name.substring(0, 22) + '...' : client.name}
                        </span>
                        <div className="flex items-center gap-2 ml-2 whitespace-nowrap">
                          <span className="text-xs sm:text-sm font-bold text-foreground">${client.value.toLocaleString()}</span>
                          <span className="text-[10px] sm:text-xs text-muted-foreground">({client.pct.toFixed(1)}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 bg-primary"
                          style={{ width: `${barWidth}%`, opacity: Math.max(0.3, 1 - idx * 0.1) }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 sm:h-48 text-muted-foreground text-xs sm:text-sm">
              No hay datos de facturación
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
                        <th className="text-center py-3 px-2 font-medium text-muted-foreground w-[80px]">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIngresos.length > 0 ? (
                        filteredIngresos.map((ingreso) => {
                          const isEditing = editingRow?.rowIndex === ingreso.rowIndex && editingRow?.type === 'ingreso';
                          return (
                            <tr key={ingreso.rowIndex} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                              {isEditing ? (
                                <>
                                  <td className="py-2 px-2">
                                    <Input type="date" value={editForm.fecha || ''} onChange={(e) => setEditForm({ ...editForm, fecha: e.target.value })} className="h-8 text-xs w-[130px]" />
                                  </td>
                                  <td className="py-2 px-2">
                                    <Input value={editForm.descripcion || ''} onChange={(e) => setEditForm({ ...editForm, descripcion: e.target.value })} className="h-8 text-xs" />
                                  </td>
                                  <td className="py-2 px-2 hidden sm:table-cell">
                                    <select value={editForm.categoria || ''} onChange={(e) => setEditForm({ ...editForm, categoria: e.target.value })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                                      {INCOME_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                  </td>
                                  <td className="py-2 px-2 hidden md:table-cell">
                                    <Input value={editForm.entidad || ''} onChange={(e) => setEditForm({ ...editForm, entidad: e.target.value })} className="h-8 text-xs" />
                                  </td>
                                  <td className="py-2 px-2">
                                    <Input type="number" value={editForm.importe || ''} onChange={(e) => setEditForm({ ...editForm, importe: Number(e.target.value) })} className="h-8 text-xs text-right w-[100px]" />
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button onClick={saveEdit} disabled={savingRow} className="p-1 rounded hover:bg-success/20 text-success"><Check className="h-4 w-4" /></button>
                                      <button onClick={cancelEditing} className="p-1 rounded hover:bg-destructive/20 text-destructive"><X className="h-4 w-4" /></button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
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
                                  <td className="py-3 px-2 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button onClick={() => startEditing(ingreso, 'ingreso')} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                                      <button onClick={() => handleDelete(ingreso.rowIndex, 'ingreso')} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive" title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-muted-foreground">
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
                        <th className="text-center py-3 px-2 font-medium text-muted-foreground w-[80px]">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGastos.length > 0 ? (
                        filteredGastos.map((gasto) => {
                          const isEditing = editingRow?.rowIndex === gasto.rowIndex && editingRow?.type === 'gasto';
                          return (
                            <tr key={gasto.rowIndex} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                              {isEditing ? (
                                <>
                                  <td className="py-2 px-2">
                                    <Input type="date" value={editForm.fecha || ''} onChange={(e) => setEditForm({ ...editForm, fecha: e.target.value })} className="h-8 text-xs w-[130px]" />
                                  </td>
                                  <td className="py-2 px-2">
                                    <Input value={editForm.descripcion || ''} onChange={(e) => setEditForm({ ...editForm, descripcion: e.target.value })} className="h-8 text-xs" />
                                  </td>
                                  <td className="py-2 px-2 hidden sm:table-cell">
                                    <select value={editForm.categoria || ''} onChange={(e) => setEditForm({ ...editForm, categoria: e.target.value })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                                      {EXPENSE_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                  </td>
                                  <td className="py-2 px-2 hidden md:table-cell">
                                    <Input value={editForm.entidad || ''} onChange={(e) => setEditForm({ ...editForm, entidad: e.target.value })} className="h-8 text-xs" />
                                  </td>
                                  <td className="py-2 px-2">
                                    <Input type="number" value={editForm.importe || ''} onChange={(e) => setEditForm({ ...editForm, importe: Number(e.target.value) })} className="h-8 text-xs text-right w-[100px]" />
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button onClick={saveEdit} disabled={savingRow} className="p-1 rounded hover:bg-success/20 text-success"><Check className="h-4 w-4" /></button>
                                      <button onClick={cancelEditing} className="p-1 rounded hover:bg-destructive/20 text-destructive"><X className="h-4 w-4" /></button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
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
                                  <td className="py-3 px-2 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button onClick={() => startEditing(gasto, 'gasto')} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                                      <button onClick={() => handleDelete(gasto.rowIndex, 'gasto')} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive" title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-muted-foreground">
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
                  {isTransferCategory ? 'Quién hace el traslado' : 'Tercero (Cliente)'}
                </label>
                {isPagoCliente && clientesConCartera.length > 0 ? (
                  <Select
                    value={incomeForm.entidad}
                    onValueChange={(value) => {
                      setIncomeForm({ ...incomeForm, entidad: value, noCuentaCobro: '', tipoTransaccion: '', clasificacionIngreso: '' });
                      setSelectedInvoiceId('');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientesConCartera.map((client) => (
                        <SelectItem key={client} value={client}>{client}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={incomeForm.entidad}
                    onChange={(e) => setIncomeForm({ ...incomeForm, entidad: e.target.value })}
                    placeholder={isTransferCategory ? 'Ej: Dairo Traslaviña' : 'Ej: Nombre del cliente que paga'}
                  />
                )}
              </div>

              {/* Invoice selection when PAGO DE CLIENTE and client selected */}
              {isPagoCliente && incomeForm.entidad && invoicesForSelectedClient.length > 0 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800 space-y-3">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    Cuentas de Cobro pendientes de {incomeForm.entidad}
                  </p>

                  <div>
                    <label className="text-xs font-medium text-foreground mb-1 block">Cuenta de Cobro</label>
                    <Select
                      value={selectedInvoiceId}
                      onValueChange={(value) => {
                        setSelectedInvoiceId(value);
                        const inv = invoicesForSelectedClient.find(i => i.id === value);
                        if (inv) {
                          const saldo = inv.totalAmount - (inv.paidAmount || 0);
                          setIncomeForm(prev => ({
                            ...prev,
                            noCuentaCobro: inv.invoiceNumber,
                            clasificacionIngreso: 'Ingreso Operacional',
                            descripcion: prev.descripcion || `Abono cuenta #${inv.invoiceNumber} - ${inv.servicio || inv.concepto || 'Servicios'}`,
                            importe: prev.importe || String(saldo),
                          }));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona cuenta de cobro" />
                      </SelectTrigger>
                      <SelectContent>
                        {invoicesForSelectedClient.map((inv) => {
                          const saldo = inv.totalAmount - (inv.paidAmount || 0);
                          return (
                            <SelectItem key={inv.id} value={inv.id}>
                              #{inv.invoiceNumber} - ${saldo.toLocaleString()} pendiente
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedInvoiceId && (() => {
                    const inv = invoicesForSelectedClient.find(i => i.id === selectedInvoiceId);
                    if (!inv) return null;
                    const saldo = inv.totalAmount - (inv.paidAmount || 0);
                    return (
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground space-y-1 bg-card/50 p-2 rounded">
                          <div className="flex justify-between"><span>Total cuenta:</span><span className="font-medium">${inv.totalAmount.toLocaleString()}</span></div>
                          <div className="flex justify-between"><span>Abonado:</span><span className="font-medium">${(inv.paidAmount || 0).toLocaleString()}</span></div>
                          <div className="flex justify-between border-t pt-1"><span>Saldo:</span><span className="font-bold text-foreground">${saldo.toLocaleString()}</span></div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-foreground mb-1 block">Tipo de Ingreso</label>
                          <Select
                            value={incomeForm.clasificacionIngreso}
                            onValueChange={(value) => setIncomeForm({ ...incomeForm, clasificacionIngreso: value })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Clasificación" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Ingreso Operacional">Ingreso Operacional</SelectItem>
                              <SelectItem value="Recurrente">Recurrente</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-foreground mb-1 block">Pago Total / Abono</label>
                          <Select
                            value={incomeForm.tipoTransaccion}
                            onValueChange={(value) => {
                              const updates: Record<string, string> = { tipoTransaccion: value };
                              if (value === 'Pago Total') {
                                updates.importe = String(saldo);
                              }
                              setIncomeForm(prev => ({ ...prev, ...updates }));
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pago Total">Pago Total (${saldo.toLocaleString()})</SelectItem>
                              <SelectItem value="Abono">Abono (parcial)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
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
                <label className="text-sm font-medium text-foreground mb-2 block">Cuenta (Banco)</label>
                <Select
                  value={expenseForm.cuenta}
                  onValueChange={(value) => setExpenseForm({ ...expenseForm, cuenta: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_ACCOUNTS.map((acc) => (
                      <SelectItem key={acc} value={acc}>{acc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Tercero (A quien se le paga o transfiere)</label>
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
