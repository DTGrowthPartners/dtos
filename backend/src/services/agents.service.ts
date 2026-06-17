import axios, { AxiosError } from 'axios';

/**
 * Registry de agentes de WhatsApp.
 *
 * Cada agente expone una API REST con header X-API-Key. Esta API key es SECRETA y vive
 * exclusivamente en el backend (variables de .env). El frontend nunca la ve.
 *
 * Para agregar un agente nuevo:
 *   1. Append una entrada a AGENTS abajo (id, name, baseUrl, envKey, etc.).
 *   2. Set AGENT_<ID>_API_KEY=... en /home/ubuntu/dtos/backend/.env del VPS.
 *   3. pm2 restart dtos-backend.
 *
 * Los paths bajo /api/externo/ son los del agente externo (ej. david.dtgrowthpartners.com).
 * Asumimos contrato comun: GET /estado, POST /estado, GET /stats, POST /enviar, GET /health.
 */

interface AgentConfig {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  /** Prefijo de path bajo el baseUrl. Ej: '/api/externo' o '/api/v1'. */
  pathPrefix: string;
  /** Como se envia el API key. 'x-api-key' = header X-API-Key; 'bearer' = Authorization: Bearer */
  auth: 'x-api-key' | 'bearer';
  /** Nombre de la env var donde vive el API key. */
  envKey: string;
  /** El bot soporta envio de mensajes via /enviar? (no todos lo exponen). */
  supportsSend?: boolean;
  /** El bot soporta el concepto de "modo" (solo_prospectos, etc.)? */
  supportsModo?: boolean;
  whatsappNumber?: string;
}

const AGENTS: AgentConfig[] = [
  {
    id: 'dairo',
    name: 'Bot Dairo WhatsApp',
    description: 'Asistente conversacional de Dairo en WhatsApp.',
    baseUrl: 'https://david.dtgrowthpartners.com',
    pathPrefix: '/api/externo',
    auth: 'x-api-key',
    envKey: 'AGENT_DAIRO_API_KEY',
    supportsSend: true,
    supportsModo: true,
  },
  {
    id: 'cantina',
    name: 'CantinaBot',
    description: 'Bot conversacional de La Cantina: reservas, comprobantes, mesas.',
    baseUrl: 'https://cantinabot.dtgrowthpartners.com',
    pathPrefix: '/api/v1',
    auth: 'bearer',
    envKey: 'AGENT_CANTINA_API_KEY',
    supportsSend: false,
    supportsModo: false,
  },
];

const getApiKey = (agent: AgentConfig): string => {
  const key = process.env[agent.envKey];
  if (!key) {
    throw new Error(`API key no configurada para agente ${agent.id}. Setea ${agent.envKey} en .env y reinicia el backend.`);
  }
  return key;
};

export const getAgent = (id: string): AgentConfig | undefined =>
  AGENTS.find((a) => a.id === id);

/** Lista publica de agentes (sin exponer envKey ni la API key). */
export const listAgentsPublic = () =>
  AGENTS.map(({ envKey, ...pub }) => ({
    ...pub,
    // Indica si la key esta configurada en el .env (true) o falta (false).
    configured: !!process.env[envKey],
  }));

/** Llamada generica a la API de un agente. */
const callAgent = async <T = unknown>(
  agentId: string,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown
): Promise<T> => {
  const agent = getAgent(agentId);
  if (!agent) throw new Error(`Agente ${agentId} no encontrado`);
  const apiKey = getApiKey(agent);

  const url = `${agent.baseUrl}${agent.pathPrefix}${path}`;
  const authHeaders: Record<string, string> =
    agent.auth === 'bearer'
      ? { Authorization: `Bearer ${apiKey}` }
      : { 'X-API-Key': apiKey };

  try {
    const res = await axios.request<T>({
      url,
      method,
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
      },
      data: body,
      timeout: 15000,
      validateStatus: () => true, // dejamos pasar 4xx/5xx y los gestionamos abajo
    });
    if (res.status >= 400) {
      const err: any = new Error(`Agente ${agentId} respondio ${res.status}`);
      err.status = res.status;
      err.body = res.data;
      throw err;
    }
    return res.data;
  } catch (e) {
    const err = e as AxiosError;
    if (err.code === 'ECONNABORTED' || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      const offline: any = new Error(`Agente ${agentId} no responde (${err.code})`);
      offline.status = 503;
      throw offline;
    }
    throw e;
  }
};

export const agentHealth = (id: string) =>
  callAgent<{ status?: string; [k: string]: unknown }>(id, 'GET', '/health');

export const agentGetEstado = (id: string) =>
  callAgent<{
    activo?: boolean;
    modo?: string;
    trafico_24h?: unknown;
    [k: string]: unknown;
  }>(id, 'GET', '/estado');

export interface SetEstadoBody {
  activo?: boolean;
  modo?: string;
  razon?: string;
  por?: string;
}
export const agentSetEstado = (id: string, body: SetEstadoBody) => {
  // Cantina (sin supportsModo) no acepta `modo` ni `por` — limpiamos antes de enviar.
  const agent = getAgent(id);
  const cleanBody: SetEstadoBody = { activo: body.activo, razon: body.razon };
  if (agent?.supportsModo && body.modo) cleanBody.modo = body.modo;
  if (agent?.supportsModo && body.por) cleanBody.por = body.por;
  return callAgent(id, 'POST', '/estado', cleanBody);
};

export const agentGetStats = (id: string) =>
  callAgent<Record<string, unknown>>(id, 'GET', '/stats');

/**
 * Contrato real del bot Dairo en POST /api/externo/enviar:
 *   { destino, mensaje, origen }
 * destino acepta:
 *   - Grupo:   120363422490459440@g.us
 *   - Numero:  +573001234567
 *   - Whapi:   573001234567@s.whatsapp.net
 */
export interface SendMessageBody {
  destino: string;
  mensaje: string;
  origen?: string;
}
export const agentSendMessage = (id: string, body: SendMessageBody) => {
  const agent = getAgent(id);
  if (!agent?.supportsSend) {
    const err: any = new Error(`Agente ${id} no soporta envio de mensajes`);
    err.status = 400;
    throw err;
  }
  return callAgent(id, 'POST', '/enviar', {
    destino: body.destino,
    mensaje: body.mensaje,
    origen: body.origen || 'dtos',
  });
};
