import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CalendarDays, Loader2, Save, Sparkles, FileDown, Send, AlertTriangle,
  MessageCircle, Instagram, History,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { authService } from '@/lib/auth';

/**
 * Sub-pestaña "Mensual" de Reportes.
 *
 * A diferencia del semanal, el mensual NO tiene configuración en AppConfig: su
 * única fuente de verdad es `envios_mensual.json` del motor
 * (/home/ubuntu/meta-monthly-report), que se lee y escribe por
 * /api/meta-mensual/*. Lo que se ve aquí es exactamente lo que usará el cron
 * del día 1 — no hay copia local que pueda quedar desincronizada.
 *
 * El enlace con el motor es `Client.metaAdAccountId` (act_…).
 */

interface ReporteMensual {
  mes: string;
  modo: string | null;
  moneda: string | null;
  periodo: { since: string; until: string } | null;
  gasto: number | null;
  alcance: number | null;
  impresiones: number | null;
  clics: number | null;
  ig_follows: number | null;
  ig_follows_origen: string | null;
  ig_usuario: string | null;
  campanas: number | null;
  avisos: string[];
  bloqueantes: string[];
  generado: string | null;
  pdf: boolean;
  pdf_nombre: string | null;
}

interface EnvioMensual {
  ts: string;
  mes: string;
  ok: boolean;
  detalle: string;
  origen: string;
  group_nombre: string | null;
}

interface PanelMensual {
  ok: boolean;
  ad_account_id: string;
  cliente: string;
  mes: { mes: string; etiqueta: string; es_vigente: boolean };
  cabecera: {
    estado: 'ACTIVO' | 'PAUSADO';
    estado_mes: string;
    motivo: string | null;
    nota: string | null;
    grupo_whatsapp: string | null;
    grupo_id: string | null;
    listo_para_enviar: boolean;
    ultimo_envio: { mes: string; ts: string; destino: string | null; origen: string } | null;
    proxima_generacion: string | null;
  };
  configuracion: {
    activo: boolean;
    motivo: string | null;
    nota: string | null;
    group_id: string | null;
    group_nombre: string | null;
    ig_follows_por_mes: Record<string, number>;
    ig_follows_mes: number | null;
  };
  reporte: ReporteMensual | null;
  comparativa: { etiqueta: string; gasto: number | null; alcance: number | null; clics: number | null } | null;
  envio_mes: EnvioMensual | null;
  meses_disponibles: { mes: string; etiqueta: string; tiene_pdf: boolean; enviado_en: string | null; es_vigente: boolean }[];
  historial: EnvioMensual[];
}

interface Grupo { id: string; nombre: string; participantes?: number }
interface JobMensual { id: string; estado: 'corriendo' | 'ok' | 'error'; salida?: string }

const ETIQUETA_ESTADO_MES: Record<string, string> = {
  pausado: 'Envío pausado',
  sin_generar: 'Sin generar',
  bloqueado: 'Generado, pero bloqueado',
  generado: 'Generado, sin enviar',
  enviado: 'Enviado',
};

/**
 * De dónde salió el número de seguidores. Importa mostrarlo porque no todos
 * significan lo mismo: `snapshot_neto` es crecimiento neto (altas menos bajas)
 * y los demás son seguidores nuevos en bruto.
 */
const ORIGEN_IG: Record<string, string> = {
  ads_manual: 'el número del Ads Manager cargado a mano (atribuido a la pauta)',
  ads_api: 'la API de anuncios (atribuido a la pauta)',
  instagram_perfil: 'Instagram Insights — seguidores nuevos del perfil, orgánico + pauta',
  snapshot_neto: 'las fotos diarias del perfil — crecimiento NETO del mes (altas menos bajas)',
};

const COLOR_ESTADO_MES: Record<string, string> = {
  pausado: 'text-muted-foreground',
  sin_generar: 'text-muted-foreground',
  bloqueado: 'text-red-400',
  generado: 'text-amber-400',
  enviado: 'text-emerald-400',
};

const fechaLarga = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

const fechaCorta = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

/** COP no lleva decimales; USD sí (Compu Xtreme factura en dólares). */
const money = (v: number | null | undefined, moneda: string | null | undefined) => {
  if (v === null || v === undefined) return '—';
  const cop = (moneda || 'COP') === 'COP';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: moneda || 'COP',
    minimumFractionDigits: cop ? 0 : 2, maximumFractionDigits: cop ? 0 : 2,
  }).format(v);
};

const num = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : new Intl.NumberFormat('es-CO').format(v);

const delta = (v: number | null | undefined) => {
  if (v === null || v === undefined) return null;
  const signo = v > 0 ? '+' : '';
  return `${signo}${v.toFixed(0)}%`;
};

export default function ClientReportsMensual({
  adAccountId, clientName,
}: { adAccountId: string | null; clientName: string }) {
  const { toast } = useToast();
  const [panel, setPanel] = useState<PanelMensual | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mesSel, setMesSel] = useState('');
  const [trabajando, setTrabajando] = useState<'' | 'generar' | 'envio'>('');
  const [saving, setSaving] = useState(false);
  // Configuración editable (espejo del bloque del cliente en envios_mensual.json)
  const [activo, setActivo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  const [igFollows, setIgFollows] = useState('');
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [buscaGrupo, setBuscaGrupo] = useState('');
  const [buscandoGrupos, setBuscandoGrupos] = useState(false);
  const [grupo, setGrupo] = useState<{ id: string; nombre: string } | null>(null);
  const cancelado = useRef(false);

  useEffect(() => () => { cancelado.current = true; }, []);

  const cargarPanel = useCallback(async (aid: string, mes?: string) => {
    try {
      const q = mes ? `?mes=${mes}` : '';
      const p = await apiClient.get<PanelMensual>(`/api/meta-mensual/clientes/${aid}${q}`);
      setPanel(p);
      setActivo(p.configuracion.activo);
      setMotivo(p.configuracion.motivo || '');
      setNota(p.configuracion.nota || '');
      setIgFollows(p.configuracion.ig_follows_mes ? String(p.configuracion.ig_follows_mes) : '');
      setGrupo(p.configuracion.group_id ? { id: p.configuracion.group_id, nombre: p.configuracion.group_nombre || p.configuracion.group_id } : null);
    } catch {
      setPanel(null);   // cuenta no listada en el reporte, o motor caído
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!adAccountId) { setCargando(false); return; }
    cargarPanel(adAccountId);
  }, [adAccountId, cargarPanel]);

  const cambiarMes = async (mes: string) => {
    setMesSel(mes);
    if (adAccountId) await cargarPanel(adAccountId, mes);
  };

  /** Espera a que termine la corrida del motor (~40 s por cuenta). */
  const esperarJob = async (jobId: string): Promise<JobMensual> => {
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      if (cancelado.current) break;
      const { job } = await apiClient.get<{ job: JobMensual }>(`/api/meta-mensual/jobs/${jobId}?log=1`);
      if (job.estado !== 'corriendo') return job;
    }
    throw new Error('La generación está tardando más de lo normal — revisa el log del job en el motor');
  };

  const guardar = async () => {
    if (!adAccountId) return;
    setSaving(true);
    try {
      await apiClient.put(`/api/meta-mensual/clientes/${adAccountId}`, {
        activo, motivo: motivo.trim(), nota: nota.trim(),
      });
      await apiClient.put(`/api/meta-mensual/clientes/${adAccountId}/whatsapp`, {
        group_id: grupo?.id || '', group_nombre: grupo?.nombre || '',
      });
      await cargarPanel(adAccountId, mesSel);
      toast({ title: 'Guardado', description: 'El cron del día 1 ya usa esta configuración.' });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const guardarIg = async () => {
    if (!adAccountId || !panel) return;
    setSaving(true);
    try {
      const limpio = igFollows.replace(/[^\d]/g, '');
      await apiClient.put(`/api/meta-mensual/clientes/${adAccountId}/ig-follows`, {
        mes: panel.mes.mes, valor: limpio ? Number(limpio) : null,
      });
      await cargarPanel(adAccountId, mesSel);
      toast({
        title: limpio ? 'Seguidores guardados' : 'Dato borrado',
        description: limpio
          ? `Se usarán al generar ${panel.mes.etiqueta}. Si ya generaste, vuelve a generar.`
          : 'El informe volverá a usar lo que dé la API de Instagram.',
      });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const buscarGrupos = async (texto: string) => {
    setBuscaGrupo(texto);
    if (texto.trim().length < 3) { setGrupos([]); return; }
    setBuscandoGrupos(true);
    try {
      const r = await apiClient.get<{ ok: boolean; grupos: Grupo[]; error?: string }>(
        `/api/meta-mensual/grupos-whatsapp?buscar=${encodeURIComponent(texto.trim())}&limite=25`);
      setGrupos(r.grupos || []);
      if (!r.ok && r.error) toast({ title: 'No se pudieron listar los grupos', description: r.error, variant: 'destructive' });
    } catch {
      setGrupos([]);
    } finally {
      setBuscandoGrupos(false);
    }
  };

  const generar = async () => {
    if (!adAccountId || !panel) return;
    setTrabajando('generar');
    toast({ title: 'Generando informe…', description: `Consultando Meta para ${panel.mes.etiqueta}. Tarda entre 30 s y 1 minuto.` });
    try {
      const { job } = await apiClient.post<{ job: JobMensual }>(
        `/api/meta-mensual/clientes/${adAccountId}/generar`, { mes: panel.mes.mes });
      const fin = await esperarJob(job.id);
      await cargarPanel(adAccountId, mesSel);
      if (fin.estado === 'ok') {
        toast({ title: 'Informe listo', description: 'Ábrelo con "Ver PDF" antes de enviarlo.' });
      } else {
        toast({ title: 'La generación falló', description: (fin.salida || '').slice(-300) || 'Revisa el log del job', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo generar', variant: 'destructive' });
    } finally {
      setTrabajando('');
    }
  };

  /** El PDF va con JWT, así que se descarga como blob y se abre en una pestaña. */
  const verPDF = async () => {
    if (!adAccountId || !panel) return;
    try {
      const token = await authService.getToken();
      const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${base}/api/meta-mensual/clientes/${adAccountId}/pdf?mes=${panel.mes.mes}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('No se pudo abrir el PDF');
      const url = URL.createObjectURL(await res.blob());
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo abrir el PDF', variant: 'destructive' });
    }
  };

  const enviar = async () => {
    if (!adAccountId || !panel) return;
    const destino = panel.cabecera.grupo_whatsapp || panel.cabecera.grupo_id;
    if (!window.confirm(
      `Se enviará el informe de ${panel.mes.etiqueta} de ${clientName} al grupo de WhatsApp:\n\n${destino}\n\n¿Continuar?`
    )) return;
    setTrabajando('envio');
    try {
      const { job } = await apiClient.post<{ job: JobMensual }>(
        `/api/meta-mensual/clientes/${adAccountId}/enviar`, { mes: panel.mes.mes });
      const fin = await esperarJob(job.id);
      await cargarPanel(adAccountId, mesSel);
      if (fin.estado === 'ok') {
        toast({ title: 'Informe enviado', description: `A ${destino}` });
      } else {
        toast({ title: 'El envío falló', description: (fin.salida || '').slice(-300) || 'Revisa el log del job', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'No se pudo enviar', description: e instanceof Error ? e.message : 'Error desconocido', variant: 'destructive' });
    } finally {
      setTrabajando('');
    }
  };

  if (cargando) {
    return <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (!adAccountId) {
    return (
      <div className="rounded-xl bg-card border border-border p-4 text-sm text-muted-foreground flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
        Este cliente no tiene cuenta de Meta enlazada (campo <span className="font-mono">metaAdAccountId</span>), que es la llave con la que el motor del informe mensual identifica al cliente.
      </div>
    );
  }

  if (!panel) {
    return (
      <div className="rounded-xl bg-card border border-border p-4 text-sm text-muted-foreground flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
        La cuenta <span className="font-mono">{adAccountId}</span> no está en la lista del reporte de Meta (clientes_config.yaml), o el motor mensual no responde.
      </div>
    );
  }

  const rep = panel.reporte;
  const estadoMes = panel.cabecera.estado_mes;
  const proxima = fechaLarga(panel.cabecera.proxima_generacion);
  const ultimo = panel.cabecera.ultimo_envio;

  return (
    <div className="space-y-4">
      {/* Tarjeta resumen del mes */}
      <div className="rounded-xl bg-card border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" /> INFORME MENSUAL DE META ADS
          </h3>
          <div className="flex items-center gap-2">
            <Select value={mesSel || panel.mes.mes} onValueChange={cambiarMes}>
              <SelectTrigger className="h-7 w-[200px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {panel.meses_disponibles.map((m) => (
                  <SelectItem key={m.mes} value={m.mes} className="text-xs capitalize">
                    {m.etiqueta}
                    {m.es_vigente ? ' · actual' : ''}
                    {m.enviado_en ? ' · enviado' : m.tiene_pdf ? ' · generado' : ' · sin generar'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${activo ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-border text-muted-foreground'}`}>
              {activo ? 'ACTIVO' : 'PAUSADO'}
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div>
            <p className="text-[11px] text-muted-foreground">Estado del mes</p>
            <p className={COLOR_ESTADO_MES[estadoMes] || ''}>{ETIQUETA_ESTADO_MES[estadoMes] || estadoMes}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Inversión del mes</p>
            <p>
              {money(rep?.gasto, rep?.moneda)}
              {panel.comparativa?.gasto !== null && panel.comparativa?.gasto !== undefined && (
                <span className="text-[11px] text-muted-foreground ml-1.5">
                  {delta(panel.comparativa.gasto)} vs {panel.comparativa.etiqueta}
                </span>
              )}
            </p>
          </div>
          <div><p className="text-[11px] text-muted-foreground">Modo del informe</p><p className="capitalize">{rep?.modo || '—'}</p></div>
          <div><p className="text-[11px] text-muted-foreground">Grupo de WhatsApp</p><p>{panel.cabecera.grupo_whatsapp || 'Sin grupo'}</p></div>
          <div><p className="text-[11px] text-muted-foreground">Próxima generación</p><p>{activo ? (proxima || '—') : '—'}</p></div>
          <div>
            <p className="text-[11px] text-muted-foreground">Último envío</p>
            <p>{ultimo ? `${fechaCorta(ultimo.ts)} · ${ultimo.mes}${ultimo.origen === 'cron' ? ' (automático)' : ''}` : 'Aún no se ha enviado'}</p>
          </div>
        </div>

        {/* Freno de seguridad del motor: con bloqueantes, enviar.py NO manda nada */}
        {rep?.bloqueantes?.length ? (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="flex items-center gap-2 text-xs font-medium text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> El informe está bloqueado: no se enviará al cliente
            </p>
            <ul className="mt-1.5 ml-5 list-disc text-xs text-red-400/90 space-y-0.5">
              {rep.bloqueantes.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          </div>
        ) : null}

        {rep?.avisos?.length ? (
          <ul className="mt-3 space-y-1">
            {rep.avisos.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-amber-400/90">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{a}
              </li>
            ))}
          </ul>
        ) : null}

        {!panel.mes.es_vigente && (
          <p className="mt-3 text-xs text-muted-foreground">
            Estás viendo un mes pasado. Los botones actúan sobre <span className="font-medium capitalize">{panel.mes.etiqueta}</span>.
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border">
          <Button variant="outline" size="sm" onClick={generar} disabled={trabajando !== ''}>
            {trabajando === 'generar' ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
            {trabajando === 'generar' ? 'Generando…' : rep ? 'Regenerar informe' : 'Generar informe'}
          </Button>
          {rep?.pdf && (
            <Button variant="outline" size="sm" onClick={verPDF} disabled={trabajando !== ''}>
              <FileDown className="h-4 w-4 mr-1.5" /> Ver PDF
            </Button>
          )}
          {panel.cabecera.listo_para_enviar && (
            <Button size="sm" onClick={enviar} disabled={trabajando !== ''}>
              {trabajando === 'envio' ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
              {trabajando === 'envio' ? 'Enviando…' : panel.envio_mes ? 'Reenviar al grupo' : 'Enviar al grupo'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Configuración del envío mensual */}
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-muted-foreground" /> Envío al cliente
            </h3>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              Envío activo <Switch checked={activo} onCheckedChange={setActivo} />
            </label>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              El informe mensual va a un <span className="font-medium">grupo de WhatsApp</span>, no por correo. Con el envío pausado el cron del día 1 genera igual, pero no manda nada.
            </p>

            <div className="space-y-1">
              <Label className="text-xs">Grupo destino</Label>
              {grupo ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <span className="truncate">{grupo.nombre}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs shrink-0" onClick={() => { setGrupo(null); setGrupos([]); setBuscaGrupo(''); }}>
                    Cambiar
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    value={buscaGrupo}
                    onChange={(e) => buscarGrupos(e.target.value)}
                    placeholder="Buscar grupo por nombre (mínimo 3 letras)…"
                    className="h-8 text-sm"
                  />
                  {buscandoGrupos && <p className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Buscando…</p>}
                  {grupos.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-md border border-border divide-y divide-border">
                      {grupos.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => { setGrupo({ id: g.id, nombre: g.nombre }); setGrupos([]); setBuscaGrupo(''); }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50"
                        >
                          {g.nombre}
                          {g.participantes ? <span className="text-muted-foreground"> · {g.participantes} participantes</span> : null}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {!activo && (
              <div className="space-y-1">
                <Label className="text-xs">Motivo de la pausa</Label>
                <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por qué no se le envía" className="h-8 text-sm" />
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Nota interna</Label>
              <Textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} placeholder="Queda en la configuración del motor, no sale en el PDF" className="text-sm" />
            </div>

            <Button size="sm" onClick={guardar} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              Guardar
            </Button>
          </div>
        </div>

        {/* Datos del mes + el dato manual de Instagram */}
        <div className="rounded-xl bg-card border border-border p-4">
          <h3 className="text-sm font-medium flex items-center gap-2 mb-4">
            <Instagram className="h-4 w-4 text-muted-foreground" /> Datos de <span className="capitalize">{panel.mes.etiqueta}</span>
          </h3>

          {rep ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mb-4">
              <div><p className="text-[11px] text-muted-foreground">Alcance</p><p>{num(rep.alcance)}</p></div>
              <div><p className="text-[11px] text-muted-foreground">Impresiones</p><p>{num(rep.impresiones)}</p></div>
              <div><p className="text-[11px] text-muted-foreground">Clics en el enlace</p><p>{num(rep.clics)}</p></div>
              <div><p className="text-[11px] text-muted-foreground">Campañas</p><p>{num(rep.campanas)}</p></div>
              <div>
                <p className="text-[11px] text-muted-foreground">Seguidores IG</p>
                <p>{num(rep.ig_follows)}{rep.ig_usuario ? <span className="text-[11px] text-muted-foreground"> · @{rep.ig_usuario}</span> : null}</p>
              </div>
              <div><p className="text-[11px] text-muted-foreground">Generado</p><p>{fechaCorta(rep.generado)}</p></div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mb-4">
              Todavía no se ha generado el informe de este mes. Los datos aparecen aquí después de generarlo.
            </p>
          )}

          <div className="space-y-2 pt-3 border-t border-border">
            <Label className="text-xs">Seguidores de Instagram del mes (opcional)</Label>
            <p className="text-[11px] text-muted-foreground">
              Normalmente se calcula solo. Esto es para forzar el número del Ads Manager (seguimientos atribuidos a la pauta), que Meta no expone por API: si lo pones, manda sobre todo lo demás. Se guarda por mes, no arrastra al siguiente.
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={igFollows}
                onChange={(e) => setIgFollows(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="Vacío = lo calcula el motor"
                className="h-8 text-sm w-48"
                inputMode="numeric"
              />
              <Button variant="outline" size="sm" onClick={guardarIg} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                Guardar
              </Button>
            </div>
            {rep?.ig_follows_origen && (
              <p className="text-[11px] text-muted-foreground">
                En el informe generado el dato salió de:{' '}
                <span className="font-medium">{ORIGEN_IG[rep.ig_follows_origen] || rep.ig_follows_origen}</span>.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Historial de envíos: incluye los del cron del día 1 */}
      <div className="rounded-xl bg-card border border-border p-4">
        <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
          <History className="h-4 w-4 text-muted-foreground" /> Historial de envíos
        </h3>
        {panel.historial.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin envíos registrados todavía.</p>
        ) : (
          <div className="space-y-1.5">
            {panel.historial.map((h, i) => (
              <div key={i} className="flex items-start justify-between gap-3 text-xs border-b border-border/50 pb-1.5 last:border-0">
                <div className="min-w-0">
                  <span className={h.ok ? 'text-emerald-400' : 'text-red-400'}>{h.ok ? '✓' : '✗'}</span>{' '}
                  <span className="font-medium">{h.mes}</span>{' '}
                  <span className="text-muted-foreground truncate">{h.detalle}</span>
                </div>
                <span className="text-muted-foreground shrink-0">
                  {fechaCorta(h.ts)}
                  {h.origen === 'cron' ? ' · automático'
                    : h.origen === 'api' ? ' · desde DTOS'
                    // Envío hecho a mano antes de que existiera el historial:
                    // la hora es aproximada, conviene que se note.
                    : h.origen === 'backfill' ? ' · registrado después'
                    : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
