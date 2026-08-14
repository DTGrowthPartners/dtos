import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, CalendarDays, CalendarRange, FileDown, Files, Loader2, RefreshCw,
  AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { authService } from '@/lib/auth';
import { cn } from '@/lib/utils';

/**
 * Vista de conjunto de los TRES reportes de Meta Ads.
 *
 * Cada uno corre sobre su propio motor en el VPS y se consume por su proxy:
 *   · Diario  → /api/meta-diario/*   (interno; un PDF maestro al equipo)
 *   · Semanal → /api/meta-semanal/*  (al cliente: correo o grupo de WhatsApp)
 *   · Mensual → /api/meta-mensual/*  (al cliente: grupo de WhatsApp)
 *
 * Lo que aquí se unifica es solo la PRESENTACIÓN: cada portafolio se normaliza
 * a la misma fila (`Fila`) y se pinta en la misma tabla. Generar, aprobar y
 * enviar siguen viviendo en la pestaña Reportes de cada cliente, que es donde
 * está el contexto para decidirlo.
 */

type Tipo = 'diario' | 'semanal' | 'mensual';
type Tono = 'verde' | 'ambar' | 'rojo' | 'neutro';

interface Periodo { valor: string; etiqueta: string; es_vigente?: boolean }

interface Fila {
  key: string;
  cliente: string;
  estado: string;
  tono: Tono;
  detalle: string | null;
  inversion: number | null;
  moneda: string;
  resultados: number | null;
  metrica: string | null;
  destino: string | null;
  enviadoEn: string | null;
  tienePdf: boolean;
  /** Ruta del PDF ya con su parámetro de periodo. */
  pdfPath: string | null;
}

interface Vista {
  periodos: Periodo[];
  periodoActual: string;
  filas: Fila[];
  /** PDF que agrupa todo el periodo, si el motor genera uno (hoy solo el diario). */
  pdfGlobal: { path: string; etiqueta: string } | null;
  cron: { programado: boolean; descripcion: string }[];
  nota: string | null;
}

const TIPOS: { id: Tipo; nombre: string; icono: typeof Activity; resumen: string }[] = [
  { id: 'diario', nombre: 'Diario', icono: Activity, resumen: 'Interno · todos los días 7:55 AM' },
  { id: 'semanal', nombre: 'Semanal', icono: CalendarRange, resumen: 'Al cliente · lunes 8:00 AM' },
  { id: 'mensual', nombre: 'Mensual', icono: CalendarDays, resumen: 'Al cliente · día 1, 9:00 AM' },
];

const COLOR_TONO: Record<Tono, string> = {
  verde: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
  ambar: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
  rojo: 'border-red-500/30 text-red-400 bg-red-500/10',
  neutro: 'border-border text-muted-foreground',
};

const money = (v: number | null, moneda = 'COP') => {
  if (v === null || v === undefined) return '—';
  const cop = moneda === 'COP';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: moneda,
    minimumFractionDigits: cop ? 0 : 2, maximumFractionDigits: cop ? 0 : 2,
  }).format(v);
};

const num = (v: number | null) =>
  v === null || v === undefined ? '—' : new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(v);

const fechaCorta = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;

// ============================================================
// Adaptadores: cada portafolio → la misma fila
// ============================================================
const ESTADO_MENSUAL: Record<string, { label: string; tono: Tono }> = {
  enviado: { label: 'Enviado', tono: 'verde' },
  generado: { label: 'Generado, sin enviar', tono: 'ambar' },
  bloqueado: { label: 'Bloqueado', tono: 'rojo' },
  pausado: { label: 'Envío pausado', tono: 'neutro' },
  sin_generar: { label: 'Sin generar', tono: 'neutro' },
};

const desdeDiario = (d: any, fecha: string): Fila[] =>
  (d.clientes || []).map((c: any) => ({
    key: c.ad_account_id,
    cliente: c.cliente,
    estado: c.incluido ? (c.estado || 'Sin datos') : 'Excluida',
    tono: (!c.incluido
      ? 'neutro'
      : c.estado === 'VERDE' ? 'verde' : c.estado === 'AMARILLO' ? 'ambar' : c.estado === 'ROJO' ? 'rojo' : 'neutro') as Tono,
    detalle: c.razon_estado || null,
    inversion: c.gasto_ayer,
    moneda: 'COP',
    resultados: c.resultados_ayer,
    metrica: c.metrica_label,
    // El diario no se envía por cliente: sale UN correo con el PDF completo.
    destino: null,
    enviadoEn: null,
    tienePdf: !!c.en_reporte,
    pdfPath: c.en_reporte ? `/api/meta-diario/clientes/${c.ad_account_id}/pdf?fecha=${fecha}` : null,
  }));

const desdeSemanal = (d: any, semana: string): Fila[] =>
  (d.clientes || []).map((c: any) => {
    const enviado = !!c.envio?.enviado;
    return {
      key: c.ad_account_id || c.slug,
      cliente: c.cliente,
      estado: enviado ? 'Enviado' : c.archivos?.pdf ? 'Generado, sin enviar' : 'Sin generar',
      tono: (enviado ? 'verde' : c.archivos?.pdf ? 'ambar' : 'neutro') as Tono,
      detalle: enviado ? null : c.envio?.motivo || null,
      inversion: c.semana?.gasto ?? null,
      moneda: c.moneda || 'COP',
      resultados: c.semana?.resultados ?? null,
      metrica: c.metrica_label,
      destino: (c.envio?.destinatarios || []).join(', ') || null,
      enviadoEn: c.envio?.ultimo_envio || null,
      tienePdf: !!c.archivos?.pdf,
      pdfPath: c.archivos?.pdf
        ? `/api/meta-semanal/reportes/${encodeURIComponent(c.slug)}/pdf?semana=${semana}`
        : null,
    };
  });

const desdeMensual = (d: any, mes: string): Fila[] =>
  (d.clientes || []).map((c: any) => {
    const est = ESTADO_MENSUAL[c.estado] || { label: c.estado, tono: 'neutro' as Tono };
    return {
      key: c.ad_account_id,
      cliente: c.cliente,
      estado: est.label,
      tono: est.tono,
      detalle: c.bloqueantes?.[0] || c.motivo || null,
      inversion: c.gasto,
      moneda: c.moneda || 'COP',
      resultados: null,
      metrica: c.modo ? `Modo ${c.modo}` : null,
      destino: c.grupo_whatsapp,
      enviadoEn: c.enviado_en,
      tienePdf: !!c.pdf,
      pdfPath: c.pdf ? `/api/meta-mensual/clientes/${c.ad_account_id}/pdf?mes=${mes}` : null,
    };
  });

export default function Reportes() {
  const { toast } = useToast();
  const [tipo, setTipo] = useState<Tipo>('semanal');
  // El periodo elegido se recuerda por tipo: si miras una semana vieja y saltas
  // a mensual, al volver sigues en la misma semana.
  const [periodo, setPeriodo] = useState<Record<Tipo, string>>({ diario: '', semanal: '', mensual: '' });
  const [vista, setVista] = useState<Vista | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (t: Tipo, sel: string) => {
    setCargando(true);
    setError(null);
    try {
      if (t === 'diario') {
        const [fechas, cron] = await Promise.all([
          apiClient.get<any>('/api/meta-diario/fechas'),
          apiClient.get<any>('/api/meta-diario/cron').catch(() => null),
        ]);
        const actual = sel || fechas.vigente;
        const p = await apiClient.get<any>(`/api/meta-diario/portafolio?fecha=${actual}`);
        setVista({
          periodos: (fechas.fechas || []).map((f: any) => ({
            valor: f.fecha, etiqueta: f.etiqueta, es_vigente: f.fecha === fechas.vigente,
          })),
          periodoActual: actual,
          filas: desdeDiario(p, actual),
          pdfGlobal: p.hay_snapshot
            ? { path: `/api/meta-diario/maestro/pdf?fecha=${actual}`, etiqueta: 'PDF completo del día' }
            : null,
          cron: cron
            ? [
                { programado: !!cron.consolidado?.programado, descripcion: cron.consolidado?.descripcion },
                { programado: !!cron.hojas_y_correo?.programado, descripcion: cron.hojas_y_correo?.descripcion },
              ]
            : [],
          nota: 'El diario es interno: no se envía por cliente, sale un solo correo con el PDF completo.',
        });
      } else if (t === 'semanal') {
        const [semanas, cron] = await Promise.all([
          apiClient.get<any>('/api/meta-semanal/semanas'),
          apiClient.get<any>('/api/meta-semanal/cron').catch(() => null),
        ]);
        const actual = sel || semanas.semana_vigente;
        const p = await apiClient.get<any>(`/api/meta-semanal/portafolio?semana=${actual}`);
        setVista({
          periodos: (semanas.semanas || []).map((s: any) => ({
            valor: s.semana,
            etiqueta: `${s.etiqueta}${s.enviados ? ` · ${s.enviados} enviados` : ''}`,
            es_vigente: s.semana === semanas.semana_vigente,
          })),
          periodoActual: actual,
          filas: desdeSemanal(p, actual),
          pdfGlobal: null,
          cron: cron ? [{ programado: !!cron.programado, descripcion: cron.descripcion }] : [],
          nota: null,
        });
      } else {
        const [meses, cron] = await Promise.all([
          apiClient.get<any>('/api/meta-mensual/meses'),
          apiClient.get<any>('/api/meta-mensual/cron').catch(() => null),
        ]);
        const actual = sel || meses.vigente;
        const p = await apiClient.get<any>(`/api/meta-mensual/portafolio?mes=${actual}`);
        setVista({
          periodos: (meses.meses || []).map((m: any) => ({
            valor: m.mes, etiqueta: m.etiqueta, es_vigente: m.mes === meses.vigente,
          })),
          periodoActual: actual,
          filas: desdeMensual(p, actual),
          pdfGlobal: null,
          cron: cron ? [{ programado: !!cron.programado, descripcion: cron.descripcion }] : [],
          nota: null,
        });
      }
    } catch (e) {
      setVista(null);
      setError(e instanceof Error ? e.message : 'No se pudo cargar el reporte');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(tipo, periodo[tipo]); }, [tipo, periodo, cargar]);

  const cambiarPeriodo = (valor: string) => setPeriodo((p) => ({ ...p, [tipo]: valor }));

  /** Los PDF van con JWT, así que se descargan como blob y se abren en una pestaña. */
  const verPDF = async (path: string) => {
    try {
      const token = await authService.getToken();
      const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('No se pudo abrir el PDF');
      const url = URL.createObjectURL(await res.blob());
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo abrir el PDF', variant: 'destructive' });
    }
  };

  const resumen = useMemo(() => {
    const filas = vista?.filas || [];
    // Los totales van por moneda: sumar COP con USD (Compu Xtreme) daría un
    // número sin sentido.
    const porMoneda: Record<string, number> = {};
    for (const f of filas) {
      if (f.inversion) porMoneda[f.moneda] = (porMoneda[f.moneda] || 0) + f.inversion;
    }
    return {
      total: filas.length,
      conPdf: filas.filter((f) => f.tienePdf).length,
      enviados: filas.filter((f) => f.enviadoEn).length,
      pendientes: filas.filter((f) => f.tienePdf && !f.enviadoEn).length,
      porMoneda,
    };
  }, [vista]);

  const muestraEnvio = tipo !== 'diario';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reportes de Meta Ads</h1>
          <p className="text-muted-foreground">
            Estado de los tres reportes y acceso a los PDF de periodos anteriores.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => cargar(tipo, periodo[tipo])} disabled={cargando}>
          <RefreshCw className={cn('h-4 w-4 mr-1.5', cargando && 'animate-spin')} /> Actualizar
        </Button>
      </div>

      {/* Selector de reporte */}
      <div className="grid md:grid-cols-3 gap-3">
        {TIPOS.map((t) => {
          const Icono = t.icono;
          const activo = tipo === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTipo(t.id)}
              className={cn(
                'rounded-xl border p-4 text-left transition-colors',
                activo ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-muted-foreground/30',
              )}
            >
              <div className="flex items-center gap-2">
                <Icono className={cn('h-4 w-4', activo ? 'text-primary' : 'text-muted-foreground')} />
                <span className="font-medium">{t.nombre}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t.resumen}</p>
            </button>
          );
        })}
      </div>

      {cargando && !vista && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-card border border-border p-4 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
          <span>No se pudo cargar el reporte {tipo}: {error}</span>
        </div>
      )}

      {vista && (
        <>
          {/* Periodo + resumen */}
          <div className="rounded-xl bg-card border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Select value={vista.periodoActual} onValueChange={cambiarPeriodo}>
                  <SelectTrigger className="h-8 w-[260px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {vista.periodos.map((p) => (
                      <SelectItem key={p.valor} value={p.valor} className="text-xs capitalize">
                        {p.etiqueta}{p.es_vigente ? ' · actual' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {cargando && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {vista.pdfGlobal && (
                <Button variant="outline" size="sm" onClick={() => verPDF(vista.pdfGlobal!.path)}>
                  <Files className="h-4 w-4 mr-1.5" /> {vista.pdfGlobal.etiqueta}
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-[11px] text-muted-foreground">Cuentas</p>
                <p>{resumen.total}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Con reporte generado</p>
                <p>{resumen.conPdf} de {resumen.total}</p>
              </div>
              {muestraEnvio ? (
                <div>
                  <p className="text-[11px] text-muted-foreground">Enviados</p>
                  <p className={resumen.pendientes ? 'text-amber-400' : ''}>
                    {resumen.enviados}
                    {resumen.pendientes ? ` · ${resumen.pendientes} sin enviar` : ''}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-[11px] text-muted-foreground">Entrega</p>
                  <p>Un solo correo interno</p>
                </div>
              )}
              <div>
                <p className="text-[11px] text-muted-foreground">Inversión del periodo</p>
                <p>
                  {Object.keys(resumen.porMoneda).length === 0
                    ? '—'
                    : Object.entries(resumen.porMoneda).map(([m, v]) => money(v, m)).join(' · ')}
                </p>
              </div>
            </div>

            {(vista.cron.length > 0 || vista.nota) && (
              <div className="mt-3 pt-3 border-t border-border space-y-1">
                {vista.cron.map((c, i) => (
                  <p key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    {c.programado
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      : <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                    {c.programado ? 'Automático' : 'Automatización desactivada'} · {c.descripcion}
                  </p>
                ))}
                {vista.nota && <p className="text-xs text-muted-foreground">{vista.nota}</p>}
              </div>
            )}
          </div>

          {/* Tabla de clientes */}
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="text-[11px] text-muted-foreground border-b border-border">
                    <th className="text-left font-normal px-4 py-2">Cliente</th>
                    <th className="text-left font-normal px-4 py-2">Estado</th>
                    <th className="text-right font-normal px-4 py-2">Inversión</th>
                    <th className="text-right font-normal px-4 py-2">Resultados</th>
                    {muestraEnvio && <th className="text-left font-normal px-4 py-2">Enviado a</th>}
                    <th className="text-right font-normal px-4 py-2">Reporte</th>
                  </tr>
                </thead>
                <tbody>
                  {vista.filas.map((f) => (
                    <tr key={f.key} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <p className="font-medium">{f.cliente}</p>
                        {f.metrica && <p className="text-[11px] text-muted-foreground">{f.metrica}</p>}
                      </td>
                      <td className="px-4 py-2">
                        <span className={cn('text-[11px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap', COLOR_TONO[f.tono])}>
                          {f.estado}
                        </span>
                        {f.detalle && (
                          <p className="text-[11px] text-muted-foreground mt-1 max-w-[280px] truncate" title={f.detalle}>
                            {f.detalle}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{money(f.inversion, f.moneda)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{num(f.resultados)}</td>
                      {muestraEnvio && (
                        <td className="px-4 py-2">
                          {f.enviadoEn ? (
                            <>
                              <p className="text-xs truncate max-w-[220px]" title={f.destino || ''}>{f.destino || '—'}</p>
                              <p className="text-[11px] text-muted-foreground">{fechaCorta(f.enviadoEn)}</p>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">{f.destino || 'Sin enviar'}</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-2 text-right">
                        {f.pdfPath ? (
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => verPDF(f.pdfPath!)}>
                            <FileDown className="h-3.5 w-3.5 mr-1" /> Ver PDF
                          </Button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Para generar, aprobar o enviar un reporte, entra al cliente → pestaña <span className="font-medium">Reportes</span>.
          </p>
        </>
      )}
    </div>
  );
}
