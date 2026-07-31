import axios from 'axios';

/**
 * Cliente del API interno del reporte SEMANAL de Meta Ads
 * (meta-weekly-report/api_semanal.py, pm2 `meta-semanal-api`, solo
 * localhost:3077). Es la fuente de la pestaña "Reporte semanal": portafolio de
 * la semana, PDF por cliente, destinatarios y disparo de generación/envío.
 *
 * Mismo patrón que metaGasto.service.ts (reporte diario).
 * .env: META_SEMANAL_URL (default http://127.0.0.1:3077) y META_SEMANAL_KEY.
 */

const baseUrl = () => process.env.META_SEMANAL_URL || 'http://127.0.0.1:3077';
const apiKey = () => process.env.META_SEMANAL_KEY || '';

// El reporte semanal se identifica por el LUNES de la semana (YYYY-MM-DD).
// El API acepta cualquier fecha dentro de la semana y la normaliza.
export interface SemanaRef {
  desde: string;
  hasta: string;
  etiqueta: string;
  es_vigente?: boolean;
}

export interface TotalesMoneda {
  clientes: number;
  gasto: number;
  resultados: number;
  alcance: number;
  impresiones: number;
  clicks: number;
  cpr: number | null;
  cpr_anterior: number | null;
  cpr_mes: number | null;
  gasto_ant: number;
  resultados_ant: number;
  gasto_mes: number;
  resultados_mes: number;
  delta_gasto: number | null;
  delta_resultados: number | null;
  delta_cpr: number | null;
}

export interface EstadoEnvio {
  destinatarios: string[];
  cc: string[];
  bcc: string[];
  motivo: string;
  enviado: boolean;
  ultimo_envio: string | null;
  origen_ultimo_envio: string | null;
}

export interface ClienteSemanal {
  slug: string;
  cliente: string;
  ad_account_id: string;
  moneda: string;
  metrica_label: string;
  generado: string | null;
  semana: Record<string, number | null>;
  sem_anterior: Record<string, number | null>;
  deltas: Record<string, number | null>;
  mes: Record<string, any>;
  presupuesto: Record<string, any>;
  mejor_dia: Record<string, any>;
  mejor_anuncio: Record<string, any>;
  resumen_ia: string | null;
  archivos: { pdf: boolean; html: boolean; json: boolean };
  envio: EstadoEnvio;
  share_gasto_pct: number | null;
  tamano_pdf?: number | null;
}

export interface Portafolio {
  ok: boolean;
  semana: SemanaRef;
  moneda_principal: string | null;
  totales: Record<string, TotalesMoneda>;
  clientes: ClienteSemanal[];
  sin_reporte: string[];
  serie: { fecha: string; dia: number; inicial: string; gasto: number; resultados: number; cpr: number | null; moneda: string }[];
  envio: { modo: string; revision_email: string; bcc: string };
}

/** Una fila de la tabla "Destinatarios del reporte" (viene de Contactos). */
export interface ContactoReporte {
  contacto_id?: string;
  nombre?: string;
  email?: string;
  telefono?: string;
  semanal?: boolean;
  mensual?: boolean;
  correo?: boolean;
  whatsapp?: boolean;
  alertas?: boolean;
}

export interface GrupoWhatsapp {
  id: string;
  nombre: string;
  participantes: number;
  solo_admins: boolean;
}

export interface ConfigClienteSemanal {
  activo?: boolean;
  frecuencia?: 'semanal' | 'quincenal' | 'mensual';
  periodo?: string;
  dia_generacion?: string;
  hora?: string;
  plantilla?: string;
  comparar?: { semana_anterior?: boolean; meta_mensual?: boolean; presupuesto_pauta?: boolean };
  modo_envio?: 'automatico' | 'aprobacion';
  responsable?: { id?: string; nombre?: string } | null;
}

/** Lo que pinta la pestaña "Reportes" de un cliente, de arriba a abajo. */
export interface PanelSemanal {
  ok: boolean;
  ad_account_id: string;
  cliente: string;
  semana: SemanaRef;
  cabecera: {
    estado: 'ACTIVO' | 'PAUSADO';
    objetivo: string | null;
    kpi_objetivo: string | null;
    kpi_valor: number | null;
    presupuesto_vigente: number | null;
    metas_actualizado: string | null;
    destinatarios_seleccionados: number;
    destinatarios_efectivos: string[];
    motivo_destinatarios: string;
    grupo_whatsapp: string | null;
    proxima_generacion: string | null;
    ultimo_reporte: {
      semana: string;
      estado: string;
      generado: string | null;
      enviado_en: string | null;
      enviado_a: string[] | null;
      semana_enviada: string | null;
    };
    puede_generar_borrador: boolean;
    puede_aprobar: boolean;
    puede_enviar: boolean;
  };
  configuracion: ConfigClienteSemanal & {
    whatsapp: { activo?: boolean; group_id?: string | null; group_nombre?: string | null };
    emails_sueltos: string[];
    cc: string[];
    nota: string | null;
    opciones: { frecuencias: string[]; modos_envio: string[]; dias: string[] };
    modo_global: string;
    buzon_revision: string;
  };
  destinatarios: ContactoReporte[];
  estado_semana: { estado: string; semana: string; [k: string]: any };
  /** Semanas de este cliente con reporte en disco (+ la vigente), para el selector. */
  semanas_disponibles: {
    semana: string;
    hasta: string;
    etiqueta: string;
    estado: string;
    tiene_pdf: boolean;
    enviado_en: string | null;
    es_vigente: boolean;
  }[];
  historial: any[];
  reporte: ClienteSemanal | null;
  archivos: { pdf: boolean; html: boolean; slug: string };
}

export interface JobSemanal {
  id: string;
  tipo: 'generar' | 'enviar';
  estado: 'corriendo' | 'ok' | 'error';
  inicio: string;
  fin: string | null;
  codigo: number | null;
  detalle: Record<string, any>;
  pid?: number;
  salida?: string;
}

const cliente = () =>
  axios.create({
    baseURL: baseUrl(),
    headers: { 'x-api-key': apiKey() },
    // La generación es asíncrona (devuelve 202 al instante), así que 15 s
    // alcanza para todo. Los PDF pesan ~140 KB.
    timeout: 15000,
    validateStatus: (s) => s < 500,
  });

const get = async <T>(path: string, params?: Record<string, any>): Promise<T> => {
  const { data } = await cliente().get<T>(path, { params });
  return data;
};

export const metaSemanalService = {
  /** Semanas con reportes en disco + cuál es la semana vigente. */
  semanas: () => get<{ ok: boolean; semana_vigente: string; semanas: any[] }>('/api/semanal/semanas'),

  /** Todo lo que pinta el dashboard de la pestaña. */
  portafolio: (semana?: string) => get<Portafolio>('/api/semanal/portafolio', semana ? { semana } : undefined),

  /** Un renglón por cliente con estado de generación y de envío. */
  reportes: (semana?: string) =>
    get<{ ok: boolean; semana: string; reportes: ClienteSemanal[] }>('/api/semanal/reportes', semana ? { semana } : undefined),

  /** Reporte de un cliente: resumen + el JSON completo que alimenta el PDF. */
  reporte: (slug: string, semana?: string) =>
    get<{ ok: boolean; semana: string; resumen: ClienteSemanal; datos: any }>(
      `/api/semanal/reportes/${encodeURIComponent(slug)}`,
      semana ? { semana } : undefined,
    ),

  /** PDF (o HTML) crudo para servirlo/incrustarlo desde DTOS. */
  async archivo(slug: string, formato: 'pdf' | 'html', semana?: string, descargar = false) {
    const res = await cliente().get<ArrayBuffer>(
      `/api/semanal/reportes/${encodeURIComponent(slug)}/${formato}`,
      { params: { ...(semana ? { semana } : {}), ...(descargar ? { descargar: 1 } : {}) }, responseType: 'arraybuffer' },
    );
    return {
      status: res.status,
      contentType: (res.headers['content-type'] as string) || 'application/octet-stream',
      contentDisposition: (res.headers['content-disposition'] as string) || '',
      buffer: Buffer.from(res.data as any),
    };
  },

  /** Portafolio configurado (viene de clientes_config.yaml del diario). */
  clientes: (semana?: string) =>
    get<{ ok: boolean; semana: string; modo: string; clientes: any[] }>('/api/semanal/clientes', semana ? { semana } : undefined),

  /**
   * Panel de la pestaña "Reportes" de un cliente: cabecera (estado, objetivo,
   * KPI, presupuesto, destinatarios, próxima generación, último reporte),
   * configuración general, flujo de aprobación, tabla de destinatarios,
   * historial y los KPIs de la semana. Se llama con el `metaAdAccountId` del
   * cliente en DTOS.
   */
  panel: (adAccountId: string, semana?: string) =>
    get<PanelSemanal>(`/api/semanal/clientes/${encodeURIComponent(adAccountId)}`, semana ? { semana } : undefined),

  /** Cambia a dónde va el reporte de una cuenta (o lo pausa). */
  async actualizarCliente(adAccountId: string, body: { emails?: string | string[]; cc?: string | string[]; activo?: boolean; nota?: string }) {
    const { data } = await cliente().put(`/api/semanal/clientes/${encodeURIComponent(adAccountId)}`, body);
    return data;
  },

  /** Configuración general + flujo de aprobación de la pestaña. */
  async guardarConfigCliente(adAccountId: string, body: ConfigClienteSemanal) {
    const { data } = await cliente().put(`/api/semanal/clientes/${encodeURIComponent(adAccountId)}/config`, body);
    return data;
  },

  /**
   * Tabla "Destinatarios del reporte". DTOS es la fuente de los contactos
   * (pestaña Contactos); aquí se guarda la selección y sus canales, y de ahí
   * salen los correos reales cuando el modo global deja de ser "revision".
   */
  async guardarDestinatarios(adAccountId: string, destinatarios: ContactoReporte[]) {
    const { data } = await cliente().put(`/api/semanal/clientes/${encodeURIComponent(adAccountId)}/destinatarios`, { destinatarios });
    return data;
  },

  /** Grupos de WhatsApp del bot de Dairo, para elegir a cuál va el reporte. */
  gruposWhatsapp: (buscar?: string, limite?: number) =>
    get<{ ok: boolean; total: number; grupos: GrupoWhatsapp[] }>('/api/semanal/grupos-whatsapp', {
      ...(buscar ? { buscar } : {}),
      ...(limite ? { limite } : {}),
    }),

  /** Grupo destino del cliente (o lo desactiva con activo:false). */
  async guardarWhatsapp(adAccountId: string, body: { group_id?: string | null; group_nombre?: string | null; activo?: boolean }) {
    const { data } = await cliente().put(`/api/semanal/clientes/${encodeURIComponent(adAccountId)}/whatsapp`, body);
    return data;
  },

  /** Manda el PDF de la semana al grupo ahora mismo, para verificar el destino. */
  async probarWhatsapp(adAccountId: string, semana?: string) {
    const { data } = await cliente().post(
      `/api/semanal/clientes/${encodeURIComponent(adAccountId)}/whatsapp-prueba`,
      {},
      { params: semana ? { semana } : undefined },
    );
    return data;
  },

  /** Sincroniza objetivo/KPI/presupuesto desde la pestaña Estrategia. */
  async guardarMetas(adAccountId: string, body: { objetivo?: string; kpi?: string; kpi_valor?: number; presupuesto_mensual?: number }) {
    const { data } = await cliente().put(`/api/semanal/clientes/${encodeURIComponent(adAccountId)}/metas`, body);
    return data;
  },

  /** Botón "Generar borrador": genera el PDF de esa cuenta sin enviarlo. */
  async generarBorrador(adAccountId: string, body: { semana?: string; sin_ia?: boolean } = {}) {
    const { data } = await cliente().post<{ ok: boolean; job: JobSemanal; error?: string }>(
      `/api/semanal/clientes/${encodeURIComponent(adAccountId)}/borrador`,
      body,
    );
    return data;
  },

  /** Aprueba el borrador y lo envía (con `enviar: false` solo lo aprueba). */
  async aprobar(adAccountId: string, body: { semana?: string; por?: string; enviar?: boolean } = {}) {
    const { semana, ...resto } = body;
    const { data } = await cliente().post(`/api/semanal/clientes/${encodeURIComponent(adAccountId)}/aprobar`, resto, {
      params: semana ? { semana } : undefined,
    });
    return data;
  },

  /** Devuelve el borrador al equipo con un motivo. */
  async rechazar(adAccountId: string, body: { semana?: string; por?: string; motivo?: string } = {}) {
    const { semana, ...resto } = body;
    const { data } = await cliente().post(`/api/semanal/clientes/${encodeURIComponent(adAccountId)}/rechazar`, resto, {
      params: semana ? { semana } : undefined,
    });
    return data;
  },

  /** Semanas anteriores de ese cliente con su estado y sus correos. */
  historialCliente: (adAccountId: string, limite?: number) =>
    get<{ ok: boolean; semanas: any[]; envios: any[] }>(
      `/api/semanal/clientes/${encodeURIComponent(adAccountId)}/historial`,
      limite ? { limite } : undefined,
    ),

  /** Modo de envío global: 'revision' (todo a un buzón) o 'cliente'. */
  config: () => get<{ ok: boolean; config: any; modos: string[] }>('/api/semanal/config'),

  async actualizarConfig(body: { modo?: 'revision' | 'cliente'; revision_email?: string; bcc?: string }) {
    const { data } = await cliente().put('/api/semanal/config', body);
    return data;
  },

  /** Dispara la generación. Sin `enviar:true` solo genera los PDF (dry-run). */
  async generar(body: { semana?: string; cliente?: string; enviar?: boolean; sin_ia?: boolean; todos?: boolean }) {
    const { data } = await cliente().post<{ ok: boolean; job: JobSemanal; error?: string }>('/api/semanal/generar', body);
    return data;
  },

  /** Manda los PDF ya generados a los destinatarios configurados. */
  async enviar(body: { semana?: string; cliente?: string }) {
    const { data } = await cliente().post<{ ok: boolean; job: JobSemanal; error?: string }>('/api/semanal/enviar', body);
    return data;
  },

  jobs: (limite?: number) => get<{ ok: boolean; jobs: JobSemanal[] }>('/api/semanal/jobs', limite ? { limite } : undefined),

  job: (id: string, conLog = true) =>
    get<{ ok: boolean; job: JobSemanal }>(`/api/semanal/jobs/${encodeURIComponent(id)}`, conLog ? { log: 1 } : undefined),

  /** Historial de correos enviados (ojo: "enviado" = Postfix lo aceptó). */
  historialEnvios: (semana?: string, limite?: number) =>
    get<{ ok: boolean; semana: string | null; envios: any[] }>('/api/semanal/envios', {
      ...(semana ? { semana } : {}),
      ...(limite ? { limite } : {}),
    }),

  /** Estado del cron de los lunes. */
  cron: () => get<{ ok: boolean; programado: boolean; linea: string | null; descripcion: string }>('/api/semanal/cron'),
};

export default metaSemanalService;
