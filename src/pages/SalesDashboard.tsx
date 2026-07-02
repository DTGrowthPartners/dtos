import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import {
  ComposedChart, Area, Line, ReferenceDot, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Gauge, TrendingUp, Target, Receipt, Users, FileText, Flag, ArrowRight, Pencil, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import PipelineFunnel from '@/components/dashboard/PipelineFunnel';
import OperationsSection from '@/components/dashboard/OperationsSection';
import AiUsageWidget from '@/components/dashboard/AiUsageWidget';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarDays } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

interface Tx {
  importe: number;
  fecha: string;
  categoria?: string;
  entidad?: string;
  terceroNombre?: string;
  descripcion?: string;
}
interface FinanceData { ingresos?: Tx[]; gastos?: Tx[] }
interface PaymentPoint {
  x: number;
  monto: number;
  cliente: string;
  fecha: string;
  descripcion?: string;
}

type Period = 'hoy' | '7d' | 'mes' | 'mesant' | 'ano' | 'custom';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');
const fmtCompact = (n: number) =>
  Math.abs(n) >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : '$' + Math.round(n / 1000) + 'K';

const startsWithLocalDate = (fecha: string) => fecha; // las fechas vienen "YYYY-MM-DD..."

const isPagoCliente = (tx: Tx) => (tx.categoria || '').trim().toUpperCase() === 'PAGO DE CLIENTE';

// Excluye traslados entre cuentas propias y ajustes contables: no son venta ni gasto real.
const isRealMovement = (tx: Tx) => {
  const c = (tx.categoria || '').trim().toUpperCase();
  return !c.startsWith('TRASLADO') && c !== 'AJUSTE SALDO';
};

const dateParts = (fecha: string) => {
  const [date] = (fecha || '').split('T');
  const [year, month, day] = date.split('-').map(Number);
  return { year, month: month - 1, day, date };
};

const fmtDate = (fecha: string) => {
  const { year, month, day } = dateParts(fecha);
  if (!year || month < 0 || !day) return fecha;
  return new Date(year, month, day).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const SalesChartTooltip = ({ active, payload, label, model }: any) => {
  if (!active || !payload?.length) return null;

  const dayData = payload[0]?.payload;
  const dayPayments: PaymentPoint[] = dayData?.dayPayments || [];
  const series = payload.filter((item: any) => item.value != null && item.dataKey !== 'dayPayments');

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground mb-1">{model.unidad} {model.xLabel(label as number)}</div>
      <div className="space-y-0.5">
        {series.map((item: any) => {
          const name = String(item.name || item.dataKey);
          return (
            <div key={item.dataKey} className="flex items-center justify-between gap-5">
              <span className="text-muted-foreground">{name.charAt(0).toUpperCase() + name.slice(1)}</span>
              <span className="font-medium text-foreground">{fmt(Number(item.value))}</span>
            </div>
          );
        })}
      </div>
      {dayPayments.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border space-y-1.5">
          {dayPayments.map((pm, i) => (
            <div key={i}>
              <div className="font-semibold text-emerald-500">{fmt(pm.monto)}</div>
              <div className="text-foreground">{pm.cliente}</div>
              <div className="text-muted-foreground">{fmtDate(pm.fecha)}</div>
              {pm.descripcion && <div className="max-w-[220px] text-muted-foreground">{pm.descripcion}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const MonthlyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground mb-1">
        {label} {row.isFuture && <span className="text-violet-400">(proyección)</span>}
      </div>
      <div className="space-y-0.5">
        {row.metaIngreso != null && (
          <div className="flex items-center justify-between gap-5">
            <span className="text-blue-400">Proyección</span>
            <span className="font-medium text-blue-400">{fmt(row.metaIngreso)}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-5">
          <span className="text-muted-foreground">Ingresos</span>
          <span className="font-medium text-foreground">{fmt(row.ingresos)}</span>
        </div>
        <div className="flex items-center justify-between gap-5">
          <span className="text-muted-foreground">Gastos</span>
          <span className="font-medium text-foreground">{fmt(row.gastos)}</span>
        </div>
        <div className="flex items-center justify-between gap-5 pt-0.5 border-t border-border mt-1">
          <span className="text-muted-foreground">Neto</span>
          <span className="font-medium text-foreground">{fmt(row.neto)}</span>
        </div>
      </div>
    </div>
  );
};

export default function SalesDashboard() {
  const [period, setPeriod] = useState<Period>('mes');
  const [ingresos, setIngresos] = useState<Tx[]>([]);
  const [gastos, setGastos] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(() => Number(localStorage.getItem('dash.meta')) || 22000000);
  const [presupuesto, setPresupuesto] = useState(() => Number(localStorage.getItem('dash.presupuesto')) || 14500000);
  const [metaByMonth, setMetaByMonth] = useState<Record<number, number>>({});
  const [range, setRange] = useState<DateRange | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [editingMonthIdx, setEditingMonthIdx] = useState<number | null>(null);

  useEffect(() => {
    apiClient.get<{ value: Record<number, number> | null }>('/api/config/metaByMonth')
      .then((d) => { if (d.value) setMetaByMonth(d.value); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    const fetchFinance = () => {
      apiClient
        .get<FinanceData>('/api/finance/data')
        .then((d) => { if (alive) { setIngresos((d.ingresos || []).filter(isRealMovement)); setGastos((d.gastos || []).filter(isRealMovement)); } })
        .catch(() => {})
        .finally(() => { if (alive) setLoading(false); });
    };
    fetchFinance();
    // Auto-refresh: al volver a la pestaña y cada 3 min, relee Sheets en vivo.
    const onVisible = () => { if (document.visibilityState === 'visible') fetchFinance(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', fetchFinance);
    const id = window.setInterval(fetchFinance, 180000);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', fetchFinance);
      clearInterval(id);
    };
  }, []);

  const editMeta = () => {
    const v = prompt('Meta de ingresos del mes (COP):', String(meta));
    if (v && !isNaN(Number(v))) { const n = Number(v); setMeta(n); localStorage.setItem('dash.meta', String(n)); }
  };
  const saveMetaByMonth = (next: Record<number, number>) => {
    setMetaByMonth(next);
    apiClient.put('/api/config/metaByMonth', { value: next }).catch(() => {});
  };
  const editMonthMeta = (monthIdx: number) => {
    const current = metaByMonth[monthIdx] ?? meta;
    const v = prompt(`Meta de ingresos · ${MONTHS[monthIdx]} (COP):`, String(current));
    if (v && !isNaN(Number(v))) {
      saveMetaByMonth({ ...metaByMonth, [monthIdx]: Number(v) });
    }
  };
  const editPresupuesto = () => {
    const v = prompt('Presupuesto de gastos del mes (COP):', String(presupuesto));
    if (v && !isNaN(Number(v))) { const n = Number(v); setPresupuesto(n); localStorage.setItem('dash.presupuesto', String(n)); }
  };

  // ===== Cálculo del período seleccionado =====
  const model = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const today = now.getDate();

    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const sum = (txs: Tx[], pred: (d: string) => boolean) => txs.filter((t) => pred(startsWithLocalDate(t.fecha))).reduce((s, t) => s + (t.importe || 0), 0);

    // ----- RANGO PERSONALIZADO -----
    if (period === 'custom' && range?.from && range?.to) {
      const start = new Date(range.from); start.setHours(0, 0, 0, 0);
      const end = new Date(range.to); end.setHours(0, 0, 0, 0);
      const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
      const data = [];
      let cumI = 0, cumE = 0, totI = 0, totE = 0;
      for (let i = 0; i < days; i++) {
        const d = new Date(start.getTime() + i * 86400000);
        const key = ymd(d);
        const inc = sum(ingresos, (f) => f.startsWith(key));
        const exp = sum(gastos, (f) => f.startsWith(key));
        cumI += inc; cumE += exp; totI += inc; totE += exp;
        data.push({ x: i, ingresos: cumI, gastos: cumE, proyeccion: null, dayPayments: [] as PaymentPoint[] });
      }
      const fmtD = (d: Date) => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
      const step = Math.max(1, Math.ceil(days / 10));
      return {
        titulo: `${fmtD(start)} – ${fmtD(end)} ${end.getFullYear()}`, chartTitle: 'Acumulado · rango',
        xLabel: (v: number | string) => { const d = new Date(start.getTime() + Number(v) * 86400000); return `${d.getDate()}/${d.getMonth() + 1}`; },
        isCurrent: false, elapsed: days, total: days,
        xDomain: [0, days - 1] as [number, number],
        xTicks: data.filter((_, i) => i % step === 0).map((p) => p.x),
        payments: [] as PaymentPoint[],
        mtdIngresos: totI, mtdGastos: totE, avgPerDay: totI / days, neededPerDay: 0, proyeccion: totI, data, unidad: '',
      };
    }

    // ----- MES (en curso) o MES ANTERIOR -----
    if (period === 'mes' || period === 'mesant') {
      const mm = period === 'mes' ? m : m - 1;
      const yy = mm < 0 ? y - 1 : y;
      const mn = (mm + 12) % 12;
      const prefix = `${yy}-${String(mn + 1).padStart(2, '0')}`;
      const daysInMonth = new Date(yy, mn + 1, 0).getDate();
      const isCurrent = period === 'mes';
      const elapsed = isCurrent ? today : daysInMonth;

      const incByDay = Array(daysInMonth + 1).fill(0);
      const expByDay = Array(daysInMonth + 1).fill(0);
      const payments: PaymentPoint[] = [];
      ingresos.forEach((t) => {
        if (!t.fecha?.startsWith(prefix)) return;
        const { day } = dateParts(t.fecha);
        incByDay[day] += t.importe || 0;
        if (isPagoCliente(t)) {
          payments.push({
            x: day,
            monto: t.importe || 0,
            cliente: t.terceroNombre || t.entidad || 'Cliente sin identificar',
            fecha: t.fecha,
            descripcion: t.descripcion,
          });
        }
      });
      gastos.forEach((t) => {
        if (!t.fecha?.startsWith(prefix)) return;
        expByDay[dateParts(t.fecha).day] += t.importe || 0;
      });

      let cumI = 0, cumE = 0;
      const mtdIngresos = incByDay.slice(0, elapsed + 1).reduce((a, b) => a + b, 0);
      const mtdGastos = expByDay.slice(0, elapsed + 1).reduce((a, b) => a + b, 0);
      const avgPerDay = mtdIngresos / Math.max(1, elapsed);

      const data = [];
      for (let d = 1; d <= daysInMonth; d++) {
        cumI += incByDay[d]; cumE += expByDay[d];
        const p: Record<string, any> = { x: d };
        p.ingresos = d <= elapsed ? cumI : null;
        p.gastos = d <= elapsed ? cumE : null;
        p.proyeccion = isCurrent && d >= elapsed ? mtdIngresos + avgPerDay * (d - elapsed) : null;
        p.dayPayments = payments.filter((pm) => pm.x === d);
        data.push(p);
      }
      const monthMeta = metaByMonth[mn] ?? meta;
      const proyeccion = isCurrent ? mtdIngresos + avgPerDay * (daysInMonth - elapsed) : mtdIngresos;
      const neededPerDay = isCurrent ? Math.max(0, monthMeta - mtdIngresos) / Math.max(1, daysInMonth - elapsed) : 0;
      const daily = !isCurrent ? Array.from({ length: daysInMonth }, (_, i) => {
        const d = i + 1;
        const ing = incByDay[d] || 0;
        const gas = expByDay[d] || 0;
        return { day: d, label: String(d), ingresos: ing, gastos: gas, neto: ing - gas };
      }) : undefined;
      return {
        titulo: (isCurrent ? 'Mes en curso · ' : '') + MONTHS[mn].charAt(0).toUpperCase() + MONTHS[mn].slice(1) + ' ' + yy,
        chartTitle: `Acumulado · ${MONTHS[mn]}`,
        xLabel: (v: number) => String(v),
        isCurrent, elapsed, total: daysInMonth, xDomain: [1, daysInMonth] as [number, number], xTicks: data.map((p) => p.x), mtdIngresos, mtdGastos, avgPerDay, neededPerDay, proyeccion, data, payments,
        unidad: 'día', daily, monthMeta, monthIdx: mn,
      };
    }

    // ----- AÑO -----
    if (period === 'ano') {
      const prefix = `${y}-`;
      const incByMonth = Array(12).fill(0);
      const expByMonth = Array(12).fill(0);
      const payments: PaymentPoint[] = [];
      ingresos.forEach((t) => {
        if (!t.fecha?.startsWith(prefix)) return;
        const { month } = dateParts(t.fecha);
        incByMonth[month] += t.importe || 0;
        if (isPagoCliente(t)) {
          payments.push({
            x: month,
            monto: t.importe || 0,
            cliente: t.terceroNombre || t.entidad || 'Cliente sin identificar',
            fecha: t.fecha,
            descripcion: t.descripcion,
          });
        }
      });
      gastos.forEach((t) => {
        if (!t.fecha?.startsWith(prefix)) return;
        expByMonth[dateParts(t.fecha).month] += t.importe || 0;
      });
      let cumI = 0, cumE = 0;
      const mtdIngresos = incByMonth.slice(0, m + 1).reduce((a, b) => a + b, 0);
      const mtdGastos = expByMonth.slice(0, m + 1).reduce((a, b) => a + b, 0);
      const avgPerMonth = mtdIngresos / Math.max(1, m + 1);
      const avgGastoPerMonth = mtdGastos / Math.max(1, m + 1);
      const data = [];
      for (let i = 0; i < 12; i++) {
        cumI += incByMonth[i]; cumE += expByMonth[i];
        const p: Record<string, any> = { x: i };
        p.ingresos = i <= m ? cumI : null;
        p.gastos = i <= m ? cumE : null;
        p.proyeccion = i >= m ? mtdIngresos + avgPerMonth * (i - m) : null;
        p.dayPayments = payments.filter((pm) => pm.x === i);
        data.push(p);
      }
      const proyeccion = mtdIngresos + avgPerMonth * (11 - m);
      // Detalle mes a mes (no acumulado): reales para meses transcurridos, proyección plana para los que faltan
      const monthly = MONTHS_SHORT.map((label, i) => {
        const isFuture = i > m;
        const ingresos = isFuture ? avgPerMonth : incByMonth[i];
        const gastos = isFuture ? avgGastoPerMonth : expByMonth[i];
        // Series partidas para graficar: sólido hasta el mes actual, punteado desde ahí (ancladas en el mismo punto)
        const ingresosReal = i <= m ? incByMonth[i] : null;
        const gastosReal = i <= m ? expByMonth[i] : null;
        const ingresosProy = i >= m ? ingresos : null;
        const gastosProy = i >= m ? gastos : null;
        return { month: i, label, ingresos, gastos, neto: ingresos - gastos, isFuture, ingresosReal, gastosReal, ingresosProy, gastosProy, metaIngreso: metaByMonth[i] ?? meta };
      });
      return {
        titulo: `Año ${y}`, chartTitle: `Acumulado · ${y}`, xLabel: (v: number) => MONTHS_SHORT[v] || '',
        isCurrent: true, elapsed: m + 1, total: 12, mtdIngresos, mtdGastos, avgPerDay: avgPerMonth,
        neededPerDay: Math.max(0, meta * 12 - mtdIngresos) / Math.max(1, 11 - m), proyeccion, data, payments, xDomain: [0, 11] as [number, number], xTicks: data.map((p) => p.x), unidad: 'mes', monthly,
      };
    }

    // ----- HOY (24 horas) -----
    if (period === 'hoy') {
      const todayKey = ymd(new Date(y, m, today));
      const currentHour = now.getHours();
      const incByHour = Array(24).fill(0);
      const expByHour = Array(24).fill(0);
      ingresos.forEach((t) => {
        if (!t.fecha?.startsWith(todayKey)) return;
        const h = t.fecha.length > 10 ? parseInt(t.fecha.substring(11, 13), 10) : 0;
        if (h >= 0 && h < 24) incByHour[h] += t.importe || 0;
      });
      gastos.forEach((t) => {
        if (!t.fecha?.startsWith(todayKey)) return;
        const h = t.fecha.length > 10 ? parseInt(t.fecha.substring(11, 13), 10) : 0;
        if (h >= 0 && h < 24) expByHour[h] += t.importe || 0;
      });
      const mtdIngresos = incByHour.reduce((a, b) => a + b, 0);
      const mtdGastos = expByHour.reduce((a, b) => a + b, 0);
      let cumI = 0, cumE = 0;
      const data = [];
      const payments: PaymentPoint[] = [];
      for (let h = 0; h < 24; h++) {
        cumI += incByHour[h]; cumE += expByHour[h];
        const dayPayments = ingresos
          .filter((t) => {
            if (!t.fecha?.startsWith(todayKey) || !isPagoCliente(t)) return false;
            const th = t.fecha.length > 10 ? parseInt(t.fecha.substring(11, 13), 10) : 0;
            return th === h;
          })
          .map((t) => ({ x: h, monto: t.importe || 0, cliente: t.terceroNombre || t.entidad || 'Cliente sin identificar', fecha: t.fecha, descripcion: t.descripcion }));
        data.push({ x: h, ingresos: h <= currentHour ? cumI : null, gastos: h <= currentHour ? cumE : null, proyeccion: null, dayPayments });
        dayPayments.forEach((p) => payments.push(p));
      }
      return {
        titulo: 'Hoy', chartTitle: 'Hoy · acumulado por hora',
        xLabel: (v: number) => `${String(v).padStart(2, '0')}h`,
        isCurrent: false, elapsed: currentHour + 1, total: 24,
        xDomain: [0, 23] as [number, number],
        xTicks: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22],
        payments, mtdIngresos, mtdGastos, avgPerDay: mtdIngresos, neededPerDay: 0, proyeccion: mtdIngresos, data, unidad: '',
      };
    }

    // ----- 7 DÍAS (valor real por día, no acumulado) -----
    {
      const days7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(y, m, today - (6 - i));
        return { key: ymd(d), label: `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`, date: d, idx: i };
      });
      const data: Record<string, any>[] = [];
      const payments: PaymentPoint[] = [];
      let mtdIngresos = 0, mtdGastos = 0;
      days7.forEach(({ key, idx }) => {
        const inc = sum(ingresos, (f) => f.startsWith(key));
        const exp = sum(gastos, (f) => f.startsWith(key));
        mtdIngresos += inc; mtdGastos += exp;
        const dayPayments = ingresos
          .filter((t) => t.fecha?.startsWith(key) && isPagoCliente(t))
          .map((t) => ({ x: idx, monto: t.importe || 0, cliente: t.terceroNombre || t.entidad || 'Cliente sin identificar', fecha: t.fecha, descripcion: t.descripcion }));
        data.push({ x: idx, ingresos: inc, gastos: exp, proyeccion: null, dayPayments });
        dayPayments.forEach((p) => payments.push(p));
      });
      const labels = days7.map(({ label }) => label);
      return {
        titulo: 'Últimos 7 días', chartTitle: 'Últimos 7 días · por día',
        xLabel: (v: number) => labels[v] ?? '',
        isCurrent: false, elapsed: 7, total: 7,
        xDomain: [0, 6] as [number, number],
        xTicks: [0, 1, 2, 3, 4, 5, 6],
        payments, mtdIngresos, mtdGastos, avgPerDay: mtdIngresos / 7, neededPerDay: 0, proyeccion: mtdIngresos, data, unidad: '',
      };
    }
  }, [period, ingresos, gastos, meta, metaByMonth, range]);

  const activeMeta: number = (model as any).monthMeta ?? meta;
  const metaPct = Math.min(100, Math.round((model.mtdIngresos / Math.max(1, activeMeta)) * 100));
  const presupPct = Math.round((model.mtdGastos / Math.max(1, presupuesto)) * 100);
  const ritmoPct = model.neededPerDay > 0 ? Math.round((model.avgPerDay / model.neededPerDay - 1) * 100) : 0;
  const enLinea = model.avgPerDay >= model.neededPerDay;
  const proyVsMeta = model.proyeccion - activeMeta;
  const showMetaCards = period === 'mes' || period === 'ano';
  const onEditMeta = () => {
    const mIdx = (model as any).monthIdx;
    if (mIdx !== undefined) editMonthMeta(mIdx); else editMeta();
  };

  const periods: { id: Period; label: string }[] = [
    { id: 'hoy', label: 'Hoy' }, { id: '7d', label: '7d' }, { id: 'mes', label: 'Mes' },
    { id: 'mesant', label: 'Mes ant.' }, { id: 'ano', label: 'Año' },
  ];

  if (loading) return <div className="text-center py-20 text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header + selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Ingresos</p>
          <h1 className="text-2xl sm:text-3xl font-bold">{model.titulo}</h1>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1 self-start flex-wrap">
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${period === p.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {p.label}
            </button>
          ))}
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors flex items-center gap-1.5 ${period === 'custom' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <CalendarDays className="h-4 w-4" /> Personalizado
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarPicker mode="range" numberOfMonths={2} selected={range} onSelect={setRange} defaultMonth={range?.from} />
              <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
                {([
                  { label: 'Q1', range: () => { const y = new Date().getFullYear(); return { from: new Date(y, 0, 1), to: new Date(y, 2, 31) }; } },
                  { label: 'Q2', range: () => { const y = new Date().getFullYear(); return { from: new Date(y, 3, 1), to: new Date(y, 5, 30) }; } },
                  { label: 'Q3', range: () => { const y = new Date().getFullYear(); return { from: new Date(y, 6, 1), to: new Date(y, 8, 30) }; } },
                  { label: 'Q4', range: () => { const y = new Date().getFullYear(); return { from: new Date(y, 9, 1), to: new Date(y, 11, 31) }; } },
                  { label: 'Últ. 30d', range: () => ({ from: new Date(Date.now() - 30 * 86400000), to: new Date() }) },
                  { label: 'Últ. 90d', range: () => ({ from: new Date(Date.now() - 90 * 86400000), to: new Date() }) },
                ] as { label: string; range: () => DateRange }[]).map((p) => (
                  <button key={p.label} onClick={() => setRange(p.range())} className="px-2.5 py-1 text-xs rounded-md border border-border hover:bg-muted text-muted-foreground hover:text-foreground">
                    {p.label}
                  </button>
                ))}
                <button
                  disabled={!range?.from || !range?.to}
                  onClick={() => { setPeriod('custom'); setPickerOpen(false); }}
                  className="ml-auto px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50"
                >
                  Aplicar
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* KPIs */}
      <Card>
        <CardContent className="pt-5">
          <div className="grid gap-5 md:grid-cols-3">
            {/* Ingresos vs meta */}
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Target className="h-4 w-4" /> {showMetaCards ? 'Ingresos MTD' : 'Ingresos'}</p>
              <p className="text-3xl font-bold tabular-nums mt-1">{fmt(model.mtdIngresos)}</p>
              {showMetaCards && (
                <>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    de meta {fmt(activeMeta)} <button onClick={onEditMeta} className="inline-flex items-center text-primary hover:underline ml-1"><Pencil className="h-3 w-3" /></button>
                  </p>
                  <div className="h-2 rounded-full bg-muted mt-2 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${metaPct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span className="text-emerald-500 font-medium">{metaPct}% cumplido</span>
                    <span>{model.unidad} {model.elapsed} de {model.total}</span>
                  </div>
                </>
              )}
            </div>

            {/* Ritmo */}
            {showMetaCards && (
              <div className="md:border-l md:pl-5 border-border">
                <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Gauge className="h-4 w-4" /> Ritmo</p>
                <p className={`text-3xl font-bold mt-1 ${enLinea ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {ritmoPct >= 0 ? '+' : ''}{ritmoPct}% <span className="text-sm font-normal text-muted-foreground">{enLinea ? '↗ en línea' : '↘ atrás'}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-2">Necesitas <b className="text-foreground">{fmtCompact(model.neededPerDay)}/{model.unidad}</b></p>
                <p className="text-xs text-muted-foreground">promedio actual <b className="text-foreground">{fmtCompact(model.avgPerDay)}/{model.unidad}</b></p>
              </div>
            )}

            {/* Proyección */}
            {showMetaCards && (
              <div className="md:border-l md:pl-5 border-border">
                <p className="text-sm text-muted-foreground flex items-center gap-1.5"><TrendingUp className="h-4 w-4" /> Proyección cierre</p>
                <p className="text-3xl font-bold text-violet-400 mt-1">{fmtCompact(model.proyeccion)}</p>
                <p className={`text-xs mt-1 ${proyVsMeta >= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {proyVsMeta >= 0 ? '✓ ' : ''}{fmtCompact(Math.abs(proyVsMeta))} {proyVsMeta >= 0 ? 'sobre' : 'bajo'} meta
                </p>
                <p className="text-xs text-muted-foreground mt-1">Rango 90%: {fmtCompact(model.proyeccion * 0.88)} – {fmtCompact(model.proyeccion * 1.12)}</p>
              </div>
            )}

            {/* Si no es mes/año: mostrar gasto al lado */}
            {!showMetaCards && (
              <div className="md:border-l md:pl-5 border-border">
                <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Receipt className="h-4 w-4" /> Gastos</p>
                <p className="text-3xl font-bold tabular-nums mt-1 text-amber-500">{fmt(model.mtdGastos)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gasto vs presupuesto (barra) */}
      {showMetaCards && (
        <Card>
          <CardContent className="py-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground"><Receipt className="h-4 w-4" /> Gasto MTD</span>
            <span className="font-bold text-amber-500 tabular-nums">{fmt(model.mtdGastos)}</span>
            <span className="text-muted-foreground">
              de presup. {fmtCompact(presupuesto)} <button onClick={editPresupuesto} className="inline-flex items-center text-primary hover:underline"><Pencil className="h-3 w-3" /></button> ·{' '}
              <span className={presupPct <= 100 ? 'text-emerald-500' : 'text-destructive'}>{presupPct}% — {presupPct <= 100 ? 'bajo control' : 'excedido'}</span>
            </span>
          </CardContent>
        </Card>
      )}

      {/* Gráfica acumulada (oculta en año y mes anterior, donde se muestra el detalle día a día / mes a mes) */}
      {period !== 'ano' && period !== 'mesant' && <Card>
        <CardContent className="pt-5">
          <h3 className="font-semibold mb-3">{model.chartTitle}</h3>
          <div className="h-[400px] sm:h-[440px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={model.data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0.03} /></linearGradient>
                  <linearGradient id="gG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.30} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0.03} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                <XAxis dataKey="x" type="number" domain={model.xDomain} ticks={model.xTicks} tickFormatter={model.xLabel} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                <YAxis tickFormatter={(v) => fmtCompact(v)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={52} />
                <Tooltip content={(props) => <SalesChartTooltip {...props} model={model} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#22c55e" strokeWidth={2.5} fill="url(#gI)" connectNulls />
                <Area type="monotone" dataKey="gastos" name="Gastos" stroke="#f59e0b" strokeWidth={2} fill="url(#gG)" connectNulls />
                {period === 'mes' && (model as any).monthMeta && (
                  <ReferenceLine y={(model as any).monthMeta} stroke="#3b82f6" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: `Meta ${fmtCompact((model as any).monthMeta)}`, fill: '#3b82f6', fontSize: 10, position: 'insideTopRight' }} />
                )}
                {(model.payments || []).map((pm, i) => (
                  <ReferenceDot key={i} x={pm.x} y={pm.monto} r={5} fill="#22c55e" stroke="#fff" strokeWidth={1.5} isFront />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>}

      {/* Detalle mes a mes: Ingresos, Gastos y Proyección (vista Año) */}
      {period === 'ano' && model.monthly && (
        <Card>
          <CardContent className="pt-5">
            <h3 className="font-semibold">Detalle mes a mes · {model.titulo.replace('Año ', '')}</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Valor real por mes (no acumulado) · línea punteada y filas en violeta = proyección estimada para meses futuros
            </p>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={model.monthly} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gMI" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0.03} /></linearGradient>
                    <linearGradient id="gMG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.30} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0.03} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={52} />
                  <Tooltip content={<MonthlyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="ingresosReal" name="Ingresos" stroke="#22c55e" strokeWidth={2.5} fill="url(#gMI)" connectNulls />
                  <Area type="monotone" dataKey="gastosReal" name="Gastos" stroke="#f59e0b" strokeWidth={2} fill="url(#gMG)" connectNulls />
                  <Line type="monotone" dataKey="ingresosProy" name="Ingresos (proy.)" legendType="none" stroke="#22c55e" strokeWidth={2.5} strokeDasharray="6 5" dot={false} connectNulls />
                  <Line type="monotone" dataKey="gastosProy" name="Gastos (proy.)" legendType="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 5" dot={false} connectNulls />
                  <Line type="monotone" dataKey="metaIngreso" name="Proyección" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <button
              onClick={() => setTableOpen((o) => !o)}
              className="mt-4 flex w-full items-center justify-between rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              <span>Tabla detalle por mes</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${tableOpen ? 'rotate-180' : ''}`} />
            </button>
            {tableOpen && (
              <div className="mt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mes</TableHead>
                      <TableHead className="text-right text-blue-400">Proyección ing.</TableHead>
                      <TableHead className="text-right">Ingresos</TableHead>
                      <TableHead className="text-right">Gastos</TableHead>
                      <TableHead className="text-right">Neto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {model.monthly.map((row: any) => (
                      <TableRow key={row.month}>
                        <TableCell className="font-medium capitalize">
                          {MONTHS[row.month]}
                          {row.isFuture && <span className="ml-1.5 text-[10px] font-normal text-violet-400">proy.</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {editingMonthIdx === row.month ? (
                            <input
                              autoFocus
                              type="number"
                              defaultValue={metaByMonth[row.month] ?? meta}
                              className="w-28 text-right bg-transparent border-b border-blue-400 outline-none text-blue-400"
                              onBlur={(e) => {
                                const n = Number(e.target.value);
                                if (n > 0) saveMetaByMonth({ ...metaByMonth, [row.month]: n });
                                setEditingMonthIdx(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') setEditingMonthIdx(null);
                              }}
                            />
                          ) : (
                            <span className="flex items-center justify-end gap-1.5">
                              <span className="text-blue-400">{fmt(metaByMonth[row.month] ?? meta)}</span>
                              <button onClick={() => setEditingMonthIdx(row.month)} className="text-muted-foreground hover:text-primary">
                                <Pencil className="h-3 w-3" />
                              </button>
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-500">{row.isFuture ? <span className="text-muted-foreground">—</span> : fmt(row.ingresos)}</TableCell>
                        <TableCell className="text-right tabular-nums text-amber-500">{row.isFuture ? <span className="text-muted-foreground">—</span> : fmt(row.gastos)}</TableCell>
                        <TableCell className={`text-right tabular-nums font-medium ${row.neto >= 0 ? 'text-foreground' : 'text-destructive'}`}>{row.isFuture ? <span className="text-muted-foreground">—</span> : fmt(row.neto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-semibold">Total {model.titulo.replace('Año ', '')}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-blue-400">{fmt(MONTHS.reduce((s, _, i) => s + (metaByMonth[i] ?? meta), 0))}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-emerald-500">{fmt(model.monthly.filter((r: any) => !r.isFuture).reduce((s: number, r: any) => s + r.ingresos, 0))}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-amber-500">{fmt(model.monthly.filter((r: any) => !r.isFuture).reduce((s: number, r: any) => s + r.gastos, 0))}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{fmt(model.monthly.filter((r: any) => !r.isFuture).reduce((s: number, r: any) => s + r.neto, 0))}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detalle día a día (vista Mes anterior) */}
      {period === 'mesant' && model.daily && (
        <Card>
          <CardContent className="pt-5">
            <h3 className="font-semibold">Detalle día a día · {model.titulo}</h3>
            <p className="text-xs text-muted-foreground mb-3">Valor real por día (no acumulado)</p>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={model.daily} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gDI" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0.03} /></linearGradient>
                    <linearGradient id="gDG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.30} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0.03} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                  <XAxis dataKey="label" interval={4} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={52} />
                  <Tooltip content={<MonthlyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#22c55e" strokeWidth={2.5} fill="url(#gDI)" />
                  <Area type="monotone" dataKey="gastos" name="Gastos" stroke="#f59e0b" strokeWidth={2} fill="url(#gDG)" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <button
              onClick={() => setTableOpen((o) => !o)}
              className="mt-4 flex w-full items-center justify-between rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              <span>Tabla detalle por día</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${tableOpen ? 'rotate-180' : ''}`} />
            </button>
            {tableOpen && (
              <div className="mt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Día</TableHead>
                      <TableHead className="text-right">Ingresos</TableHead>
                      <TableHead className="text-right">Gastos</TableHead>
                      <TableHead className="text-right">Neto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {model.daily.filter((r: any) => r.ingresos > 0 || r.gastos > 0).map((row: any) => (
                      <TableRow key={row.day}>
                        <TableCell className="font-medium">{row.day}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-500">{fmt(row.ingresos)}</TableCell>
                        <TableCell className="text-right tabular-nums text-amber-500">{fmt(row.gastos)}</TableCell>
                        <TableCell className={`text-right tabular-nums font-medium ${row.neto >= 0 ? 'text-foreground' : 'text-destructive'}`}>{fmt(row.neto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-semibold">Total {model.titulo}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-emerald-500">{fmt(model.mtdIngresos)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-amber-500">{fmt(model.mtdGastos)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{fmt(model.mtdIngresos - model.mtdGastos)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Consumo de IA semanal */}
      <AiUsageWidget />

      {/* Embudo de conversión (pipeline) */}
      <PipelineFunnel />

      {/* Operación — carga y entregas */}
      <OperationsSection />

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { to: '/clientes', icon: Users, label: 'Top clientes' },
          { to: '/finanzas', icon: FileText, label: 'Desglose gastos' },
          { to: '/ventas', icon: Target, label: 'Pipeline' },
          { to: '/finanzas', icon: Flag, label: 'Gap a meta' },
        ].map((q) => (
          <Link key={q.label} to={q.to} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm hover:border-primary/40 transition-colors">
            <span className="flex items-center gap-2 text-muted-foreground"><q.icon className="h-4 w-4" /> {q.label}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
