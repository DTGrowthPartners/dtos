import axios from 'axios';

/**
 * Cliente del API interno de gasto Meta (meta-daily-report/api_gasto_mes.py,
 * pm2 meta-gasto-api, solo localhost:3076). La fuente son los snapshots del
 * reporte diario (cron 12:35 UTC): el dato cubre del día 1 hasta AYER.
 *
 * .env: META_GASTO_URL (default http://127.0.0.1:3076) y META_GASTO_KEY.
 */

const baseUrl = () => process.env.META_GASTO_URL || 'http://127.0.0.1:3076';
const apiKey = () => process.env.META_GASTO_KEY || '';

export interface GastoMesResumen {
  ok: boolean;
  mes: string; // YYYY-MM
  total_gasto_mes: number;
  moneda: string;
  periodo: { desde: string; hasta: string; dias: number; dias_totales_mes: number; mes_cerrado: boolean };
  cuentas: { incluidas: number; con_error_lectura: number };
  snapshot: { archivo: string; fecha_analizada: string; generado: string | null; dias_de_atraso: number };
}

export interface GastoCuenta {
  nombre: string;
  ad_account_id: string;
  gasto_mes: number;
  resultados_mes: number | null;
  cpr_mes: number | null;
  tipo_resultado: string | null;
  gasto_sem_actual: number | null;
  gasto_sem_anterior: number | null;
  resultados_sem_actual: number | null;
  resultados_sem_anterior: number | null;
  estado: string | null;
  error_lectura: boolean;
}

export type GastoMesDetalle = GastoMesResumen & { clientes: GastoCuenta[] };

const get = async <T>(path: string, mes?: string): Promise<T> => {
  const { data } = await axios.get<T>(`${baseUrl()}${path}`, {
    params: mes ? { mes } : undefined,
    headers: { 'x-api-key': apiKey() },
    timeout: 8000,
  });
  return data;
};

export const metaGastoService = {
  /** Total del mes (todas las cuentas). Sin mes → mes en curso hasta ayer. */
  getGastoMes: (mes?: string) => get<GastoMesResumen>('/api/gasto-mes', mes),

  /** Desglose por cuenta/cliente (para comisión y panel de pauta). */
  getDetalle: (mes?: string) => get<GastoMesDetalle>('/api/gasto-mes/detalle', mes),

  /** Gasto del mes de UNA cuenta (null si la cuenta no está en el snapshot). */
  async gastoDeCuenta(adAccountId: string, mes?: string): Promise<{ gasto: number; detalle: GastoMesDetalle } | null> {
    const detalle = await this.getDetalle(mes);
    const cuenta = detalle.clientes.find((c) => c.ad_account_id === adAccountId);
    if (!cuenta) return null;
    return { gasto: cuenta.gasto_mes, detalle };
  },
};

export default metaGastoService;
