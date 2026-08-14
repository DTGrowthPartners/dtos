import axios from 'axios';

/**
 * Cliente del API interno del reporte MENSUAL de Meta Ads
 * (meta-monthly-report/api_mensual.py, pm2 `meta-mensual-api`, solo
 * localhost:3078). Es la fuente de la sub-pestaña "Mensual" dentro de
 * Reportes: estado del mes por cliente, PDF, grupo de WhatsApp destino, los
 * seguidores de IG que Meta no da por API, y el disparo de generación/envío.
 *
 * Mismo patrón que metaSemanal.service.ts (reporte semanal) y
 * metaGasto.service.ts (reporte diario).
 * .env: META_MENSUAL_URL (default http://127.0.0.1:3078) y META_MENSUAL_KEY.
 *
 * La llave por cliente es `Client.metaAdAccountId` (act_…), igual que en el
 * semanal. El motor lo traduce internamente al nombre con el que está indexado
 * `envios_mensual.json`.
 */

const baseUrl = () => process.env.META_MENSUAL_URL || 'http://127.0.0.1:3078';
const apiKey = () => process.env.META_MENSUAL_KEY || '';

// El reporte mensual se identifica por el mes cerrado (YYYY-MM).
export interface MesRef {
  mes: string;
  etiqueta: string;
  es_vigente?: boolean;
}

export interface ReporteMensual {
  mes: string;
  cliente: string;
  modo: string | null;
  moneda: string | null;
  periodo: { since: string; until: string } | null;
  gasto: number | null;
  alcance: number | null;
  impresiones: number | null;
  clics: number | null;
  ig_follows: number | null;
  ig_follows_origen: string | null;
  ig_unfollows: number | null;
  ig_usuario: string | null;
  campanas: number | null;
  avisos: string[];
  /** Si trae algo, enviar.py NO manda el PDF: las cifras no cuadran. */
  bloqueantes: string[];
  generado: string | null;
  pdf: boolean;
  pdf_nombre: string | null;
  pdf_bytes: number | null;
}

export interface EnvioMensual {
  ts: string;
  cliente: string;
  mes: string;
  ok: boolean;
  detalle: string;
  origen: 'cli' | 'cron' | 'api';
  group_id: string | null;
  group_nombre: string | null;
}

export interface MesDisponible extends MesRef {
  tiene_pdf: boolean;
  enviado_en: string | null;
}

export interface PanelMensual {
  ok: boolean;
  ad_account_id: string;
  cliente: string;
  mes: MesRef;
  cabecera: {
    estado: 'ACTIVO' | 'PAUSADO';
    estado_mes: 'pausado' | 'sin_generar' | 'bloqueado' | 'generado' | 'enviado';
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
  comparativa: {
    mes: string;
    etiqueta: string;
    gasto: number | null;
    alcance: number | null;
    impresiones: number | null;
    clics: number | null;
  } | null;
  envio_mes: EnvioMensual | null;
  meses_disponibles: MesDisponible[];
  historial: EnvioMensual[];
}

export interface ClientePortafolioMensual {
  ad_account_id: string;
  cliente: string;
  activo: boolean;
  motivo: string | null;
  grupo_whatsapp: string | null;
  estado: PanelMensual['cabecera']['estado_mes'];
  gasto: number | null;
  moneda: string | null;
  modo: string | null;
  bloqueantes: string[];
  avisos: string[];
  generado: string | null;
  pdf: boolean;
  enviado_en: string | null;
}

export interface PortafolioMensual {
  ok: boolean;
  mes: MesRef;
  /** Separado por moneda a propósito: Compu Xtreme factura en USD. */
  totales: Record<string, { clientes: number; gasto: number }>;
  clientes: ClientePortafolioMensual[];
}

export interface GrupoWhatsapp {
  id: string;
  nombre: string;
  participantes?: number;
  solo_admins?: boolean;
}

export interface JobMensual {
  id: string;
  tipo: string;
  estado: 'corriendo' | 'ok' | 'error';
  inicio: string;
  fin: string | null;
  codigo: number | null;
  detalle: Record<string, any>;
  pasos?: number;
  paso?: number;
  pid?: number;
  salida?: string;
}

const cliente = () =>
  axios.create({
    baseURL: baseUrl(),
    headers: { 'x-api-key': apiKey() },
    // Generar y enviar devuelven 202 al instante (corren en un hilo aparte),
    // así que 15 s alcanza. Los PDF mensuales pesan ~500 KB.
    timeout: 15000,
    validateStatus: (s) => s < 500,
  });

const get = async <T>(path: string, params?: Record<string, any>): Promise<T> => {
  const { data } = await cliente().get<T>(path, { params });
  return data;
};

/**
 * Las escrituras devuelven el CÓDIGO del motor además del cuerpo.
 *
 * `validateStatus` deja pasar los 4xx sin lanzar (hace falta para servir el PDF
 * como binario), así que un 400 "el cliente está pausado" o un 409 "ya hay un
 * job en curso" llegarían aquí como respuesta normal. Si la ruta les pusiera un
 * 200/202 encima, el frontend daría la operación por buena y luego reventaría
 * buscando un `job.id` que no existe. Por eso el status viaja hasta Express.
 */
const enviarCambio = async <T>(
  metodo: 'post' | 'put',
  path: string,
  body: any,
): Promise<{ status: number; data: T }> => {
  const res = await cliente()[metodo]<T>(path, body ?? {});
  return { status: res.status, data: res.data };
};

const conMes = (mes?: string) => (mes ? { mes } : undefined);
const enc = encodeURIComponent;

export const metaMensualService = {
  /** Meses cerrados seleccionables + cuál es el vigente. */
  meses: () => get<{ ok: boolean; vigente: string; meses: MesRef[] }>('/api/mensual/meses'),

  /** Todos los clientes del mes con su estado (para una vista de conjunto). */
  portafolio: (mes?: string) => get<PortafolioMensual>('/api/mensual/portafolio', conMes(mes)),

  /**
   * Panel de la sub-pestaña "Mensual" de un cliente: estado del mes, KPIs del
   * `config.json` con el que se armó el PDF, grupo destino, seguidores de IG
   * cargados a mano e historial de envíos.
   */
  panel: (adAccountId: string, mes?: string) =>
    get<PanelMensual>(`/api/mensual/clientes/${enc(adAccountId)}`, conMes(mes)),

  /** Activa/pausa el envío mensual de una cuenta y su motivo o nota. */
  actualizarCliente: (adAccountId: string, body: { activo?: boolean; motivo?: string; nota?: string }) =>
    enviarCambio('put', `/api/mensual/clientes/${enc(adAccountId)}`, body),

  /** Grupo de WhatsApp destino. group_id vacío = se quita el grupo. */
  guardarWhatsapp: (adAccountId: string, body: { group_id?: string | null; group_nombre?: string | null }) =>
    enviarCambio('put', `/api/mensual/clientes/${enc(adAccountId)}/whatsapp`, body),

  /**
   * Seguidores de Instagram de un mes concreto. Meta NO expone por API los
   * seguimientos atribuidos a los anuncios, así que este número se carga a
   * mano; va por mes a propósito, porque uno fijo se quedaría viejo.
   * valor null borra el dato y el PDF vuelve a lo que dé la API.
   */
  guardarIgFollows: (adAccountId: string, body: { mes: string; valor: number | null }) =>
    enviarCambio('put', `/api/mensual/clientes/${enc(adAccountId)}/ig-follows`, body),

  /** Extracción + PDF de ese cliente y ese mes (202 + job). */
  generar: (adAccountId: string, body: { mes?: string } = {}) =>
    enviarCambio<{ ok: boolean; job: JobMensual }>('post', `/api/mensual/clientes/${enc(adAccountId)}/generar`, body),

  /** Manda el PDF al grupo del cliente (202 + job). */
  enviar: (adAccountId: string, body: { mes?: string; dry_run?: boolean } = {}) =>
    enviarCambio<{ ok: boolean; job: JobMensual }>('post', `/api/mensual/clientes/${enc(adAccountId)}/enviar`, body),

  /** Manda el PDF por correo a un buzón (canal aparte, no toca los grupos). */
  enviarCorreo: (adAccountId: string, body: { mes?: string; to: string; dry_run?: boolean }) =>
    enviarCambio<{ ok: boolean; job: JobMensual }>('post', `/api/mensual/clientes/${enc(adAccountId)}/enviar-correo`, body),

  /** PDF crudo para servirlo o incrustarlo desde DTOS. */
  async pdf(adAccountId: string, mes?: string, descargar = false) {
    const res = await cliente().get<ArrayBuffer>(`/api/mensual/clientes/${enc(adAccountId)}/pdf`, {
      params: { ...(mes ? { mes } : {}), ...(descargar ? { descargar: 1 } : {}) },
      responseType: 'arraybuffer',
    });
    return {
      status: res.status,
      contentType: (res.headers['content-type'] as string) || 'application/octet-stream',
      contentDisposition: (res.headers['content-disposition'] as string) || '',
      buffer: Buffer.from(res.data as any),
    };
  },

  /** Historial de envíos del cliente (incluye los del cron del día 1). */
  historial: (adAccountId: string, limite?: number) =>
    get<{ ok: boolean; cliente: string; historial: EnvioMensual[] }>(
      `/api/mensual/clientes/${enc(adAccountId)}/historial`,
      limite ? { limite } : undefined,
    ),

  /** Grupos de WhatsApp del bot de Dairo, para elegir el destino. */
  gruposWhatsapp: (buscar?: string, limite?: number) =>
    get<{ ok: boolean; grupos: GrupoWhatsapp[]; error?: string }>('/api/mensual/grupos-whatsapp', {
      ...(buscar ? { buscar } : {}),
      ...(limite ? { limite } : {}),
    }),

  /** Configuración global del motor (hoy: a quién le llega el resumen). */
  config: () => get<{ ok: boolean; resumen_a: string | null; clientes: number }>('/api/mensual/config'),

  actualizarConfig: (body: { resumen_a?: string }) => enviarCambio('put', '/api/mensual/config', body),

  /** Generación masiva del mes (por defecto solo los clientes activos). */
  generarTodos: (body: { mes?: string; todos?: boolean } = {}) =>
    enviarCambio<{ ok: boolean; job: JobMensual }>('post', '/api/mensual/generar', body),

  /** Envío masivo de lo ya generado. */
  enviarTodos: (body: { mes?: string; dry_run?: boolean } = {}) =>
    enviarCambio<{ ok: boolean; job: JobMensual }>('post', '/api/mensual/enviar', body),

  jobs: (limite?: number) =>
    get<{ ok: boolean; jobs: JobMensual[] }>('/api/mensual/jobs', limite ? { limite } : undefined),

  job: (id: string, log = false) =>
    get<{ ok: boolean; job: JobMensual }>(`/api/mensual/jobs/${enc(id)}`, log ? { log: 1 } : undefined),

  /** Estado del cron del día 1. */
  cron: () =>
    get<{
      ok: boolean;
      programado: boolean;
      linea: string | null;
      descripcion: string;
      proxima_generacion: string | null;
      mes_a_reportar: string;
    }>('/api/mensual/cron'),
};

export default metaMensualService;
