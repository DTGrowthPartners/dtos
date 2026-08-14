import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, Loader2, Save, Sparkles, FileDown, AlertTriangle, Settings2, Mail, Files,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { authService } from '@/lib/auth';

/**
 * Sub-pestaña "Diario" de Reportes.
 *
 * El diario es INTERNO (lo lee el equipo, no el cliente): sale un solo correo a
 * Dairo con el PDF maestro —consolidado + una hoja por cliente—, no un correo
 * por cliente. Por eso aquí no hay "enviar": lo que se opera es la
 * configuración de la cuenta dentro del reporte y la regeneración de su hoja.
 *
 * **La configuración se guarda en `clientes_config.yaml`, que es la fuente de
 * verdad de los TRES reportes**: excluir una cuenta o cambiarle el nombre
 * también se lo cambia al semanal y al mensual. La pestaña lo advierte.
 */

interface PeriodoDiario { gasto: number | null; resultados: number | null; cpr: number | null }

interface FilaDiaria {
  metrica_label: string | null;
  estado: 'VERDE' | 'AMARILLO' | 'ROJO' | null;
  razon_estado: string | null;
  error_lectura: boolean;
  ayer: PeriodoDiario;
  sem_actual: PeriodoDiario;
  sem_anterior: PeriodoDiario;
  mes: PeriodoDiario;
}

interface PanelDiario {
  ok: boolean;
  ad_account_id: string;
  cliente: string;
  fecha: { fecha: string; etiqueta: string; es_vigente: boolean };
  cabecera: {
    incluido: boolean;
    estado: 'VERDE' | 'AMARILLO' | 'ROJO' | null;
    razon_estado: string | null;
    error_lectura: boolean;
    metrica_label: string | null;
    metrica_action_type: string | null;
    metrica_heredada: boolean;
    metrica_por_adset: boolean;
    generado: string | null;
    destinatario: { to: string[]; motivo: string | null; en_revision: boolean };
    pdf_cliente: boolean;
    pdf_maestro: boolean;
  };
  configuracion: {
    nombre: string | null;
    subtitulo: string | null;
    metrica_action_type: string | null;
    metrica_label: string | null;
    email: string | null;
    excluir: boolean;
    metrica_field: string | null;
    metrica_optimization_goals: string[] | null;
    defaults: { metrica_action_type: string; metrica_label: string };
  };
  reporte: FilaDiaria | null;
  acciones: { problema: string; accion: string; nivel: string }[];
  fechas_disponibles: { fecha: string; etiqueta: string; tiene_pdf: boolean; es_vigente: boolean }[];
  crons: Record<string, { linea: string | null; programado: boolean; descripcion: string }>;
}

interface Metrica { action_type: string; etiqueta: string }
interface JobDiario { id: string; estado: 'corriendo' | 'ok' | 'error'; salida?: string }

const COLOR_SEMAFORO: Record<string, string> = {
  VERDE: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
  AMARILLO: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
  ROJO: 'border-red-500/30 text-red-400 bg-red-500/10',
};

/** Valor centinela del selector: "usar el default del archivo". */
const HEREDADA = '__heredada__';

const fechaLarga = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '—';

const money = (v: number | null | undefined) =>
  v === null || v === undefined
    ? '—'
    : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

const num = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(v);

export default function ClientReportsDiario({
  adAccountId, clientName,
}: { adAccountId: string | null; clientName: string }) {
  const { toast } = useToast();
  const [panel, setPanel] = useState<PanelDiario | null>(null);
  const [metricas, setMetricas] = useState<Metrica[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fechaSel, setFechaSel] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [saving, setSaving] = useState(false);
  // Configuración editable (espejo de la entrada en clientes_config.yaml)
  const [incluido, setIncluido] = useState(true);
  const [nombre, setNombre] = useState('');
  const [subtitulo, setSubtitulo] = useState('');
  const [actionType, setActionType] = useState(HEREDADA);
  const [email, setEmail] = useState('');
  const cancelado = useRef(false);

  useEffect(() => () => { cancelado.current = true; }, []);

  const cargarPanel = useCallback(async (aid: string, fecha?: string) => {
    try {
      const q = fecha ? `?fecha=${fecha}` : '';
      const p = await apiClient.get<PanelDiario>(`/api/meta-diario/clientes/${aid}${q}`);
      setPanel(p);
      setIncluido(!p.configuracion.excluir);
      setNombre(p.configuracion.nombre || '');
      setSubtitulo(p.configuracion.subtitulo || '');
      setActionType(p.configuracion.metrica_action_type || HEREDADA);
      setEmail(p.configuracion.email || '');
    } catch {
      setPanel(null);   // cuenta no listada en el reporte, o motor caído
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!adAccountId) { setCargando(false); return; }
    cargarPanel(adAccountId);
    apiClient.get<{ metricas: Metrica[] }>('/api/meta-diario/metricas')
      .then((d) => setMetricas(d.metricas || [])).catch(() => {});
  }, [adAccountId, cargarPanel]);

  const cambiarFecha = async (fecha: string) => {
    setFechaSel(fecha);
    if (adAccountId) await cargarPanel(adAccountId, fecha);
  };

  const esperarJob = async (jobId: string): Promise<JobDiario> => {
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      if (cancelado.current) break;
      const { job } = await apiClient.get<{ job: JobDiario }>(`/api/meta-diario/jobs/${jobId}?log=1`);
      if (job.estado !== 'corriendo') return job;
    }
    throw new Error('La generación está tardando más de lo normal — revisa el log del job en el motor');
  };

  const guardar = async () => {
    if (!adAccountId || !panel) return;
    // Sacar una cuenta del reporte se lo saca a los tres: vale una confirmación.
    if (!incluido && !panel.configuracion.excluir) {
      if (!window.confirm(
        `Vas a EXCLUIR a ${clientName} del reporte de Meta.\n\n` +
        'Esa lista la comparten los tres reportes, así que también deja de aparecer ' +
        'en el semanal y en el mensual.\n\n¿Continuar?'
      )) return;
    }
    setSaving(true);
    try {
      const r = await apiClient.put<{ afecta: string[] }>(`/api/meta-diario/clientes/${adAccountId}`, {
        nombre: nombre.trim(),
        subtitulo: subtitulo.trim(),
        metrica_action_type: actionType === HEREDADA ? '' : actionType,
        email: email.trim(),
        excluir: !incluido,
      });
      await cargarPanel(adAccountId, fechaSel);
      toast({
        title: 'Configuración guardada',
        description: `Afecta a: ${(r.afecta || []).join(', ')}. Aplica desde la próxima generación.`,
      });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const generar = async () => {
    if (!adAccountId || !panel) return;
    setTrabajando(true);
    toast({ title: 'Regenerando la hoja…', description: `Consultando Meta y redactando el análisis del ${panel.fecha.etiqueta}.` });
    try {
      const { job } = await apiClient.post<{ job: JobDiario }>(
        `/api/meta-diario/clientes/${adAccountId}/generar`, { fecha: panel.fecha.fecha });
      const fin = await esperarJob(job.id);
      await cargarPanel(adAccountId, fechaSel);
      if (fin.estado === 'ok') {
        toast({ title: 'Hoja lista', description: 'Ábrela con "Ver hoja del día".' });
      } else {
        toast({ title: 'La generación falló', description: (fin.salida || '').slice(-300) || 'Revisa el log del job', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo generar', variant: 'destructive' });
    } finally {
      setTrabajando(false);
    }
  };

  /** Los PDF van con JWT, así que se descargan como blob y se abren en una pestaña. */
  const verPDF = async (ruta: 'cliente' | 'maestro') => {
    if (!panel) return;
    try {
      const token = await authService.getToken();
      const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const url = ruta === 'maestro'
        ? `${base}/api/meta-diario/maestro/pdf?fecha=${panel.fecha.fecha}`
        : `${base}/api/meta-diario/clientes/${adAccountId}/pdf?fecha=${panel.fecha.fecha}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('No se pudo abrir el PDF');
      const blob = URL.createObjectURL(await res.blob());
      window.open(blob, '_blank');
      setTimeout(() => URL.revokeObjectURL(blob), 60000);
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo abrir el PDF', variant: 'destructive' });
    }
  };

  if (cargando) {
    return <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (!adAccountId) {
    return (
      <div className="rounded-xl bg-card border border-border p-4 text-sm text-muted-foreground flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
        Este cliente no tiene cuenta de Meta enlazada (campo <span className="font-mono">metaAdAccountId</span>), que es la llave con la que se identifica en el reporte diario.
      </div>
    );
  }

  if (!panel) {
    return (
      <div className="rounded-xl bg-card border border-border p-4 text-sm text-muted-foreground flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
        La cuenta <span className="font-mono">{adAccountId}</span> no está en <span className="font-mono">clientes_config.yaml</span>, o el motor diario no responde.
      </div>
    );
  }

  const rep = panel.reporte;
  const cab = panel.cabecera;

  const filaPeriodo = (titulo: string, p: PeriodoDiario | undefined) => (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-1.5 pr-3 text-muted-foreground">{titulo}</td>
      <td className="py-1.5 pr-3 text-right tabular-nums">{money(p?.gasto)}</td>
      <td className="py-1.5 pr-3 text-right tabular-nums">{num(p?.resultados)}</td>
      <td className="py-1.5 text-right tabular-nums">{money(p?.cpr)}</td>
    </tr>
  );

  return (
    <div className="space-y-4">
      {/* Resumen del día */}
      <div className="rounded-xl bg-card border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" /> REPORTE DIARIO DE META ADS
          </h3>
          <div className="flex items-center gap-2">
            <Select value={fechaSel || panel.fecha.fecha} onValueChange={cambiarFecha}>
              <SelectTrigger className="h-7 w-[210px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {panel.fechas_disponibles.map((f) => (
                  <SelectItem key={f.fecha} value={f.fecha} className="text-xs">
                    {f.etiqueta}
                    {f.es_vigente ? ' · último' : ''}
                    {f.tiene_pdf ? '' : ' · sin hoja'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cab.estado && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${COLOR_SEMAFORO[cab.estado] || ''}`}>
                {cab.estado}
              </span>
            )}
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${cab.incluido ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-border text-muted-foreground'}`}>
              {cab.incluido ? 'EN EL REPORTE' : 'EXCLUIDA'}
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div>
            <p className="text-[11px] text-muted-foreground">Métrica principal</p>
            <p>
              {cab.metrica_label || '—'}
              {cab.metrica_heredada && <span className="text-[11px] text-muted-foreground ml-1.5">(default)</span>}
            </p>
          </div>
          <div><p className="text-[11px] text-muted-foreground">Generado</p><p>{fechaLarga(cab.generado)}</p></div>
          <div>
            <p className="text-[11px] text-muted-foreground">La hoja le llega a</p>
            <p className="truncate">{cab.destinatario.to.join(', ') || 'Nadie'}</p>
          </div>
        </div>

        {cab.razon_estado && (
          <p className="mt-3 flex items-start gap-2 text-xs text-amber-400/90">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{cab.razon_estado}
          </p>
        )}
        {cab.error_lectura && (
          <p className="mt-3 flex items-start gap-2 text-xs text-red-400">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            La lectura de esta cuenta falló ese día: las cifras pueden estar incompletas.
          </p>
        )}
        {cab.destinatario.motivo && (
          <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
            <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" />{cab.destinatario.motivo}
          </p>
        )}
        {panel.acciones.length > 0 && (
          <div className="mt-3 space-y-1">
            {panel.acciones.map((a, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{a.problema}</span> — {a.accion}
              </p>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border">
          <Button variant="outline" size="sm" onClick={generar} disabled={trabajando || !cab.incluido}>
            {trabajando ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
            {trabajando ? 'Generando…' : 'Regenerar la hoja'}
          </Button>
          {cab.pdf_cliente && (
            <Button variant="outline" size="sm" onClick={() => verPDF('cliente')} disabled={trabajando}>
              <FileDown className="h-4 w-4 mr-1.5" /> Ver hoja del día
            </Button>
          )}
          {cab.pdf_maestro && (
            <Button variant="outline" size="sm" onClick={() => verPDF('maestro')} disabled={trabajando}>
              <Files className="h-4 w-4 mr-1.5" /> Ver PDF completo del día
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Cifras que salieron al PDF */}
        <div className="rounded-xl bg-card border border-border p-4">
          <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-muted-foreground" /> Cifras del {panel.fecha.etiqueta}
          </h3>
          {rep ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted-foreground border-b border-border">
                  <th className="text-left font-normal pb-1.5">Periodo</th>
                  <th className="text-right font-normal pb-1.5">Inversión</th>
                  <th className="text-right font-normal pb-1.5">{rep.metrica_label || 'Resultados'}</th>
                  <th className="text-right font-normal pb-1.5">Costo/result.</th>
                </tr>
              </thead>
              <tbody>
                {filaPeriodo('Ayer', rep.ayer)}
                {filaPeriodo('Semana actual', rep.sem_actual)}
                {filaPeriodo('Semana anterior', rep.sem_anterior)}
                {filaPeriodo('Mes', rep.mes)}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-muted-foreground">
              Esta cuenta no aparece en el reporte de esa fecha (puede que estuviera excluida ese día, o que el reporte no se haya generado).
            </p>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            Son las cifras exactas que salieron al PDF de ese día, no una consulta nueva a Meta.
          </p>
        </div>

        {/* Configuración de la cuenta en el reporte */}
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" /> Configuración de la cuenta
            </h3>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              En el reporte <Switch checked={incluido} onCheckedChange={setIncluido} />
            </label>
          </div>

          <div className="space-y-3">
            <p className="flex items-start gap-2 text-xs text-amber-400/90">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Esta configuración la comparten los <span className="font-medium">tres reportes</span>: lo que cambies aquí también aplica al semanal y al mensual.
            </p>

            <div className="space-y-1">
              <Label className="text-xs">Nombre comercial</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-8 text-sm" />
              <p className="text-[11px] text-muted-foreground">Es el nombre que sale en el PDF, no el que tiene la cuenta en Meta.</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Métrica principal</Label>
              <Select value={actionType} onValueChange={setActionType} disabled={cab.metrica_por_adset}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={HEREDADA} className="text-xs">
                    Usar el default ({panel.configuracion.defaults.metrica_label})
                  </SelectItem>
                  {metricas.map((m) => (
                    <SelectItem key={m.action_type} value={m.action_type} className="text-xs">{m.etiqueta}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cab.metrica_por_adset && (
                <p className="text-[11px] text-amber-400/90">
                  Esta cuenta usa el mecanismo por conjuntos de anuncios (<span className="font-mono">{panel.configuracion.metrica_field}</span>), que se arma a mano en el servidor. No se edita desde aquí.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Etiqueta de la columna</Label>
              <Input value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} placeholder="Ej: Conv. WhatsApp" className="h-8 text-sm" />
              <p className="text-[11px] text-muted-foreground">Cómo se titula la métrica en la tabla del PDF.</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Correo del cliente</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Vacío = no tiene correo propio" className="h-8 text-sm" />
              <p className="text-[11px] text-muted-foreground">
                Queda guardado para cuando se apruebe el envío directo. Hoy todo va al buzón de revisión.
              </p>
            </div>

            <Button size="sm" onClick={guardar} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              Guardar
            </Button>
          </div>
        </div>
      </div>

      {/* Estado de la automatización */}
      <div className="rounded-xl bg-card border border-border p-4">
        <h3 className="text-sm font-medium mb-3">Automatización</h3>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          {Object.entries(panel.crons).map(([clave, c]) => (
            <div key={clave}>
              <p className="text-[11px] text-muted-foreground">
                {clave === 'consolidado' ? 'Consolidado' : 'Hojas por cliente + correo'}
              </p>
              <p className={c.programado ? 'text-emerald-400' : 'text-muted-foreground'}>
                {c.programado ? 'Activo' : 'Desactivado'} · {c.descripcion}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
