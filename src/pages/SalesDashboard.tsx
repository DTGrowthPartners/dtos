import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import {
  ComposedChart, Area, Line, ReferenceDot, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Gauge, TrendingUp, Target, Receipt, Users, FileText, Flag, ArrowRight, Pencil } from 'lucide-react';
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

export default function SalesDashboard() {
  const [period, setPeriod] = useState<Period>('mes');
  const [ingresos, setIngresos] = useState<Tx[]>([]);
  const [gastos, setGastos] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(() => Number(localStorage.getItem('dash.meta')) || 22000000);
  const [presupuesto, setPresupuesto] = useState(() => Number(localStorage.getItem('dash.presupuesto')) || 14500000);
  const [range, setRange] = useState<DateRange | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const fetchFinance = () => {
      apiClient
        .get<FinanceData>('/api/finance/data')
        .then((d) => { if (alive) { setIngresos(d.ingresos || []); setGastos(d.gastos || []); } })
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
      const proyeccion = isCurrent ? mtdIngresos + avgPerDay * (daysInMonth - elapsed) : mtdIngresos;
      const neededPerDay = isCurrent ? Math.max(0, meta - mtdIngresos) / Math.max(1, daysInMonth - elapsed) : 0;
      return {
        titulo: (isCurrent ? 'Mes en curso · ' : '') + MONTHS[mn].charAt(0).toUpperCase() + MONTHS[mn].slice(1) + ' ' + yy,
        chartTitle: `Acumulado · ${MONTHS[mn]}`,
        xLabel: (v: number) => String(v),
        isCurrent, elapsed, total: daysInMonth, xDomain: [1, daysInMonth] as [number, number], xTicks: data.map((p) => p.x), mtdIngresos, mtdGastos, avgPerDay, neededPerDay, proyeccion, data, payments,
        unidad: 'día',
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
      return {
        titulo: `Año ${y}`, chartTitle: `Acumulado · ${y}`, xLabel: (v: number) => MONTHS_SHORT[v] || '',
        isCurrent: true, elapsed: m + 1, total: 12, mtdIngresos, mtdGastos, avgPerDay: avgPerMonth,
        neededPerDay: Math.max(0, meta * 12 - mtdIngresos) / Math.max(1, 11 - m), proyeccion, data, payments, xDomain: [0, 11] as [number, number], xTicks: data.map((p) => p.x), unidad: 'mes',
      };
    }

    // ----- HOY / 7 DÍAS -----
    const nDays = period === 'hoy' ? 1 : 7;
    const data = [];
    const payments: PaymentPoint[] = [];
    let cumI = 0, cumE = 0, mtdIngresos = 0, mtdGastos = 0;
    for (let i = nDays - 1; i >= 0; i--) {
      const d = new Date(y, m, today - i);
      const key = ymd(d);
      const inc = sum(ingresos, (f) => f.startsWith(key));
      const exp = sum(gastos, (f) => f.startsWith(key));
      cumI += inc; cumE += exp; mtdIngresos += inc; mtdGastos += exp;
      const dayPayments = ingresos.filter((t) => t.fecha?.startsWith(key) && isPagoCliente(t)).map((t) => ({
          x: d.getDate(), monto: t.importe || 0,
          cliente: t.terceroNombre || t.entidad || 'Cliente sin identificar',
          fecha: t.fecha, descripcion: t.descripcion,
        }));
      data.push({ x: d.getDate(), ingresos: cumI, gastos: cumE, proyeccion: null, dayPayments });
      dayPayments.forEach((p) => payments.push(p));
    }
    return {
      titulo: period === 'hoy' ? 'Hoy' : 'Últimos 7 días', chartTitle: period === 'hoy' ? 'Hoy' : 'Acumulado · 7 días',
      xLabel: (v: number) => String(v), isCurrent: false, elapsed: nDays, total: nDays,
      xDomain: [data[0]?.x || 1, data[data.length - 1]?.x || nDays] as [number, number],
      xTicks: data.map((p) => p.x),
      payments,
      mtdIngresos, mtdGastos, avgPerDay: mtdIngresos / nDays, neededPerDay: 0, proyeccion: mtdIngresos, data, unidad: 'día',
    };
  }, [period, ingresos, gastos, meta, range]);

  const metaPct = Math.min(100, Math.round((model.mtdIngresos / Math.max(1, meta)) * 100));
  const presupPct = Math.round((model.mtdGastos / Math.max(1, presupuesto)) * 100);
  const ritmoPct = model.neededPerDay > 0 ? Math.round((model.avgPerDay / model.neededPerDay - 1) * 100) : 0;
  const enLinea = model.avgPerDay >= model.neededPerDay;
  const proyVsMeta = model.proyeccion - meta;
  const showMetaCards = period === 'mes' || period === 'ano';

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
                    de meta {fmt(meta)} <button onClick={editMeta} className="inline-flex items-center text-primary hover:underline ml-1"><Pencil className="h-3 w-3" /></button>
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

      {/* Gráfica acumulada */}
      <Card>
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
                <Line type="monotone" dataKey="proyeccion" name="Proyección" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 5" dot={false} connectNulls />
                {(model.payments || []).map((pm, i) => (
                  <ReferenceDot key={i} x={pm.x} y={pm.monto} r={5} fill="#22c55e" stroke="#fff" strokeWidth={1.5} isFront />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

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
