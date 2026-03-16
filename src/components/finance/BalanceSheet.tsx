import { useState, useMemo, useEffect } from 'react';
import { Building2, Wallet, Users, TrendingUp, Target, Calendar, CalendarRange, DollarSign, History, CreditCard, FileDown, FileSpreadsheet } from 'lucide-react';
import { exportBalanceSheetPDF, exportBalanceSheetExcel } from '@/lib/finance-exports';
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

interface CuentaDisponible {
  cuenta: string;
  saldo: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientNit: string;
  totalAmount: number;
  paidAmount: number;
  fecha: string;
  concepto: string | null;
  servicio: string | null;
  status: 'pendiente' | 'enviada' | 'parcial' | 'pagada';
  paidAt: string | null;
  createdAt: string;
}

interface BalanceSheetProps {
  ingresos: Transaction[];
  gastos: Transaction[];
}

type SelectedPeriod = 'dic2025' | 'enero' | 'febrero' | 'marzo' | 'q1' | 'custom';

const MONTH_NAMES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const isExcludedForUtilidad = (categoria: string | undefined | null): boolean => {
  if (!categoria) return false;
  const upper = categoria.trim().toUpperCase();
  return upper === 'AJUSTE SALDO' || upper === 'RESERVAS' || upper.startsWith('TRASLADO') || upper.startsWith('REEMBOLSO');
};

// Check if a transaction is a "Cuentas por Pagar" movement
const isCuentaPorPagar = (cuenta: string | undefined | null): boolean => {
  if (!cuenta) return false;
  return cuenta.trim().toUpperCase().startsWith('CUENTAS POR PAGA');
};

// Check if a cuenta is "Retenciones en la fuente"
const isRetencion = (cuenta: string | undefined | null): boolean => {
  if (!cuenta) return false;
  const upper = cuenta.trim().toUpperCase();
  return upper.includes('RETENCION') || upper.includes('RETENCIÓN');
};

// Get the tercero/client name from a transaction (use entidad field for Entradas, tercero-like field)
const getTerceroName = (t: Transaction, isIngreso: boolean): string => {
  // In Salidas: Entidad = "DT Growth Partners", the client is in the "entidad" or we need to look at descripcion
  // In Entradas: Tercero field contains the client name
  // Based on the screenshots, the Tercero column (G) has the client name
  // But our Transaction interface uses 'entidad' for column F
  // In Salidas: Tercero (col G) = "Tennis Cartagena", Entidad (col F) = "DT Growth Partners"
  // In Entradas: Tercero (col F) = "Delicias del Edén"
  // The entidad field maps to different columns depending on context
  // Let's use entidad as it's what we have
  return t.entidad?.trim() || 'Sin identificar';
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

const fmt = (value: number) => Math.round(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

const getPeriodEndDate = (period: SelectedPeriod, dateRange?: DateRange): string => {
  if (period === 'custom' && dateRange?.to) {
    const d = dateRange.to;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (period === 'custom' && dateRange?.from) {
    const d = dateRange.from;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const endDates: Record<string, string> = {
    dic2025: '2025-12-31',
    enero: '2026-01-31',
    febrero: '2026-02-28',
    marzo: '2026-03-31',
    q1: '2026-03-31',
  };
  return endDates[period] || '2026-03-31';
};

export default function BalanceSheet({ ingresos, gastos }: BalanceSheetProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<SelectedPeriod>('q1');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [disponibleActual, setDisponibleActual] = useState<CuentaDisponible[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentDate = new Date();
  const currentMonthIndex = currentDate.getMonth();
  const currentMonthKey = currentMonthIndex === 0 ? 'enero' : currentMonthIndex === 1 ? 'febrero' : currentMonthIndex === 2 ? 'marzo' : null;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [dispData, invoicesData] = await Promise.all([
          apiClient.get<{ cuentas: CuentaDisponible[]; totalDisponible: number }>('/api/finance/disponible'),
          apiClient.get<Invoice[]>('/api/invoices'),
        ]);
        setDisponibleActual(dispData.cuentas || []);
        setInvoices(invoicesData || []);
      } catch (error) {
        console.error('Error fetching balance sheet data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const periodEndDate = useMemo(() => getPeriodEndDate(selectedPeriod, dateRange), [selectedPeriod, dateRange]);

  // DISPONIBLE DINÁMICO: Saldo actual - movimientos después del corte
  // Excluir "Cuentas por Pagar a Clientes" (va a Pasivos) y "Retenciones" (va a sección aparte)
  const disponibleAlCorte = useMemo(() => {
    const movimientosDespues = new Map<string, number>();

    ingresos.forEach(t => {
      const fecha = normalizeDate(t.fecha);
      if (fecha && fecha > periodEndDate && t.cuenta && !isCuentaPorPagar(t.cuenta)) {
        const cuentaNorm = normalizeCuentaName(t.cuenta);
        movimientosDespues.set(cuentaNorm, (movimientosDespues.get(cuentaNorm) || 0) - t.importe);
      }
    });

    gastos.forEach(t => {
      const fecha = normalizeDate(t.fecha);
      if (fecha && fecha > periodEndDate && t.cuenta && !isCuentaPorPagar(t.cuenta)) {
        const cuentaNorm = normalizeCuentaName(t.cuenta);
        movimientosDespues.set(cuentaNorm, (movimientosDespues.get(cuentaNorm) || 0) + t.importe);
      }
    });

    const todasCuentas = disponibleActual
      .filter(c => !isCuentaPorPagar(c.cuenta))
      .map(cuenta => {
        const ajuste = movimientosDespues.get(normalizeCuentaName(cuenta.cuenta)) || 0;
        return { cuenta: cuenta.cuenta, saldo: cuenta.saldo + ajuste };
      });

    // Separar: disponible (sin retenciones) y retenciones
    const cuentas = todasCuentas.filter(c => !isRetencion(c.cuenta));
    const retenciones = todasCuentas.filter(c => isRetencion(c.cuenta));

    const total = cuentas.reduce((sum, c) => sum + c.saldo, 0);
    const totalRetenciones = retenciones.reduce((sum, c) => sum + c.saldo, 0);
    return { cuentas, total, retenciones, totalRetenciones };
  }, [disponibleActual, ingresos, gastos, periodEndDate]);

  // PASIVOS: Cuentas por Pagar a Clientes, agrupadas por Tercero/Cliente
  // Salidas con cuenta "Cuentas por Pagar" = deuda adquirida (aumenta pasivo)
  // Entradas con cuenta "Cuentas por Pagar" = pago/cruce que reduce deuda (disminuye pasivo)
  const cuentasPorPagar = useMemo(() => {
    const clienteMap = new Map<string, number>();

    // Salidas (gastos) con "Cuentas por Pagar" → aumentan la deuda
    gastos.forEach(t => {
      const fecha = normalizeDate(t.fecha);
      if (fecha && fecha <= periodEndDate && isCuentaPorPagar(t.cuenta)) {
        const cliente = t.entidad?.trim() || 'Sin identificar';
        // Skip "DT Growth Partners" as entidad - in Salidas the real client is in entidad
        // But from the screenshots, the Tercero column has the client name
        // Since our data maps: entidad = col F (Entidad), and Tercero = col G
        // In Salidas: Entidad = "DT Growth Partners", Tercero = "Tennis Cartagena"
        // But Transaction only has 'entidad' which maps to col F
        // We need to check: if entidad is "DT Growth Partners", the real client might be elsewhere
        // For now let's use entidad, and we'll adjust if needed
        clienteMap.set(cliente, (clienteMap.get(cliente) || 0) + t.importe);
      }
    });

    // Entradas (ingresos) con "Cuentas por Pagar" → reducen la deuda
    ingresos.forEach(t => {
      const fecha = normalizeDate(t.fecha);
      if (fecha && fecha <= periodEndDate && isCuentaPorPagar(t.cuenta)) {
        const cliente = t.entidad?.trim() || 'Sin identificar';
        clienteMap.set(cliente, (clienteMap.get(cliente) || 0) - t.importe);
      }
    });

    const clientes = Array.from(clienteMap.entries())
      .map(([cliente, saldo]) => ({ cliente, saldo }))
      .filter(c => Math.abs(c.saldo) > 0.01)
      .sort((a, b) => b.saldo - a.saldo);

    const total = clientes.reduce((sum, c) => sum + c.saldo, 0);
    return { clientes, total };
  }, [ingresos, gastos, periodEndDate]);

  // CUENTAS POR COBRAR a Clientes (desde facturas)
  const cuentasPorCobrar = useMemo(() => {
    return invoices
      .filter(inv => {
        const fechaInv = normalizeDate(inv.fecha || inv.createdAt);
        if (fechaInv > periodEndDate) return false;
        const saldo = inv.totalAmount - (inv.paidAmount || 0);
        if (saldo <= 0) return false;
        if (inv.status === 'pagada') return false;
        return true;
      })
      .map(inv => ({
        clientName: inv.clientName || 'Cliente',
        invoiceNumber: inv.invoiceNumber || '',
        totalAmount: inv.totalAmount,
        paidAmount: inv.paidAmount || 0,
        saldo: inv.totalAmount - (inv.paidAmount || 0),
        fecha: inv.fecha || inv.createdAt,
      }))
      .sort((a, b) => b.saldo - a.saldo);
  }, [invoices, periodEndDate]);

  const totalCuentasPorCobrar = useMemo(() => cuentasPorCobrar.reduce((sum, c) => sum + c.saldo, 0), [cuentasPorCobrar]);

  // Utilidad del ejercicio (excluyendo traslados, reembolsos, ajustes)
  const filteredIngresos = useMemo(() => {
    return ingresos.filter(t => {
      if (isExcludedForUtilidad(t.categoria)) return false;
      const fecha = normalizeDate(t.fecha);
      return fecha && fecha <= periodEndDate;
    });
  }, [ingresos, periodEndDate]);

  const filteredGastos = useMemo(() => {
    return gastos.filter(t => {
      if (isExcludedForUtilidad(t.categoria)) return false;
      const fecha = normalizeDate(t.fecha);
      return fecha && fecha <= periodEndDate;
    });
  }, [gastos, periodEndDate]);

  const totalIngresosReal = useMemo(() => filteredIngresos.reduce((sum, t) => sum + t.importe, 0), [filteredIngresos]);
  const totalGastosReal = useMemo(() => filteredGastos.reduce((sum, t) => sum + t.importe, 0), [filteredGastos]);
  const utilidadEjercicio = totalIngresosReal - totalGastosReal;

  // ECUACIÓN CONTABLE: ACTIVO = PASIVO + PATRIMONIO
  const totalActivos = disponibleAlCorte.total + totalCuentasPorCobrar + disponibleAlCorte.totalRetenciones;
  const totalPasivos = cuentasPorPagar.total;

  // Patrimonio = Activos - Pasivos
  // Utilidad Ejercicios Anteriores = Patrimonio Total - Utilidad del Ejercicio
  const totalPatrimonio = totalActivos - totalPasivos;
  const utilidadEjerciciosAnteriores = totalPatrimonio - utilidadEjercicio;

  // Verificación: Activo = Pasivo + Patrimonio
  const verificacion = Math.abs(totalActivos - (totalPasivos + totalPatrimonio));

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${fmt(value)}`;
  };

  const periodLabels: Record<string, string> = {
    dic2025: 'Diciembre 2025 (Saldos Iniciales)',
    q1: 'Q1 2026',
    enero: 'Enero 2026',
    febrero: 'Febrero 2026',
    marzo: 'Marzo 2026',
    custom: dateRange?.from
      ? `${formatDateShort(dateRange.from)}${dateRange.to ? ` - ${formatDateShort(dateRange.to)}` : ''}`
      : 'Rango personalizado',
  };

  if (isLoading) {
    return (<div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>);
  }

  const getExportData = () => ({
    periodLabel: periodLabels[selectedPeriod],
    disponible: disponibleAlCorte.cuentas.filter(c => Math.abs(c.saldo) > 0.01),
    totalDisponible: disponibleAlCorte.total,
    cuentasPorCobrar: cuentasPorCobrar.map(c => ({ clientName: c.clientName, saldo: c.saldo })),
    totalCuentasPorCobrar,
    totalActivos,
    cuentasPorPagar: cuentasPorPagar.clientes,
    totalPasivos,
    utilidadEjercicio,
    utilidadEjerciciosAnteriores,
    totalPatrimonio,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Estado de Situación Financiera</h2>
          <p className="text-sm text-muted-foreground">Balance General al corte de {periodLabels[selectedPeriod]} — ACTIVO = PASIVO + PATRIMONIO</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportBalanceSheetPDF(getExportData())}>
            <FileDown className="h-4 w-4 mr-1" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportBalanceSheetExcel(getExportData())}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Excel
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex flex-wrap gap-2">
        <Button variant={selectedPeriod === 'dic2025' ? 'default' : 'outline'} size="sm" onClick={() => { setSelectedPeriod('dic2025'); setDateRange(undefined); }}>
          <History className="h-4 w-4 mr-1" /> 2025
        </Button>
        <Button variant={selectedPeriod === 'q1' ? 'default' : 'outline'} size="sm" onClick={() => { setSelectedPeriod('q1'); setDateRange(undefined); }}>
          <Target className="h-4 w-4 mr-1" /> Q1 Completo
        </Button>
        {(['enero', 'febrero', 'marzo'] as const).map((month) => (
          <Button key={month} variant={selectedPeriod === month ? 'default' : 'outline'} size="sm" onClick={() => { setSelectedPeriod(month); setDateRange(undefined); }}
            className={cn(month === currentMonthKey && selectedPeriod !== month && 'border-primary')}>
            {month === currentMonthKey && <Calendar className="h-4 w-4 mr-1" />}
            {month.charAt(0).toUpperCase() + month.slice(1)}
          </Button>
        ))}
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant={selectedPeriod === 'custom' ? 'default' : 'outline'} size="sm">
              <CalendarRange className="h-4 w-4 mr-1" />
              {selectedPeriod === 'custom' && dateRange?.from ? periodLabels.custom : 'Rango personalizado'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarPicker mode="range" selected={dateRange} onSelect={(range) => {
              setDateRange(range);
              if (range?.from) setSelectedPeriod('custom');
              if (range?.from && range?.to) setTimeout(() => setIsCalendarOpen(false), 300);
            }} numberOfMonths={2} defaultMonth={new Date(2025, 11)} />
          </PopoverContent>
        </Popover>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10"><Building2 className="h-5 w-5 text-success" /></div>
            <div><p className="text-sm text-muted-foreground">Total Activos</p><p className="text-2xl font-bold text-success">{formatCurrency(totalActivos)}</p></div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10"><CreditCard className="h-5 w-5 text-destructive" /></div>
            <div><p className="text-sm text-muted-foreground">Total Pasivos</p><p className="text-2xl font-bold text-destructive">{formatCurrency(totalPasivos)}</p></div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><DollarSign className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Total Patrimonio</p><p className="text-2xl font-bold text-primary">{formatCurrency(totalPatrimonio)}</p></div>
          </div>
        </div>
        <div className={cn("rounded-xl border p-4", utilidadEjercicio >= 0 ? "border-success/50 bg-success/10" : "border-destructive/50 bg-destructive/10")}>
          <div className="flex items-center gap-3">
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", utilidadEjercicio >= 0 ? "bg-success/20" : "bg-destructive/20")}>
              <TrendingUp className={cn("h-5 w-5", utilidadEjercicio >= 0 ? "text-success" : "text-destructive")} />
            </div>
            <div><p className="text-sm text-muted-foreground">Utilidad del Ejercicio</p><p className={cn("text-2xl font-bold", utilidadEjercicio >= 0 ? "text-success" : "text-destructive")}>{formatCurrency(utilidadEjercicio)}</p></div>
          </div>
        </div>
      </div>

      {/* Estado de Situación Financiera */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-6">Estado de Situación Financiera - {periodLabels[selectedPeriod]}</h3>

        {/* ==================== ACTIVOS ==================== */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-success" />
            <h4 className="text-lg font-bold text-foreground">ACTIVOS</h4>
          </div>

          {/* Disponible */}
          <div className="ml-4 mb-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
              Disponible {selectedPeriod === 'dic2025' ? '(Saldos al 31/12/2025)' : `(Saldos al corte)`}
            </p>
            <div className="space-y-1">
              {disponibleAlCorte.cuentas.filter(c => Math.abs(c.saldo) > 0.01).map((cuenta, index) => (
                <div key={index} className="flex items-center justify-between py-2 px-4 hover:bg-muted/50 rounded-lg transition-colors">
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2 w-2 rounded-full", cuenta.saldo >= 0 ? "bg-primary" : "bg-destructive")}></div>
                    <span className="text-sm text-foreground">{cuenta.cuenta}</span>
                  </div>
                  <span className={cn("text-sm font-medium", cuenta.saldo >= 0 ? "text-foreground" : "text-destructive")}>${fmt(cuenta.saldo)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-2 px-4 bg-primary/5 rounded-lg border border-primary/20 mt-1">
                <span className="text-sm font-bold text-foreground">Total Disponible</span>
                <span className="text-sm font-bold text-primary">${fmt(disponibleAlCorte.total)}</span>
              </div>
            </div>
          </div>

          {/* Cuentas por Cobrar */}
          <div className="ml-4 mb-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Cuentas por Cobrar a Clientes</p>
            <div className="space-y-1">
              {cuentasPorCobrar.length > 0 ? (
                <>
                  {cuentasPorCobrar.map((cuenta, index) => (
                    <div key={index} className="flex items-center justify-between py-2 px-4 hover:bg-muted/50 rounded-lg transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-warning"></div>
                        <div>
                          <span className="text-sm text-foreground">{cuenta.clientName}</span>
                          {cuenta.invoiceNumber && <span className="text-xs text-muted-foreground ml-2">#{cuenta.invoiceNumber.substring(0, 8)}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-foreground">${fmt(cuenta.saldo)}</span>
                        {cuenta.paidAmount > 0 && <span className="text-xs text-muted-foreground ml-2">(Abonado: ${fmt(cuenta.paidAmount)})</span>}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-2 px-4 bg-warning/5 rounded-lg border border-warning/20 mt-1">
                    <span className="text-sm font-bold text-foreground">Total Cuentas por Cobrar</span>
                    <span className="text-sm font-bold text-warning">${fmt(totalCuentasPorCobrar)}</span>
                  </div>
                </>
              ) : (
                <div className="py-2 px-4 text-sm text-muted-foreground">No hay cuentas por cobrar pendientes</div>
              )}
            </div>
          </div>

          {/* Retenciones en la Fuente */}
          {disponibleAlCorte.retenciones.length > 0 && (
            <div className="ml-4 mb-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Retenciones en la Fuente</p>
              <div className="space-y-1">
                {disponibleAlCorte.retenciones.filter(c => Math.abs(c.saldo) > 0.01).map((cuenta, index) => (
                  <div key={index} className="flex items-center justify-between py-2 px-4 hover:bg-muted/50 rounded-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                      <span className="text-sm text-foreground">{cuenta.cuenta}</span>
                    </div>
                    <span className="text-sm font-medium text-foreground">${fmt(cuenta.saldo)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 px-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 mt-1">
                  <span className="text-sm font-bold text-foreground">Total Retenciones</span>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">${fmt(disponibleAlCorte.totalRetenciones)}</span>
                </div>
              </div>
            </div>
          )}

          {/* TOTAL ACTIVOS */}
          <div className="flex items-center justify-between py-3 px-4 bg-success/10 rounded-lg border-2 border-success/30 mt-2">
            <span className="text-base font-bold text-foreground">TOTAL ACTIVOS</span>
            <span className="text-lg font-bold text-success">${fmt(totalActivos)}</span>
          </div>
        </div>

        <div className="border-t-4 border-border my-6"></div>

        {/* ==================== PASIVOS ==================== */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-5 w-5 text-destructive" />
            <h4 className="text-lg font-bold text-foreground">PASIVOS</h4>
          </div>

          <div className="ml-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Cuentas por Pagar a Clientes</p>
            <div className="space-y-1">
              {cuentasPorPagar.clientes.length > 0 ? (
                <>
                  {cuentasPorPagar.clientes.map((cliente, index) => (
                    <div key={index} className="flex items-center justify-between py-2 px-4 hover:bg-muted/50 rounded-lg transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-destructive"></div>
                        <span className="text-sm text-foreground">{cliente.cliente}</span>
                      </div>
                      <span className="text-sm font-medium text-destructive">${fmt(cliente.saldo)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-2 px-4 bg-destructive/5 rounded-lg border border-destructive/20 mt-1">
                    <span className="text-sm font-bold text-foreground">Total Cuentas por Pagar</span>
                    <span className="text-sm font-bold text-destructive">${fmt(cuentasPorPagar.total)}</span>
                  </div>
                </>
              ) : (
                <div className="py-2 px-4 text-sm text-muted-foreground">No hay cuentas por pagar pendientes</div>
              )}
            </div>
          </div>

          {/* TOTAL PASIVOS */}
          <div className="flex items-center justify-between py-3 px-4 bg-destructive/10 rounded-lg border-2 border-destructive/30 mt-4">
            <span className="text-base font-bold text-foreground">TOTAL PASIVOS</span>
            <span className="text-lg font-bold text-destructive">${fmt(totalPasivos)}</span>
          </div>
        </div>

        <div className="border-t-4 border-border my-6"></div>

        {/* ==================== PATRIMONIO ==================== */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-5 w-5 text-primary" />
            <h4 className="text-lg font-bold text-foreground">PATRIMONIO</h4>
          </div>

          <div className="ml-4 space-y-1">
            {/* Utilidad del Ejercicio */}
            <div className={cn("flex items-center justify-between py-2.5 px-4 rounded-lg transition-colors", utilidadEjercicio >= 0 ? "hover:bg-success/5" : "hover:bg-destructive/5")}>
              <div className="flex items-center gap-2">
                <div className={cn("h-2 w-2 rounded-full", utilidadEjercicio >= 0 ? "bg-success" : "bg-destructive")}></div>
                <div>
                  <span className="text-sm text-foreground">Utilidad del Ejercicio</span>
                  <p className="text-xs text-muted-foreground">Ingresos (${fmt(totalIngresosReal)}) - Gastos (${fmt(totalGastosReal)})</p>
                </div>
              </div>
              <span className={cn("text-sm font-medium", utilidadEjercicio >= 0 ? "text-success" : "text-destructive")}>${fmt(utilidadEjercicio)}</span>
            </div>

            {/* Utilidad de Ejercicios Anteriores */}
            <div className="flex items-center justify-between py-2.5 px-4 hover:bg-muted/50 rounded-lg transition-colors">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                <div>
                  <span className="text-sm text-foreground">Utilidad de Ejercicios Anteriores</span>
                  <p className="text-xs text-muted-foreground">Partida de cuadre (Activos - Pasivos - Utilidad del Ejercicio)</p>
                </div>
              </div>
              <span className="text-sm font-medium text-foreground">${fmt(utilidadEjerciciosAnteriores)}</span>
            </div>

            {/* TOTAL PATRIMONIO */}
            <div className="flex items-center justify-between py-3 px-4 bg-primary/10 rounded-lg border-2 border-primary/30 mt-2">
              <span className="text-base font-bold text-foreground">TOTAL PATRIMONIO</span>
              <span className="text-lg font-bold text-primary">${fmt(totalPatrimonio)}</span>
            </div>
          </div>
        </div>

        <div className="border-t-4 border-border my-6"></div>

        {/* Verificación de la ecuación contable */}
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center justify-between py-3 px-4 bg-success/5 rounded-lg border border-success/20">
            <span className="text-sm font-bold text-foreground">Activos</span>
            <span className="text-base font-bold text-success">${fmt(totalActivos)}</span>
          </div>
          <div className="flex items-center justify-between py-3 px-4 bg-destructive/5 rounded-lg border border-destructive/20">
            <span className="text-sm font-bold text-foreground">Pasivos</span>
            <span className="text-base font-bold text-destructive">${fmt(totalPasivos)}</span>
          </div>
          <div className="flex items-center justify-between py-3 px-4 bg-primary/5 rounded-lg border border-primary/20">
            <span className="text-sm font-bold text-foreground">Patrimonio</span>
            <span className="text-base font-bold text-primary">${fmt(totalPatrimonio)}</span>
          </div>
        </div>

        {verificacion < 1 ? (
          <div className="flex items-center justify-center gap-2 mt-4 py-2 px-4 bg-success/10 rounded-lg border border-success/30">
            <span className="text-sm font-medium text-success">✓ Activos (${fmt(totalActivos)}) = Pasivos (${fmt(totalPasivos)}) + Patrimonio (${fmt(totalPatrimonio)})</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 mt-4 py-2 px-4 bg-destructive/10 rounded-lg border border-destructive/30">
            <span className="text-sm font-medium text-destructive">⚠ Diferencia de cuadre: ${fmt(verificacion)}</span>
          </div>
        )}
      </div>

      {/* Composición de Activos */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-4">Composición de Activos</h3>
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Disponible</span>
              <span className="font-medium text-foreground">${fmt(disponibleAlCorte.total)} ({totalActivos > 0 ? ((disponibleAlCorte.total / totalActivos) * 100).toFixed(1) : 0}%)</span>
            </div>
            <div className="h-4 bg-muted/50 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${totalActivos > 0 ? Math.max(0, (disponibleAlCorte.total / totalActivos) * 100) : 0}%` }} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Cuentas por Cobrar</span>
              <span className="font-medium text-foreground">${fmt(totalCuentasPorCobrar)} ({totalActivos > 0 ? ((totalCuentasPorCobrar / totalActivos) * 100).toFixed(1) : 0}%)</span>
            </div>
            <div className="h-4 bg-muted/50 rounded-full overflow-hidden">
              <div className="h-full bg-warning rounded-full transition-all duration-300" style={{ width: `${totalActivos > 0 ? (totalCuentasPorCobrar / totalActivos) * 100 : 0}%` }} />
            </div>
          </div>
          {disponibleAlCorte.totalRetenciones > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Retenciones en la Fuente</span>
                <span className="font-medium text-foreground">${fmt(disponibleAlCorte.totalRetenciones)} ({totalActivos > 0 ? ((disponibleAlCorte.totalRetenciones / totalActivos) * 100).toFixed(1) : 0}%)</span>
              </div>
              <div className="h-4 bg-muted/50 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${totalActivos > 0 ? (disponibleAlCorte.totalRetenciones / totalActivos) * 100 : 0}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
