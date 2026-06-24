// Servidor MCP remoto de DT-OS.
// Expone las acciones del sistema (vía la API de bot /api/webhook/bot/*) como
// herramientas MCP para que Claude (claude.ai) las use como "custom connector".
//
// Transporte: Streamable HTTP (stateless), endpoint único /mcp/<TOKEN>.
// Auth: token en la ruta (o header Authorization: Bearer <TOKEN>).
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

dotenv.config();

const PORT = process.env.PORT || 3470;
const DTOS_BASE = process.env.DTOS_API_BASE || 'http://localhost:3004/api/webhook';
const BOT_API_KEY = process.env.BOT_API_KEY || 'dt-bot-secret-key-2024';
const MCP_TOKEN = process.env.MCP_TOKEN || '';

// Llamada genérica a la API de bot de DT-OS.
async function dtos(method, path, body) {
  const res = await fetch(`${DTOS_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-api-key': BOT_API_KEY },
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    return { error: `HTTP ${res.status}`, detalle: data };
  }
  return data;
}

const ok = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });

function createMcpServer() {
  const server = new McpServer({ name: 'dtos-mcp', version: '1.0.0' });

  // ── Consultas ──────────────────────────────────────────────
  server.tool(
    'get_tasks',
    'Lista las tareas de un miembro del equipo en DT-OS.',
    { usuario: z.string().describe('Nombre del miembro: Lía, Dairo, Stiven, Edgardo, Jhonathan'),
      estado: z.enum(['todo', 'in_progress', 'done']).optional().describe('Filtro de estado (opcional)') },
    async ({ usuario, estado }) => ok(await dtos('GET', `/bot/tasks?usuario=${encodeURIComponent(usuario)}${estado ? `&estado=${estado}` : ''}`))
  );

  server.tool(
    'get_all_tasks',
    'Tareas pendientes (TODO e IN_PROGRESS) de todo el equipo, agrupadas por usuario.',
    {},
    async () => ok(await dtos('GET', '/bot/tasks/all'))
  );

  server.tool(
    'get_projects',
    'Lista los proyectos activos de DT-OS.',
    {},
    async () => ok(await dtos('GET', '/bot/projects'))
  );

  server.tool(
    'get_clients',
    'Lista los clientes con sus servicios activos. Opcional: buscar por nombre/email.',
    { search: z.string().optional() },
    async ({ search }) => ok(await dtos('GET', `/bot/clients${search ? `?search=${encodeURIComponent(search)}` : ''}`))
  );

  server.tool(
    'get_finances',
    'Resumen financiero del mes (presupuesto vs real, ingresos/gastos, cuentas por cobrar/pagar).',
    { mes: z.string().optional().describe('enero, febrero, marzo… (default: mes actual)') },
    async ({ mes }) => ok(await dtos('GET', `/bot/finances${mes ? `?mes=${encodeURIComponent(mes)}` : ''}`))
  );

  server.tool(
    'get_crm',
    'Resumen del CRM: pipeline por etapa, deals, próximos seguimientos.',
    {},
    async () => ok(await dtos('GET', '/bot/crm'))
  );

  server.tool(
    'get_deals',
    'Lista oportunidades (deals) del CRM con filtros opcionales.',
    { etapa: z.string().optional(), buscar: z.string().optional(), prioridad: z.string().optional() },
    async ({ etapa, buscar, prioridad }) => {
      const q = new URLSearchParams();
      if (etapa) q.set('etapa', etapa);
      if (buscar) q.set('buscar', buscar);
      if (prioridad) q.set('prioridad', prioridad);
      return ok(await dtos('GET', `/bot/crm/deals${q.toString() ? `?${q}` : ''}`));
    }
  );

  server.tool(
    'get_campaigns',
    'Campañas publicitarias de un cliente con métricas (presupuesto, gasto, CTR, CPC, CPA).',
    { client: z.string().optional().describe('Nombre del cliente') },
    async ({ client }) => ok(await dtos('GET', `/bot/campaigns${client ? `?client=${encodeURIComponent(client)}` : ''}`))
  );

  server.tool(
    'get_client_goals',
    'Metas de ingresos por cliente del mes con semáforo de cumplimiento.',
    { mes: z.string().optional() },
    async ({ mes }) => ok(await dtos('GET', `/bot/client-goals${mes ? `?mes=${encodeURIComponent(mes)}` : ''}`))
  );

  // ── Acciones ───────────────────────────────────────────────
  server.tool(
    'create_task',
    'Crea una tarea en DT-OS.',
    { titulo: z.string(), asignado: z.string().optional().describe('Lía, Dairo, Stiven, Edgardo, Jhonathan'),
      prioridad: z.enum(['baja', 'media', 'alta']).optional(), descripcion: z.string().optional(),
      proyecto: z.string().optional(), fechaFin: z.string().optional().describe('YYYY-MM-DD') },
    async (a) => ok(await dtos('POST', '/bot/tasks', a))
  );

  server.tool(
    'update_task',
    'Actualiza una tarea por id (estado/prioridad).',
    { id: z.string(), estado: z.enum(['todo', 'in_progress', 'done']).optional(), prioridad: z.enum(['baja', 'media', 'alta']).optional() },
    async ({ id, estado, prioridad }) => ok(await dtos('PATCH', `/bot/tasks/${id}`, { estado, prioridad }))
  );

  server.tool(
    'create_client',
    'Crea un cliente nuevo en DT-OS.',
    { nombre: z.string(), email: z.string().optional(), nit: z.string().optional(), telefono: z.string().optional(), direccion: z.string().optional() },
    async (a) => ok(await dtos('POST', '/bot/clients', a))
  );

  server.tool(
    'create_deal',
    'Crea una oportunidad (deal/prospecto) en el CRM.',
    { nombre: z.string(), empresa: z.string().optional(), telefono: z.string().optional(),
      valorEstimado: z.number().optional(), etapa: z.string().optional(), prioridad: z.string().optional(), notas: z.string().optional() },
    async (a) => ok(await dtos('POST', '/bot/crm/deals', a))
  );

  server.tool(
    'leer_brief',
    'Lee el brief de un proyecto (por nombre o id) en formato Markdown.',
    { proyecto: z.string().describe('nombre o id del proyecto') },
    async ({ proyecto }) => ok(await dtos('GET', `/bot/projects/${encodeURIComponent(proyecto)}/brief`))
  );

  server.tool(
    'escribir_brief',
    'Crea o reescribe el brief de un proyecto a partir de Markdown (títulos #, listas, checklists - [ ], citas >, links, imágenes).',
    { proyecto: z.string().describe('nombre o id del proyecto'),
      titulo: z.string().optional().describe('título del brief'),
      markdown: z.string().describe('contenido del brief en Markdown') },
    async ({ proyecto, titulo, markdown }) =>
      ok(await dtos('PUT', `/bot/projects/${encodeURIComponent(proyecto)}/brief`, { titulo, markdown }))
  );

  server.tool(
    'registrar_contacto',
    'Registra un contacto con un prospecto del pipeline (por teléfono o dealId). Reinicia el contador de "días desde el último contacto" y deja la interacción en el historial.',
    { telefono: z.string().optional().describe('teléfono del prospecto, con o sin indicativo'),
      dealId: z.string().optional().describe('ID del deal (alternativa al teléfono)'),
      nota: z.string().optional().describe('resumen del contacto'),
      canal: z.string().optional().describe('whatsapp | call | email | meeting | note (default whatsapp)') },
    async (a) => ok(await dtos('POST', '/bot/crm/contacto', a))
  );

  server.tool(
    'register_expense',
    'Registra un gasto en finanzas (Google Sheets).',
    { fecha: z.string().describe('YYYY-MM-DD'), importe: z.number(), categoria: z.string(),
      entidad: z.string().describe('beneficiario'), descripcion: z.string(), cuenta: z.string().optional() },
    async (a) => ok(await dtos('POST', '/bot/sheets/gastos', a))
  );

  server.tool(
    'register_income',
    'Registra un ingreso en finanzas (Google Sheets).',
    { fecha: z.string().describe('YYYY-MM-DD'), importe: z.number(), descripcion: z.string().optional(),
      categoria: z.string().optional(), cuenta: z.string().optional(), entidad: z.string().optional() },
    async (a) => ok(await dtos('POST', '/bot/sheets/ingresos', a))
  );

  return server;
}

const app = express();
app.use(cors({ origin: '*', exposedHeaders: ['mcp-session-id'] }));
app.use(express.json({ limit: '4mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', server: 'dtos-mcp', endpoint: '/mcp/<token>' });
});

// Valida el token (en la ruta /mcp/:token o en Authorization: Bearer)
const checkAuth = (req) => {
  if (!MCP_TOKEN) return true; // sin token configurado = abierto (no recomendado)
  const fromPath = req.params.token;
  const auth = req.headers['authorization'] || '';
  const fromHeader = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return fromPath === MCP_TOKEN || fromHeader === MCP_TOKEN;
};

const handleMcp = async (req, res) => {
  if (!checkAuth(req)) {
    return res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'No autorizado' }, id: null });
  }
  try {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP error:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
};

app.all('/mcp/:token', handleMcp);
app.all('/mcp', handleMcp);

app.listen(PORT, () => {
  console.log(`dtos-mcp escuchando en puerto ${PORT} — endpoint /mcp/<token>`);
});
