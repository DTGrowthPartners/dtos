import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileBarChart, Settings2, Users, Loader2, Save, Sparkles, FileDown, Send, AlertTriangle, MessageCircle, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { authService } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { estrategiaKey, type EstrategiaConfig } from './ClientStrategy';
import ClientReportsMensual from './ClientReportsMensual';
import ClientReportsDiario from './ClientReportsDiario';

/**
 * Configuración y operación del reporte de Meta Ads del cliente.
 *
 * La configuración vive en AppConfig (`reportes_<clientId>`) y ADEMÁS se
 * sincroniza con el motor del reporte semanal (/api/meta-semanal/*, que corre
 * sobre /home/ubuntu/meta-weekly-report). Esa sincronización es la que hace que
 * el cron de los lunes respete lo que se marca aquí: cliente pausado, modo de
 * envío y destinatarios.
 *
 * El enlace con el motor es `Client.metaAdAccountId` (act_…). Sin esa cuenta
 * enlazada la pestaña sigue guardando la configuración, pero no puede generar
 * ni enviar nada.
 *
 * Las otras dos sub-pestañas son motores DISTINTOS, cada uno con su PDF, su
 * cron y su configuración — no son tres vistas del mismo reporte:
 *   · Diario  → /home/ubuntu/meta-daily-report,   /api/meta-diario/*  (interno)
 *   · Mensual → /home/ubuntu/meta-monthly-report, /api/meta-mensual/* (al grupo)
 * Lo único que comparten es el `metaAdAccountId` y `clientes_config.yaml`, que
 * vive en el proyecto diario y es la lista de clientes de los tres.
 */

interface DestinatarioPrefs { semanal: boolean; mensual: boolean; correo: boolean; whatsapp: boolean; alertas: boolean }
interface ReportesConfig {
  activo: boolean;
  tipo: string;
  frecuencia: 'semanal' | 'quincenal' | 'mensual';
  periodo: string;
  dia: string;
  hora: string;
  plantilla: string;
  compararSemanaAnterior: boolean;
  compararMeta: boolean;
  compararPresupuesto: boolean;
  modoEnvio: 'auto' | 'aprobacion';
  responsable: string;
  destinatarios: Record<string, DestinatarioPrefs>;
  ultimoEnvio?: string;
}
interface Contacto { id: string; nombre: string; cargo?: string | null; email?: string | null; telefono?: string | null }

interface SemanaDisponible {
  semana: string; hasta: string; etiqueta: string; estado: string;
  tiene_pdf: boolean; enviado_en: string | null; es_vigente: boolean;
}
interface PanelSemanal {
  cliente: string;
  semana: { desde: string; hasta: string; etiqueta: string };
  semanas_disponibles: SemanaDisponible[];
  cabecera: {
    estado: string;
    destinatarios_efectivos: string[];
    motivo_destinatarios: string;
    grupo_whatsapp: string | null;
    proxima_generacion: string | null;
    ultimo_reporte: { estado: string; generado: string | null; enviado_en: string | null; enviado_a: string[] | null };
    puede_aprobar: boolean;
    puede_enviar: boolean;
  };
  configuracion: {
    modo_global: string;
    buzon_revision: string;
    whatsapp?: { activo?: boolean; group_id?: string | null; group_nombre?: string | null };
    revision?: { activo?: boolean; email?: string | null };
    metas?: { presupuesto_mensual?: number | null; objetivo?: string | null; kpi?: string | null };
    emails_sueltos?: string[];
  };
  archivos: { pdf: boolean; html: boolean; slug: string };
  reporte: { semana: Record<string, number | null>; moneda: string; metrica_label: string } | null;
}
interface GrupoWhatsapp { id: string; nombre: string; participantes: number; solo_admins: boolean }
interface JobSemanal { id: string; estado: 'corriendo' | 'ok' | 'error'; codigo: number | null; salida?: string }

const EMPTY: ReportesConfig = {
  activo: false,
  tipo: 'Meta Ads semanal',
  frecuencia: 'semanal',
  periodo: 'Lunes a domingo',
  dia: 'Lunes',
  hora: '08:00',
  plantilla: 'Reporte Meta Ads v2',
  compararSemanaAnterior: true,
  compararMeta: true,
  compararPresupuesto: true,
  modoEnvio: 'aprobacion',
  responsable: 'Dairo Traslaviña',
  destinatarios: {},
};

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const PREF_DEFAULT: DestinatarioPrefs = { semanal: true, mensual: true, correo: true, whatsapp: false, alertas: false };

/** 'Miércoles' → 'miercoles': el motor espera el día sin tildes y en minúscula. */
const diaMotor = (dia: string) => dia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const fechaLarga = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : null;

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: 'Sin generar',
  borrador: 'Borrador listo',
  aprobado: 'Aprobado, sin enviar',
  enviado: 'Enviado',
  rechazado: 'Rechazado',
  error: 'Error en la última corrida',
};

export default function ClientReports({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<ReportesConfig | null>(null);
  const [estrategia, setEstrategia] = useState<EstrategiaConfig | null>(null);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [adAccountId, setAdAccountId] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelSemanal | null>(null);
  const [saving, setSaving] = useState(false);
  const [trabajando, setTrabajando] = useState<'' | 'borrador' | 'envio'>('');
  // Semana que se está viendo. Vacío = la vigente (última lunes→domingo
  // cerrada), que es la que el motor calcula solo y rota cada lunes.
  const [semanaSel, setSemanaSel] = useState('');
  // Correos sueltos (gente sin contacto en DTOS) y grupo de WhatsApp destino.
  const [correosSueltos, setCorreosSueltos] = useState('');
  const [grupos, setGrupos] = useState<GrupoWhatsapp[]>([]);
  const [buscaGrupo, setBuscaGrupo] = useState('');
  const [waActivo, setWaActivo] = useState(false);
  const [waGrupo, setWaGrupo] = useState<{ id: string; nombre: string } | null>(null);
  const [probandoWa, setProbandoWa] = useState(false);
  // Fase de prueba por cliente: el correo va solo a este buzón aunque los
  // destinatarios reales ya estén cargados.
  const [pruebaActiva, setPruebaActiva] = useState(false);
  const [pruebaEmail, setPruebaEmail] = useState('');
  // Presupuesto pactado con el cliente: es contra esto que el PDF compara el
  // avance del mes. Vacío = el motor lo estima desde los presupuestos de Meta.
  const [presupuesto, setPresupuesto] = useState('');
  // Qué reporte se está configurando. Son tres motores distintos, no tres
  // vistas del mismo: ver el docstring de arriba.
  const [vista, setVista] = useState<'diario' | 'semanal' | 'mensual'>('semanal');
  const cancelado = useRef(false);

  useEffect(() => () => { cancelado.current = true; }, []);

  const cargarPanel = useCallback(async (aid: string, semana?: string) => {
    try {
      const q = semana ? `?semana=${semana}` : '';
      const p = await apiClient.get<PanelSemanal>(`/api/meta-semanal/clientes/${aid}${q}`);
      setPanel(p);
      setCorreosSueltos((p.configuracion?.emails_sueltos || []).join(', '));
      const pm = p.configuracion?.metas?.presupuesto_mensual;
      setPresupuesto(pm ? String(pm) : '');
      const rv = p.configuracion?.revision || {};
      setPruebaActiva(!!rv.activo);
      setPruebaEmail(rv.email || '');
      const w = p.configuracion?.whatsapp || {};
      setWaActivo(!!w.activo);
      setWaGrupo(w.group_id ? { id: w.group_id, nombre: w.group_nombre || w.group_id } : null);
    } catch {
      setPanel(null);   // cuenta no listada en el reporte, o motor caído
    }
  }, []);

  const cambiarSemana = async (semana: string) => {
    setSemanaSel(semana);
    if (adAccountId) await cargarPanel(adAccountId, semana);
  };

  useEffect(() => {
    apiClient.get<{ value: ReportesConfig | null }>(`/api/config/reportes_${clientId}`)
      .then((d) => setCfg({ ...EMPTY, ...(d.value || {}), destinatarios: d.value?.destinatarios || {} }))
      .catch(() => setCfg(EMPTY));
    apiClient.get<{ value: EstrategiaConfig | null }>(`/api/config/${estrategiaKey(clientId)}`)
      .then((d) => setEstrategia(d.value)).catch(() => {});
    apiClient.get<Contacto[]>(`/api/terceros?clientId=${clientId}`).then(setContactos).catch(() => {});
    apiClient.get<{ metaAdAccountId?: string | null }>(`/api/clients/${clientId}`)
      .then((c) => {
        if (!c?.metaAdAccountId) return;
        setAdAccountId(c.metaAdAccountId);
        cargarPanel(c.metaAdAccountId);
      })
      .catch(() => {});
  }, [clientId, cargarPanel]);

  const activos = useMemo(
    () => Object.values(cfg?.destinatarios || {}).filter((p) => p.semanal || p.mensual).length,
    [cfg]
  );

  /** Selector Diario | Semanal | Mensual, común a los dos estados de carga. */
  const subPestanas = (
    <div className="flex items-center gap-1 border-b border-border">
      {(['diario', 'semanal', 'mensual'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => setVista(v)}
          className={cn(
            'relative px-4 py-2 text-sm font-medium capitalize transition-colors',
            vista === v ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {v}
          {vista === v && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
      ))}
    </div>
  );

  // Se evalúa ANTES del spinner de `cfg`: ni el diario ni el mensual dependen
  // de AppConfig, así que no tienen por qué esperar a la config del semanal.
  if (vista !== 'semanal') {
    return (
      <div className="space-y-4">
        {subPestanas}
        {vista === 'mensual'
          ? <ClientReportsMensual adAccountId={adAccountId} clientName={clientName} />
          : <ClientReportsDiario adAccountId={adAccountId} clientName={clientName} />}
      </div>
    );
  }

  if (!cfg) {
    return (
      <div className="space-y-4">
        {subPestanas}
        <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      </div>
    );
  }

  /** Lo que la pestaña le manda al motor del reporte (no a AppConfig). */
  const sincronizarMotor = async (aid: string) => {
    await apiClient.put(`/api/meta-semanal/clientes/${aid}/config`, {
      activo: cfg.activo,
      frecuencia: cfg.frecuencia,
      periodo: cfg.periodo,
      dia_generacion: diaMotor(cfg.dia),
      hora: cfg.hora,
      plantilla: cfg.plantilla,
      comparar: {
        semana_anterior: cfg.compararSemanaAnterior,
        meta_mensual: cfg.compararMeta,
        presupuesto_pauta: cfg.compararPresupuesto,
      },
      modo_envio: cfg.modoEnvio === 'auto' ? 'automatico' : 'aprobacion',
      responsable: { nombre: cfg.responsable },
    });
    await apiClient.put(`/api/meta-semanal/clientes/${aid}/destinatarios`, {
      destinatarios: contactos.map((ct) => {
        const p = cfg.destinatarios[ct.id] || { semanal: false, mensual: false, correo: false, whatsapp: false, alertas: false };
        return { contacto_id: ct.id, nombre: ct.nombre, email: ct.email || '', telefono: ct.telefono || '', ...p };
      }),
    });
    // Correos sueltos + fase de prueba (a quién se le manda de verdad hoy).
    await apiClient.put(`/api/meta-semanal/clientes/${aid}`, {
      emails: correosSueltos,
      revision: { activo: pruebaActiva, email: pruebaEmail.trim() },
    });
    // Objetivo/KPI vienen de Estrategia; el presupuesto se edita aquí mismo
    // porque es contra ese número que el PDF mide el avance del mes.
    const presuNum = Number(String(presupuesto).replace(/[^\d]/g, ''));
    await apiClient.put(`/api/meta-semanal/clientes/${aid}/metas`, {
      objetivo: estrategia?.objetivo?.principal || null,
      kpi: estrategia?.metas?.kpiPrincipal || null,
      presupuesto_mensual: presuNum > 0 ? presuNum : null,
    });
  };

  const buscarGrupos = async (texto: string) => {
    setBuscaGrupo(texto);
    if (texto.trim().length < 2) { setGrupos([]); return; }
    try {
      const r = await apiClient.get<{ grupos: GrupoWhatsapp[] }>(
        `/api/meta-semanal/grupos-whatsapp?buscar=${encodeURIComponent(texto.trim())}&limite=25`);
      setGrupos(r.grupos || []);
    } catch (e) {
      setGrupos([]);
      toast({ title: 'No se pudieron listar los grupos', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const elegirGrupo = async (g: GrupoWhatsapp) => {
    if (!adAccountId) return;
    setWaGrupo({ id: g.id, nombre: g.nombre });
    setGrupos([]); setBuscaGrupo('');
    await apiClient.put(`/api/meta-semanal/clientes/${adAccountId}/whatsapp`, {
      group_id: g.id, group_nombre: g.nombre, activo: true,
    });
    setWaActivo(true);
    await cargarPanel(adAccountId, semanaSel);
    toast({ title: 'Grupo guardado', description: `El reporte se enviará a "${g.nombre}"` });
  };

  const toggleWhatsapp = async (v: boolean) => {
    if (!adAccountId) return;
    if (v && !waGrupo) {
      toast({ title: 'Falta el grupo', description: 'Busca y elige un grupo antes de activarlo', variant: 'destructive' });
      return;
    }
    setWaActivo(v);
    await apiClient.put(`/api/meta-semanal/clientes/${adAccountId}/whatsapp`, { activo: v });
    await cargarPanel(adAccountId, semanaSel);
  };

  const probarWhatsapp = async () => {
    if (!adAccountId || !waGrupo) return;
    if (!window.confirm(`Se enviará el PDF de ${panel?.semana.etiqueta} al grupo "${waGrupo.nombre}" ahora mismo. ¿Continuar?`)) return;
    setProbandoWa(true);
    try {
      await apiClient.post(`/api/meta-semanal/clientes/${adAccountId}/whatsapp-prueba${semanaSel ? `?semana=${semanaSel}` : ''}`, {});
      await cargarPanel(adAccountId, semanaSel);
      toast({ title: 'Enviado al grupo', description: waGrupo.nombre });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo enviar', variant: 'destructive' });
    } finally {
      setProbandoWa(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/api/config/reportes_${clientId}`, { value: cfg });
      if (adAccountId) {
        await sincronizarMotor(adAccountId);
        await cargarPanel(adAccountId, semanaSel);
      }
      toast({
        title: 'Configuración guardada',
        description: adAccountId
          ? `Reporte de ${clientName} ${cfg.activo ? 'activo' : 'pausado'} · sincronizado con el motor del reporte`
          : `Reporte de ${clientName} ${cfg.activo ? 'activo' : 'pausado'} (sin cuenta de Meta enlazada)`,
      });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  /** Espera a que termine la corrida del motor (genera en ~20-40 s por cuenta). */
  const esperarJob = async (jobId: string): Promise<JobSemanal> => {
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      if (cancelado.current) break;
      const { job } = await apiClient.get<{ job: JobSemanal }>(`/api/meta-semanal/jobs/${jobId}`);
      if (job.estado !== 'corriendo') return job;
    }
    throw new Error('La generación está tardando más de lo normal — revisa Jobs en el motor');
  };

  const generarBorrador = async () => {
    if (!adAccountId) return;
    setTrabajando('borrador');
    toast({ title: 'Generando borrador…', description: 'Consultando Meta y redactando el análisis. Tarda entre 30 s y 1 minuto.' });
    try {
      const { job } = await apiClient.post<{ job: JobSemanal }>(
        `/api/meta-semanal/clientes/${adAccountId}/borrador`,
        semanaSel ? { semana: semanaSel } : {},
      );
      const fin = await esperarJob(job.id);
      await cargarPanel(adAccountId, semanaSel);
      if (fin.estado === 'ok') {
        toast({ title: 'Borrador listo', description: 'Ábrelo con "Ver PDF" antes de enviarlo.' });
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
    if (!panel?.archivos?.slug) return;
    try {
      const token = await authService.getToken();
      const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const q = semanaSel ? `?semana=${semanaSel}` : '';
      const res = await fetch(`${base}/api/meta-semanal/reportes/${panel.archivos.slug}/pdf${q}`, {
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

  const enviarAhora = async () => {
    if (!adAccountId || !panel) return;
    const destinos = panel.cabecera.destinatarios_efectivos;
    if (!destinos.length) {
      toast({ title: 'Sin destinatarios', description: panel.cabecera.motivo_destinatarios, variant: 'destructive' });
      return;
    }
    if (!window.confirm(`Se enviará el reporte de la semana ${panel.semana.etiqueta} a:\n\n${destinos.join('\n')}\n\n¿Continuar?`)) return;
    setTrabajando('envio');
    try {
      const r = await apiClient.post<{ job?: JobSemanal }>(
        `/api/meta-semanal/clientes/${adAccountId}/aprobar${semanaSel ? `?semana=${semanaSel}` : ''}`, {});
      if (r.job) await esperarJob(r.job.id);
      await cargarPanel(adAccountId, semanaSel);
      toast({ title: 'Reporte enviado', description: `A ${destinos.join(', ')}` });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo enviar', variant: 'destructive' });
    } finally {
      setTrabajando('');
    }
  };

  const prefsDe = (id: string): DestinatarioPrefs => cfg.destinatarios[id] || { ...PREF_DEFAULT, semanal: false, mensual: false, correo: false };
  const togglePref = (id: string, campo: keyof DestinatarioPrefs) => {
    const cur = cfg.destinatarios[id] || { semanal: false, mensual: false, correo: false, whatsapp: false, alertas: false };
    setCfg({ ...cfg, destinatarios: { ...cfg.destinatarios, [id]: { ...cur, [campo]: !cur[campo] } } });
  };

  const presupuestoVigente = estrategia?.presupuesto?.mensual
    ? `$${Number(estrategia.presupuesto.mensual).toLocaleString('es-CO')}${estrategia.presupuesto.vigencia ? ` · ${estrategia.presupuesto.vigencia}` : ''}`
    : 'Sin definir (pestaña Estrategia)';

  const ultimo = panel?.cabecera?.ultimo_reporte;
  const textoUltimo = ultimo?.enviado_en
    ? `Enviado ${fechaLarga(ultimo.enviado_en)}`
    : ultimo && ultimo.estado !== 'pendiente'
      ? `${ETIQUETA_ESTADO[ultimo.estado] || ultimo.estado}${ultimo.generado ? ` · ${fechaLarga(ultimo.generado)}` : ''}`
      : cfg.ultimoEnvio || 'Aún no se ha enviado';
  const proxima = panel?.cabecera?.proxima_generacion ? fechaLarga(panel.cabecera.proxima_generacion) : null;

  return (
    <div className="space-y-4">
      {subPestanas}
      {/* Tarjeta resumen del módulo */}
      <div className="rounded-xl bg-card border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2">
            <FileBarChart className="h-4 w-4 text-muted-foreground" /> REPORTE {cfg.frecuencia.toUpperCase()} DE META ADS
          </h3>
          <div className="flex items-center gap-2">
            {(panel?.semanas_disponibles?.length || 0) > 0 && (
              <Select value={semanaSel || panel!.semana.desde} onValueChange={cambiarSemana}>
                <SelectTrigger className="h-7 w-[190px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {panel!.semanas_disponibles.map((s) => (
                    <SelectItem key={s.semana} value={s.semana} className="text-xs">
                      {s.etiqueta}
                      {s.es_vigente ? ' · actual' : ''}
                      {s.enviado_en ? ' · enviado' : s.tiene_pdf ? ' · borrador' : ' · sin generar'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${cfg.activo ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-border text-muted-foreground'}`}>
              {cfg.activo ? 'ACTIVO' : 'PAUSADO'}
            </span>
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div><p className="text-[11px] text-muted-foreground">Objetivo</p><p>{estrategia?.objetivo?.principal || 'Sin definir (pestaña Estrategia)'}</p></div>
          <div><p className="text-[11px] text-muted-foreground">KPI objetivo</p><p>{estrategia?.metas?.kpiPrincipal ? `${estrategia.metas.kpiPrincipal}${estrategia.metas.costoObjetivo ? ` · ${estrategia.metas.costoObjetivo}` : ''}` : 'Sin definir'}</p></div>
          <div><p className="text-[11px] text-muted-foreground">Presupuesto vigente</p><p>{presupuestoVigente}</p></div>
          <div><p className="text-[11px] text-muted-foreground">Destinatarios</p><p>{activos} contacto{activos === 1 ? '' : 's'} seleccionado{activos === 1 ? '' : 's'}</p></div>
          <div><p className="text-[11px] text-muted-foreground">Próxima generación</p><p className="capitalize">{cfg.activo ? (proxima || '—') : '—'}</p></div>
          <div><p className="text-[11px] text-muted-foreground">Último reporte</p><p>{textoUltimo}</p></div>
          <div><p className="text-[11px] text-muted-foreground">Grupo de WhatsApp</p><p>{panel?.cabecera?.grupo_whatsapp || 'Sin grupo'}</p></div>
        </div>

        {/* Aviso: mientras el motor esté en fase de revisión, todo va a un buzón */}
        {panel?.configuracion?.modo_global === 'revision' && (
          <p className="mt-3 flex items-start gap-2 text-xs text-amber-400/90">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Fase de revisión: los envíos van a <span className="font-medium">{panel.configuracion.buzon_revision}</span>, no a los contactos marcados.
          </p>
        )}
        {!adAccountId && (
          <p className="mt-3 flex items-start gap-2 text-xs text-amber-400/90">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Este cliente no tiene cuenta de Meta enlazada (campo <span className="font-mono">metaAdAccountId</span>): se puede configurar, pero no generar ni enviar.
          </p>
        )}
        {adAccountId && !panel && (
          <p className="mt-3 flex items-start gap-2 text-xs text-amber-400/90">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            La cuenta <span className="font-mono">{adAccountId}</span> no está en la lista del reporte de Meta (clientes_config.yaml), o el motor no responde.
          </p>
        )}

        {semanaSel && !panel?.semanas_disponibles?.find((s) => s.semana === semanaSel)?.es_vigente && (
          <p className="mt-3 text-xs text-muted-foreground">
            Estás viendo una semana pasada. Los botones actúan sobre <span className="font-medium">{panel?.semana.etiqueta}</span>, no sobre la semana actual.
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border">
          <Button variant="outline" size="sm" onClick={generarBorrador} disabled={!adAccountId || !panel || trabajando !== ''}>
            {trabajando === 'borrador' ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
            {trabajando === 'borrador' ? 'Generando…' : 'Generar borrador'}
          </Button>
          {panel?.archivos?.pdf && (
            <Button variant="outline" size="sm" onClick={verPDF} disabled={trabajando !== ''}>
              <FileDown className="h-4 w-4 mr-1.5" /> Ver PDF ({panel.semana.etiqueta})
            </Button>
          )}
          {panel?.cabecera?.puede_enviar && (
            <Button size="sm" onClick={enviarAhora} disabled={trabajando !== ''}>
              {trabajando === 'envio' ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
              {trabajando === 'envio' ? 'Enviando…' : 'Aprobar y enviar'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Configuración general */}
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium flex items-center gap-2"><Settings2 className="h-4 w-4 text-muted-foreground" /> Configuración general</h3>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              Reporte activo <Switch checked={cfg.activo} onCheckedChange={(v) => setCfg({ ...cfg, activo: v })} />
            </label>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Frecuencia</Label>
                <Select value={cfg.frecuencia} onValueChange={(v) => setCfg({ ...cfg, frecuencia: v as ReportesConfig['frecuencia'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="quincenal">Quincenal</SelectItem>
                    <SelectItem value="mensual">Mensual</SelectItem>
                  </SelectContent>
                </Select></div>
              <div className="space-y-1"><Label className="text-xs">Periodo analizado</Label>
                <Input value={cfg.periodo} onChange={(e) => setCfg({ ...cfg, periodo: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Día de generación</Label>
                <Select value={cfg.dia} onValueChange={(v) => setCfg({ ...cfg, dia: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DIAS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1"><Label className="text-xs">Hora</Label>
                <Input type="time" value={cfg.hora} onChange={(e) => setCfg({ ...cfg, hora: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Plantilla</Label>
              <Input value={cfg.plantilla} onChange={(e) => setCfg({ ...cfg, plantilla: e.target.value })} /></div>
            <div className="space-y-1">
              <Label className="text-xs">Presupuesto mensual pactado</Label>
              <Input
                inputMode="numeric"
                placeholder="Ej. 30000000 — vacío: lo estima desde Meta"
                value={presupuesto}
                onChange={(e) => setPresupuesto(e.target.value.replace(/[^\d]/g, ''))}
              />
              <p className="text-[11px] text-muted-foreground">
                {presupuesto
                  ? `El reporte compara el gasto del mes contra $${Number(presupuesto).toLocaleString('es-CO')}.`
                  : 'Sin dato, el reporte estima el presupuesto sumando los presupuestos diarios de Meta (suele quedar corto o inflado).'}
              </p>
            </div>
            <div className="space-y-2 pt-1">
              {([
                ['compararSemanaAnterior', 'Comparar contra semana anterior'],
                ['compararMeta', 'Comparar contra meta mensual'],
                ['compararPresupuesto', 'Comparar contra presupuesto de pauta'],
              ] as const).map(([campo, label]) => (
                <label key={campo} className="flex items-center justify-between text-sm cursor-pointer">
                  <span className="text-muted-foreground">{label}</span>
                  <Switch checked={cfg[campo]} onCheckedChange={(v) => setCfg({ ...cfg, [campo]: v })} />
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Flujo de aprobación */}
        <div className="rounded-xl bg-card border border-border p-4">
          <h3 className="text-sm font-medium flex items-center gap-2 mb-4"><Users className="h-4 w-4 text-muted-foreground" /> Flujo de aprobación</h3>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Modo de envío</Label>
              {([
                ['aprobacion', 'Requiere aprobación interna', 'DT-OS crea el borrador, el responsable revisa y aprueba antes de enviar'],
                ['auto', 'Enviar automáticamente', 'El reporte sale sin revisión manual (no recomendado aún)'],
              ] as const).map(([value, label, desc]) => (
                <label key={value} className={`flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors ${cfg.modoEnvio === value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
                  <input type="radio" name="modoEnvio" checked={cfg.modoEnvio === value} onChange={() => setCfg({ ...cfg, modoEnvio: value })} className="mt-0.5 accent-primary" />
                  <span>
                    <span className="text-sm font-medium block">{label}</span>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="space-y-1"><Label className="text-xs">Responsable DTGP</Label>
              <Input value={cfg.responsable} onChange={(e) => setCfg({ ...cfg, responsable: e.target.value })} /></div>
            {cfg.activo && proxima && (
              <p className="text-xs text-muted-foreground">
                Próxima generación: <span className="capitalize font-medium text-foreground">{proxima}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Canales de envío: grupo de WhatsApp + correos que no están en Contactos */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium flex items-center gap-2"><MessageCircle className="h-4 w-4 text-muted-foreground" /> Grupo de WhatsApp</h3>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              Enviar por WhatsApp <Switch checked={waActivo} onCheckedChange={toggleWhatsapp} disabled={!adAccountId} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            El PDF sale desde el WhatsApp de Dairo. En ese grupo el bot no hace nada más: solo deja el reporte.
          </p>

          {waGrupo ? (
            <div className="flex items-center justify-between rounded-lg border border-border p-3 mb-3">
              <div>
                <p className="text-sm font-medium">{waGrupo.nombre}</p>
                <p className="text-[11px] text-muted-foreground font-mono">{waGrupo.id}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setWaGrupo(null); setWaActivo(false); }}>Cambiar</Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-3">Sin grupo asignado.</p>
          )}

          <div className="space-y-2">
            <Label className="text-xs">Buscar grupo</Label>
            <Input
              placeholder="Escribe parte del nombre (ej. equilibrio)"
              value={buscaGrupo}
              onChange={(e) => buscarGrupos(e.target.value)}
              disabled={!adAccountId}
            />
            {grupos.length > 0 && (
              <div className="max-h-52 overflow-y-auto rounded-lg border border-border divide-y divide-border/50">
                {grupos.map((g) => (
                  <button key={g.id} type="button" onClick={() => elegirGrupo(g)}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors">
                    <p className="text-sm">{g.nombre}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {g.participantes} participantes{g.solo_admins ? ' · solo admins pueden escribir' : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {waGrupo && waActivo && (
            <Button variant="outline" size="sm" className="mt-3" onClick={probarWhatsapp} disabled={probandoWa || !panel?.archivos?.pdf}>
              {probandoWa ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
              {probandoWa ? 'Enviando…' : 'Enviar ahora al grupo (prueba)'}
            </Button>
          )}
        </div>

        <div className="rounded-xl bg-card border border-border p-4">
          <h3 className="text-sm font-medium flex items-center gap-2 mb-1"><Mail className="h-4 w-4 text-muted-foreground" /> Correos del reporte</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Para quien no está en Contactos. Se suman a los contactos marcados abajo. Separa con comas.
          </p>
          <Input
            placeholder="gerencia@cliente.com, marketing@cliente.com"
            value={correosSueltos}
            onChange={(e) => setCorreosSueltos(e.target.value)}
            disabled={!adAccountId}
          />
          <div className="mt-3 rounded-lg border border-border p-3 space-y-2">
            <label className="flex items-center justify-between text-sm cursor-pointer">
              <span>Fase de prueba: enviar solo a un correo</span>
              <Switch checked={pruebaActiva} onCheckedChange={setPruebaActiva} disabled={!adAccountId} />
            </label>
            <Input
              placeholder="dairo@dtgrowthpartners.com"
              value={pruebaEmail}
              onChange={(e) => setPruebaEmail(e.target.value)}
              disabled={!adAccountId || !pruebaActiva}
            />
            <p className="text-[11px] text-muted-foreground">
              Mientras esté activa, los correos de arriba quedan guardados pero no reciben nada.
              Apágala para soltar el envío real. No afecta al grupo de WhatsApp.
            </p>
          </div>

          <div className="mt-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Ahora mismo el reporte llega a:</p>
            {(panel?.cabecera?.destinatarios_efectivos?.length || 0) > 0
              ? panel!.cabecera.destinatarios_efectivos.map((d) => <p key={d} className="font-mono">{d}</p>)
              : <p>Nadie por correo — {panel?.cabecera?.motivo_destinatarios || 'sin destinatarios'}</p>}
            {panel?.cabecera?.grupo_whatsapp && <p>+ grupo de WhatsApp «{panel.cabecera.grupo_whatsapp}»</p>}
          </div>
        </div>
      </div>

      {/* Destinatarios: se seleccionan de Contactos, sin duplicar datos */}
      <div className="rounded-xl bg-card border border-border p-4">
        <h3 className="text-sm font-medium flex items-center gap-2 mb-1"><Users className="h-4 w-4 text-muted-foreground" /> Destinatarios del reporte</h3>
        <p className="text-xs text-muted-foreground mb-3">Se toman de la pestaña Contactos — agrega ahí a las personas y márcalas aquí.</p>
        {contactos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Este cliente aún no tiene contactos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left font-medium px-2 py-2">Contacto</th>
                  <th className="text-center font-medium px-2 py-2">Semanal</th>
                  <th className="text-center font-medium px-2 py-2">Mensual</th>
                  <th className="text-center font-medium px-2 py-2">Correo</th>
                  <th className="text-center font-medium px-2 py-2">WhatsApp</th>
                  <th className="text-center font-medium px-2 py-2">Alertas</th>
                </tr>
              </thead>
              <tbody>
                {contactos.map((ct) => {
                  const p = prefsDe(ct.id);
                  const celdas: (keyof DestinatarioPrefs)[] = ['semanal', 'mensual', 'correo', 'whatsapp', 'alertas'];
                  return (
                    <tr key={ct.id} className="border-b border-border/50 last:border-0">
                      <td className="px-2 py-2">
                        <p className="font-medium">{ct.nombre}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {[ct.cargo, ct.email, ct.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                        </p>
                      </td>
                      {celdas.map((campo) => (
                        <td key={campo} className="px-2 py-2 text-center">
                          <input type="checkbox" checked={p[campo]} onChange={() => togglePref(ct.id, campo)} className="h-4 w-4 accent-primary cursor-pointer" />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? 'Guardando…' : 'Guardar configuración'}
        </Button>
      </div>
    </div>
  );
}
