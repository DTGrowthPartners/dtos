import { Request, Response } from 'express';
import OpenAI from 'openai';
import axios from 'axios';
import { AI_TOOLS } from '../config/aiTools';
import { AIToolsService } from '../services/aiTools.service';

// Cliente de IA del chat.
// Por defecto apunta a DARIO (proxy local que usa la suscripción de Claude, sin costo
// por token). DARIO escucha en localhost:3456 y expone endpoints compatibles con OpenAI.
// Se puede sobreescribir por env para volver a OpenRouter u otro proveedor.
const AI_BASE_URL = process.env.CHAT_AI_BASE_URL || "http://localhost:3456/v1";
const AI_API_KEY = process.env.CHAT_AI_API_KEY || "dario";
const AI_MODEL = process.env.CHAT_AI_MODEL || "claude-sonnet-4-6";

// Modo de uso de herramientas (acceso al sistema):
//  - 'json'   : << default >> protocolo acción-JSON sobre texto. María indica una
//               llamada {metodo, ruta, datos} a la API interna de webhooks /bot/* y
//               el backend la ejecuta. Funciona con DARIO siempre que el encuadre sea
//               legítimo (María como asistente interna, no "actúa como otro sistema").
//  - 'native' : function-calling nativo vía tool_calls (requiere proveedor con tools,
//               p. ej. OpenRouter).
//  - 'off'    : solo conversación, sin acceso al sistema.
const TOOLS_MODE = (process.env.CHAT_TOOLS_MODE || "json").toLowerCase();

const aiClient = new OpenAI({
  baseURL: AI_BASE_URL,
  apiKey: AI_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://os.dtgrowthpartners.com",
    "X-Title": "DT Growth Hub",
  },
});

// Catálogo de la API interna de webhooks que María puede usar (modo 'json').
// Resumen de docs/BOT_WEBHOOKS_API.md (rutas bajo /bot, ejecutadas por el backend).
const WEBHOOK_CATALOG = `CONSULTAS (GET):
- /bot/team — miembros válidos del equipo
- /bot/projects — proyectos activos
- /bot/tasks?usuario=<nombre>&estado=<todo|in_progress|done> — tareas de alguien
- /bot/tasks/all — tareas pendientes de todo el equipo
- /bot/clients  ·  /bot/clients/:id — clientes y su detalle
- /bot/finances?mes=<enero|febrero|...> — resumen financiero del mes
- /bot/sheets/transacciones?tipo=<entrada|salida|all> — movimientos
- /bot/client-goals?mes=<...> — metas por cliente
- /bot/campaigns?client=<nombre> — campañas y métricas
- /bot/crm  ·  /bot/crm/deals — pipeline y oportunidades
- /bot/terceros — terceros (clientes/proveedores/empleados)
- /bot/invoices — cuentas de cobro. Para enviar el PDF NO pegues rutas ni links de descarga: solo identifica la cuenta (número/cliente) y el sistema adjunta el PDF automáticamente

ACCIONES (POST/PATCH):
- POST /bot/clients — crear cliente. datos: { nombre (req), email, nit, telefono, direccion }
- POST /bot/tasks — crear tarea. datos: { titulo (req), asignado, prioridad: baja|media|alta, descripcion, proyecto, fechaFin: YYYY-MM-DD, creador }
- PATCH /bot/tasks/:id — actualizar tarea. datos: { estado: todo|in_progress|done, prioridad, asignado }
- POST /bot/crm/deals — crear deal. datos: { nombre (req), empresa, telefono, valorEstimado, etapa, prioridad }
- PATCH /bot/crm/deals/:id — actualizar deal
- POST /bot/sheets/gastos — registrar gasto. datos: { fecha (req), importe (req), categoria (req), entidad (req), descripcion (req), cuenta }
- POST /bot/sheets/ingresos — registrar ingreso. datos: { fecha (req), importe (req), categoria, cuenta, entidad }
- POST /bot/terceros — crear tercero
- POST /bot/invoices/generate — generar cuenta de cobro. El sistema adjunta el PDF automáticamente; solo confirma al usuario los datos (cliente, número, total). No pegues links.

CONTEXTO ACTUAL DEL SISTEMA (jul 2026):
- Cada cliente puede tener SEDES (sucursales físicas: nombre, dirección, ciudad, teléfono) y varios CONTACTOS (terceros con cargo: gerencia, contador, etc.).
- Los SERVICIOS se cobran como MRR (recurrente: mensual/quincenal/semanal/…) o como PROYECTO (pago único). El total recurrente de un cliente es su MRR; el total de proyectos es el IPP (Ingreso Por Proyecto).
- Servicio unificado: "Gestión de campañas publicitarias en Meta Ads" (antes "Gestión de pautas publicitarias").
- Las cuentas de cobro se pueden amarrar al servicio que facturan (campo serviceId).
- El panel de Clientes muestra saldo pendiente y finanzas desde las Facturas reales (no desde Cobros).`;

// Extrae una llamada a la API interna en JSON dentro del texto del modelo.
// Forma esperada: {"metodo":"POST","ruta":"/bot/tasks","datos":{...}} (acepta alias).
function parseAction(text: string): { metodo: string; ruta: string; datos: any } | null {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const tryParse = (s: string) => {
    try { return JSON.parse(s); } catch { return null; }
  };
  let obj: any = tryParse(t);
  if (!obj) {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) obj = tryParse(m[0]);
  }
  if (obj && typeof obj === "object" && typeof obj.ruta === "string") {
    return {
      metodo: String(obj.metodo || obj.method || "GET").toUpperCase(),
      ruta: obj.ruta,
      datos: obj.datos || obj.body || obj.data || {},
    };
  }
  return null;
}

// Limpia restos de sintaxis de herramientas de Claude que la capa OpenAI de DARIO
// puede filtrar como texto plano, y los bloques de "pensamiento".
function cleanResponse(text: string): string {
  let out = text || "";
  if (out.includes("</think>")) {
    out = out.split("</think>").pop()?.trim() || out;
  }
  out = out
    .replace(/<function_calls>[\s\S]*?<\/function_calls>/g, "")
    .replace(/<\/?(invoke|parameter|function_calls|antml:[a-z_]+)[^>]*>/g, "")
    .trim();
  return out;
}

// DARIO no acepta imágenes por la capa OpenAI (image_url); sí por la API nativa
// Anthropic (/v1/messages con bloques 'image'). Esta función hace una pasada de
// visión: extrae a TEXTO los datos útiles de las imágenes para que luego el bucle
// de acciones (texto) pueda crear registros (clientes, prospectos, cuentas, etc.).
async function extractFromImages(images: string[], userMsg: string): Promise<string> {
  const blocks: any[] = [
    {
      type: 'text',
      text:
        `Analiza la(s) imagen(es) y extrae TODA la información útil para registrar datos en DTOS ` +
        `(p. ej. datos de cliente/prospecto: nombre/empresa, NIT o cédula, teléfono, email, dirección, ciudad; ` +
        `o datos de una cuenta de cobro/factura: cliente, concepto, montos, fechas, NIT; o cualquier dato relevante). ` +
        `Transcribe el texto visible y resume los datos de forma clara y estructurada. ` +
        (userMsg ? `Contexto del usuario: "${userMsg}". ` : '') +
        `Responde solo con la información extraída, sin preámbulos.`,
    },
  ];
  for (const img of images.slice(0, 5)) {
    const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(img || '');
    if (!m) continue;
    if (m[2].length > 9_000_000) continue; // ~6.7MB por imagen, salta las enormes
    blocks.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
  }
  if (blocks.length === 1) return ''; // no había imágenes válidas

  const resp = await axios.post(
    `${AI_BASE_URL}/messages`,
    { model: AI_MODEL, max_tokens: 1500, messages: [{ role: 'user', content: blocks }] },
    {
      headers: { 'x-api-key': AI_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      timeout: 120000,
    }
  );
  const content = resp.data?.content || [];
  return content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
}

// Handle AI API errors with friendly messages
function handleAIError(error: any, res: Response) {
  console.error('[Chat] Error:', error);
  const status = error?.status || error?.response?.status;
  if (status === 402) {
    return res.status(200).json({
      success: true,
      response: '⚠️ Los créditos de IA del mes se agotaron. El servicio se renueva automáticamente el próximo mes. Contacta al administrador si necesitas acceso inmediato.',
      creditsDepleted: true,
    });
  }
  if (status === 429) {
    return res.status(200).json({
      success: true,
      response: '⏳ Demasiadas solicitudes al asistente. Espera unos segundos e intenta de nuevo.',
      rateLimited: true,
    });
  }
  return res.status(500).json({
    success: false,
    error: error.message || 'Error al procesar el mensaje',
  });
}

export class ChatController {
  // Send a message to AI and get a response
  async sendMessage(req: Request, res: Response) {
    try {
      const { message, conversationHistory } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Message is required and must be a string'
        });
      }

      console.log('[Chat] Processing message:', message);

      // Build messages array with conversation history
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      // Add conversation history if provided
      if (conversationHistory && Array.isArray(conversationHistory)) {
        messages.push(...conversationHistory);
      }

      // Add current user message
      messages.push({ role: "user", content: message });

      // Call AI via OpenRouter
      const completion = await aiClient.chat.completions.create({
        model: AI_MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000,
      });

      const response = cleanResponse(completion.choices[0].message.content || '');

      console.log('[Chat] Response generated successfully');

      res.json({
        success: true,
        response: response,
        usage: completion.usage,
      });

    } catch (error: any) {
      return handleAIError(error, res);
    }
  }

  // Analyze an image with AI vision capabilities
  async analyzeImage(req: Request, res: Response) {
    try {
      const { imageUrl, prompt } = req.body;

      if (!imageUrl || !prompt) {
        return res.status(400).json({
          success: false,
          error: 'Image URL and prompt are required'
        });
      }

      console.log('[Chat] Analyzing image:', imageUrl);

      const completion = await aiClient.chat.completions.create({
        model: AI_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      });

      const response = cleanResponse(completion.choices[0].message.content || '');

      console.log('[Chat] Image analysis completed');

      res.json({
        success: true,
        response: response,
        usage: completion.usage,
      });

    } catch (error: any) {
      return handleAIError(error, res);
    }
  }

  // Send a message to AI with Function Calling (tools) support
  async sendMessageWithTools(req: Request, res: Response) {
    try {
      const { message, conversationHistory, images } = req.body;
      const userId = (req as any).user.userId;

      const hasImages = Array.isArray(images) && images.length > 0;
      if ((!message || typeof message !== 'string') && !hasImages) {
        return res.status(400).json({
          success: false,
          error: 'Message is required and must be a string'
        });
      }

      // Si hay imágenes adjuntas, primero se extrae su contenido a texto (visión)
      // y se antepone al mensaje para que el bucle de acciones pueda usarlo.
      let effectiveMessage = typeof message === 'string' ? message : '';
      if (hasImages) {
        try {
          const extracted = await extractFromImages(images, effectiveMessage);
          if (extracted) {
            effectiveMessage =
              `[Contenido extraído de imagen(es) adjuntas]:\n${extracted}\n\n` +
              (effectiveMessage ? `Mensaje del usuario: ${effectiveMessage}` : 'El usuario adjuntó la(s) imagen(es) anterior(es). Actúa según corresponda (crear registro, responder, etc.).');
          }
        } catch (e: any) {
          console.error('[Chat] Error procesando imágenes:', e?.message || e);
        }
      }

      console.log('[Chat] Processing message with tools:', message, 'for user:', userId);

      const aiToolsService = new AIToolsService();
      const styleGuide = `FORMATO de la respuesta final al usuario:
- Sé concisa y directa; ve al grano.
- Usa SALTOS DE LÍNEA reales para separar ideas; NO escribas todo en un solo párrafo.
- Para enumerar, pon cada punto en su PROPIA LÍNEA empezando con "- " (una idea por línea). No numeres con "1." pegado al texto en un párrafo.
- Puedes usar **negrita** para resaltar un título corto o un dato clave. NO uses tablas, NI encabezados markdown (#), NI emojis excesivos.
- Si hay muchos datos, resume con los números clave y ofrece detallar después.
- Tono natural, como una compañera de equipo.`;

      // ===== Modo 'off': solo conversación, sin acceso al sistema =====
      if (TOOLS_MODE === 'off') {
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          {
            role: 'system',
            content: `Eres María, la asistente de DT Growth Partners. Responde de forma conversacional. No tienes acceso directo a los datos del sistema; si piden cifras exactas, acláralo y sugiere dónde verlas en DTOS.\n\n${styleGuide}`,
          },
        ];
        if (conversationHistory && Array.isArray(conversationHistory)) messages.push(...conversationHistory);
        messages.push({ role: 'user', content: effectiveMessage });
        const completion = await aiClient.chat.completions.create({ model: AI_MODEL, messages, temperature: 0.7, max_tokens: 2000 });
        return res.json({ success: true, response: cleanResponse(completion.choices[0].message.content || ''), usage: completion.usage });
      }

      // ===== Modo 'native': function-calling vía tool_calls (p. ej. OpenRouter) =====
      if (TOOLS_MODE === 'native') {
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          {
            role: 'system',
            content: `Eres María, la asistente de DT Growth Partners. Tienes acceso a datos del sistema mediante herramientas.\n\n${styleGuide}`,
          },
        ];
        if (conversationHistory && Array.isArray(conversationHistory)) messages.push(...conversationHistory);
        messages.push({ role: 'user', content: effectiveMessage });

        const MAX_ITERATIONS = 6;
        for (let it = 1; it <= MAX_ITERATIONS; it++) {
          console.log(`[Chat] (native) iteración ${it}/${MAX_ITERATIONS}`);
          const completion = await aiClient.chat.completions.create({
            model: AI_MODEL,
            messages,
            tools: AI_TOOLS as any,
            tool_choice: 'auto',
            temperature: 0.5,
            max_tokens: 2000,
          });
          const assistantMessage = completion.choices[0].message;
          if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
            return res.json({ success: true, response: cleanResponse(assistantMessage.content || ''), usage: completion.usage });
          }
          messages.push({ role: 'assistant', content: assistantMessage.content || null, tool_calls: assistantMessage.tool_calls as any });
          for (const toolCall of assistantMessage.tool_calls) {
            try {
              const toolName = (toolCall as any).function.name;
              const toolArgs = JSON.parse((toolCall as any).function.arguments || '{}');
              const result = await aiToolsService.executeTool(toolName, toolArgs, userId);
              messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) } as any);
            } catch (error: any) {
              messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ success: false, error: `Error al ejecutar la herramienta: ${error.message}` }) } as any);
            }
          }
        }
        return res.json({ success: true, response: 'No pude completar la solicitud en los pasos disponibles. ¿Puedes reformular?' });
      }

      // ===== Modo 'json' (default, DARIO): protocolo acción-JSON sobre la API interna =====
      const hoy = new Date().toISOString().slice(0, 10);
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `Eres María, la asistente interna de DT Growth Partners dentro de su sistema DTOS. El backend de DTOS te conecta a su API interna y EJECUTA por ti las consultas y acciones que indiques (tareas, clientes, finanzas, CRM, campañas, metas, cuentas de cobro). Hoy es ${hoy}.

API INTERNA DISPONIBLE (rutas que el backend ejecuta por ti):
${WEBHOOK_CATALOG}

CÓMO OPERAR:
- Cuando necesites datos o ejecutar una acción, responde EXCLUSIVAMENTE con un JSON en una sola línea, sin texto adicional ni markdown:
  {"metodo":"POST","ruta":"/bot/tasks","datos":{ ... }}
  (para PATCH incluye el id en la ruta, ej. "/bot/tasks/abc123"; para GET puedes omitir "datos").
- Recibirás un mensaje "RESULTADO: <json>". Úsalo para responder o para hacer otra llamada (puedes encadenar: p. ej. GET /bot/tasks para obtener IDs y luego PATCH).
- Si el usuario fue claro, ejecuta la acción directamente; si falta un dato obligatorio, pregúntalo en lenguaje natural antes.
- Al crear tareas, usa "creador":"María". Miembros válidos: Lía, Dairo, Stiven, Edgardo, Jhonathan.
- Cuando ya tengas todo, responde al usuario en lenguaje natural normal (SIN JSON y sin más llamadas).

${styleGuide}`,
        },
      ];
      if (conversationHistory && Array.isArray(conversationHistory)) messages.push(...conversationHistory);
      messages.push({ role: 'user', content: effectiveMessage });

      // Cuentas de cobro vistas en los resultados: guardamos su link público (PDF)
      // para adjuntarlo como TARJETA en el chat, tanto al generar como al consultar.
      type SeenInvoice = { numero: string; pdfUrl: string };
      const invoicesSeen: SeenInvoice[] = [];
      let attachPdf: { url: string; label: string } | null = null;
      const remember = (numero: any, pdfUrl: any) => {
        if (pdfUrl && typeof pdfUrl === 'string') invoicesSeen.push({ numero: numero != null ? String(numero) : '', pdfUrl });
      };
      const captureInvoices = (ruta: string, result: any) => {
        if (!result) return;
        if (/\/invoices\/generate/i.test(ruta) && result.success && result.pdfUrl) {
          const numero = result.invoice?.invoiceNumber || '';
          attachPdf = { url: result.pdfUrl, label: `Cuenta de cobro ${numero}`.trim() };
          remember(numero, result.pdfUrl);
        }
        if (Array.isArray(result.invoices)) for (const inv of result.invoices) remember(inv.numero || inv.invoiceNumber, inv.pdfUrl);
        if (result.invoice?.pdfUrl) remember(result.invoice.invoiceNumber, result.invoice.pdfUrl);
      };

      // Respuesta final: quita el link crudo del endpoint interno (requiere API key,
      // no le sirve al usuario) y adjunta el PDF como tarjeta {{pdf:url|label}}.
      const finalizeResponse = (text: string): string => {
        let t = cleanResponse(text)
          .replace(/`?\/?api\/webhook\/bot\/invoices\/[^\s`)]+`?/gi, '')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        let pick = attachPdf;
        if (!pick && invoicesSeen.length) {
          const m = invoicesSeen.find((i) => i.numero && t.includes(i.numero)) || (invoicesSeen.length === 1 ? invoicesSeen[0] : null);
          if (m) pick = { url: m.pdfUrl, label: `Cuenta de cobro ${m.numero}`.trim() };
        }
        if (pick && !t.includes(pick.url)) t = `${t}\n\n{{pdf:${pick.url}|${pick.label}}}`;
        return t;
      };

      const MAX_STEPS = 6;
      for (let step = 1; step <= MAX_STEPS; step++) {
        console.log(`[Chat] (json) paso ${step}/${MAX_STEPS}`);
        const completion = await aiClient.chat.completions.create({ model: AI_MODEL, messages, temperature: 0.3, max_tokens: 1500 });
        const content = completion.choices[0].message.content || '';
        const action = parseAction(content);
        if (!action) {
          return res.json({ success: true, response: finalizeResponse(content), usage: completion.usage });
        }
        console.log(`[Chat] (json) ejecutando ${action.metodo} ${action.ruta}`, action.datos);
        messages.push({ role: 'assistant', content });
        let result: any;
        try {
          result = await aiToolsService.callWebhook(action.metodo, action.ruta, action.datos);
        } catch (error: any) {
          result = { success: false, error: error.message || 'Error al ejecutar la acción' };
        }
        captureInvoices(action.ruta, result);
        messages.push({ role: 'user', content: `RESULTADO: ${JSON.stringify(result).slice(0, 6000)}` });
      }

      // Se agotaron los pasos: pedir una respuesta final con lo que haya.
      messages.push({ role: 'user', content: 'Responde ahora al usuario en lenguaje natural con la información que ya tienes. No hagas más llamadas.' });
      const finalCompletion = await aiClient.chat.completions.create({ model: AI_MODEL, messages, temperature: 0.3, max_tokens: 1500 });
      return res.json({ success: true, response: finalizeResponse(finalCompletion.choices[0].message.content || ''), usage: finalCompletion.usage });

    } catch (error: any) {
      return handleAIError(error, res);
    }
  }
}
