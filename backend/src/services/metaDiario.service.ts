import axios from 'axios';

/**
 * Cliente del API interno del reporte DIARIO de Meta Ads
 * (meta-daily-report/api_diario.py, pm2 `meta-diario-api`, solo
 * localhost:3079). Es la fuente de la sub-pestaña "Diario" dentro de Reportes:
 * semáforo y KPIs del día, configuración de la cuenta en el reporte, y los PDF
 * (la hoja interna del cliente y el maestro).
 *
 * Mismo patrón que metaSemanal/metaMensual.service.ts. No confundir con
 * metaGasto.service.ts, que también lee de este proyecto pero solo devuelve el
 * gasto del mes para el dashboard.
 * .env: META_DIARIO_URL (default http://127.0.0.1:3079) y META_DIARIO_KEY.
 *
 * **Las escrituras tocan `clientes_config.yaml`, que es la fuente de verdad de
 * los TRES reportes** (el semanal y el mensual sacan de ahí su lista de
 * clientes). Por eso el API devuelve `afecta` en cada guardado: la pestaña lo
 * advierte antes de que alguien excluya una cuenta pensando que solo cambia el
 * diario.
 */

const baseUrl = () => process.env.META_DIARIO_URL || 'http://127.0.0.1:3079';
const apiKey = () => process.env.META_DIARIO_KEY || '';

/** El reporte diario se identifica por la fecha ANALIZADA (ayer), no por la de generación. */
export interface FechaRef {
  fecha: string;
  etiqueta: string;
  es_vigente?: boolean;
}

export interface PeriodoDiario {
  gasto: number | null;
  resultados: number | null;
  cpr: number | null;
}

export interface FilaDiaria {
  ad_account_id: string;
  cliente: string;
  metrica_label: string | null;
  estado: 'VERDE' | 'AMARILLO' | 'ROJO' | null;
  razon_estado: string | null;
  error_lectura: boolean;
  ayer: PeriodoDiario;
  sem_actual: PeriodoDiario;
  sem_anterior: PeriodoDiario;
  mes: PeriodoDiario;
}

export interface AccionDiaria {
  cliente: string;
  problema: string;
  accion: string;
  nivel: 'criticas' | 'atencion' | 'seguimiento';
}

export interface EstadoCron {
  linea: string | null;
  programado: boolean;
  descripcion: string;
}

export interface PanelDiario {
  ok: boolean;
  ad_account_id: string;
  cliente: string;
  fecha: FechaRef;
  cabecera: {
    incluido: boolean;
    estado: 'VERDE' | 'AMARILLO' | 'ROJO' | null;
    razon_estado: string | null;
    error_lectura: boolean;
    metrica_label: string | null;
    metrica_action_type: string | null;
    /** true = la cuenta no define métrica propia y usa el default del archivo. */
    metrica_heredada: boolean;
    /** Mecanismo por adsets (caso Gia): se muestra, no se edita. */
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
  acciones: AccionDiaria[];
  fechas_disponibles: (FechaRef & { tiene_pdf: boolean })[];
  crons: { consolidado: EstadoCron; hojas_y_correo: EstadoCron };
}

export interface PortafolioDiario {
  ok: boolean;
  fecha: FechaRef;
  generado: string | null;
  hay_snapshot: boolean;
  gasto_mes_total: number;
  cuentas_bloqueadas: any[];
  clientes: {
    ad_account_id: string;
    cliente: string;
    incluido: boolean;
    estado: 'VERDE' | 'AMARILLO' | 'ROJO' | null;
    razon_estado: string | null;
    metrica_label: string | null;
    gasto_ayer: number | null;
    resultados_ayer: number | null;
    cpr_ayer: number | null;
    gasto_mes: number | null;
    en_reporte: boolean;
  }[];
}

export interface JobDiario {
  id: string;
  tipo: string;
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
    // Generar devuelve 202 al instante (corre en un hilo aparte). El PDF
    // maestro pesa ~140 KB y las hojas ~8 KB.
    timeout: 15000,
    validateStatus: (s) => s < 500,
  });

const get = async <T>(path: string, params?: Record<string, any>): Promise<T> => {
  const { data } = await cliente().get<T>(path, { params });
  return data;
};

/**
 * Las escrituras devuelven el CÓDIGO del motor además del cuerpo — ver la nota
 * equivalente en metaMensual.service.ts: con `validateStatus: s < 500` los 4xx
 * llegan como respuesta normal y la ruta tiene que reenviar el status para que
 * el frontend no dé por buena una operación rechazada.
 */
const enviarCambio = async <T>(
  metodo: 'post' | 'put',
  path: string,
  body: any,
): Promise<{ status: number; data: T }> => {
  const res = await cliente()[metodo]<T>(path, body ?? {});
  return { status: res.status, data: res.data };
};

const conFecha = (fecha?: string) => (fecha ? { fecha } : undefined);
const enc = encodeURIComponent;

export const metaDiarioService = {
  /** Fechas con snapshot en disco + cuál es la vigente (ayer). */
  fechas: () => get<{ ok: boolean; vigente: string; fechas: FechaRef[] }>('/api/diario/fechas'),

  /** Catálogo de métricas primarias para el selector de la pestaña. */
  metricas: () =>
    get<{
      ok: boolean;
      defaults: { metrica_action_type: string; metrica_label: string };
      metricas: { action_type: string; etiqueta: string }[];
    }>('/api/diario/metricas'),

  /** Todas las cuentas del día con su semáforo. */
  portafolio: (fecha?: string) => get<PortafolioDiario>('/api/diario/portafolio', conFecha(fecha)),

  /** Panel de la sub-pestaña "Diario" de un cliente. */
  panel: (adAccountId: string, fecha?: string) =>
    get<PanelDiario>(`/api/diario/clientes/${enc(adAccountId)}`, conFecha(fecha)),

  /**
   * Configuración de la cuenta en `clientes_config.yaml`. La respuesta trae
   * `afecta` con los reportes que quedan tocados por el cambio.
   */
  actualizarCliente: (
    adAccountId: string,
    body: {
      nombre?: string;
      subtitulo?: string;
      metrica_action_type?: string;
      metrica_label?: string;
      email?: string;
      excluir?: boolean;
    },
  ) => enviarCambio('put', `/api/diario/clientes/${enc(adAccountId)}`, body),

  /** Regenera la hoja interna de ese cliente (202 + job). No manda correo. */
  generar: (adAccountId: string, body: { fecha?: string; sin_ia?: boolean } = {}) =>
    enviarCambio<{ ok: boolean; job: JobDiario }>('post', `/api/diario/clientes/${enc(adAccountId)}/generar`, body),

  /** Regenera el día completo: consolidado + todas las hojas (202 + job). */
  generarDia: (body: { fecha?: string; sin_ia?: boolean } = {}) =>
    enviarCambio<{ ok: boolean; job: JobDiario }>('post', '/api/diario/generar', body),

  /** Hoja interna del cliente (`ruta: 'cliente'`) o el PDF maestro del día. */
  async pdf(ruta: 'cliente' | 'maestro', adAccountId: string | null, fecha?: string, descargar = false) {
    const path = ruta === 'maestro' ? '/api/diario/maestro/pdf' : `/api/diario/clientes/${enc(adAccountId || '')}/pdf`;
    const res = await cliente().get<ArrayBuffer>(path, {
      params: { ...(fecha ? { fecha } : {}), ...(descargar ? { descargar: 1 } : {}) },
      responseType: 'arraybuffer',
    });
    return {
      status: res.status,
      contentType: (res.headers['content-type'] as string) || 'application/octet-stream',
      contentDisposition: (res.headers['content-disposition'] as string) || '',
      buffer: Buffer.from(res.data as any),
    };
  },

  /** Destinatarios y estado de los crons. Solo lectura (el .env guarda el token de Meta). */
  config: () =>
    get<{
      ok: boolean;
      solo_lectura: boolean;
      maestro_a: string | null;
      buzon_revision: string | null;
      bcc: string | null;
      nota: string;
      crons: { consolidado: EstadoCron; hojas_y_correo: EstadoCron };
    }>('/api/diario/config'),

  jobs: (limite?: number) =>
    get<{ ok: boolean; jobs: JobDiario[] }>('/api/diario/jobs', limite ? { limite } : undefined),

  job: (id: string, log = false) =>
    get<{ ok: boolean; job: JobDiario }>(`/api/diario/jobs/${enc(id)}`, log ? { log: 1 } : undefined),

  cron: () =>
    get<{
      ok: boolean;
      consolidado: EstadoCron;
      hojas_y_correo: EstadoCron;
      fecha_a_reportar: string;
    }>('/api/diario/cron'),
};

export default metaDiarioService;
