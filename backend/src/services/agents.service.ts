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
  envKey: string; // nombre de la env var donde vive el API key
  whatsappNumber?: string;
}

const AGENTS: AgentConfig[] = [
  {
    id: 'dairo',
    name: 'Bot Dairo WhatsApp',
    description: 'Asistente conversacional de Dairo en WhatsApp.',
    baseUrl: 'https://david.dtgrowthpartners.com',
    envKey: 'AGENT_DAIRO_API_KEY',
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

  const url = `${agent.baseUrl}${path}`;
  try {
    const res = await axios.request<T>({
      url,
      method,
      headers: {
        'X-API-Key': apiKey,
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
  callAgent<{ status?: string; [k: string]: unknown }>(id, 'GET', '/api/externo/health');

export const agentGetEstado = (id: string) =>
  callAgent<{
    activo?: boolean;
    modo?: string;
    trafico_24h?: unknown;
    [k: string]: unknown;
  }>(id, 'GET', '/api/externo/estado');

export interface SetEstadoBody {
  activo?: boolean;
  modo?: string;
  razon?: string;
  por?: string;
}
export const agentSetEstado = (id: string, body: SetEstadoBody) =>
  callAgent(id, 'POST', '/api/externo/estado', body);

export const agentGetStats = (id: string) =>
  callAgent<Record<string, unknown>>(id, 'GET', '/api/externo/stats');

export interface SendMessageBody {
  numero?: string;
  grupo?: string;
  mensaje: string;
}
export const agentSendMessage = (id: string, body: SendMessageBody) =>
  callAgent(id, 'POST', '/api/externo/enviar', body);
