import { Request, Response } from 'express';
import OpenAI from 'openai';
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
//  - 'off'    : solo conversación, sin acceso al sistema. << default con DARIO >>
//               DARIO replica el wire de Claude Code, que RECHAZA por diseño
//               cualquier protocolo de herramientas/persona (lo trata como prompt
//               injection). Por eso con DARIO el acceso al sistema no es posible.
//  - 'native' : function-calling nativo vía tool_calls. Requiere un proveedor con
//               tools (p. ej. OpenRouter) — habilita acceso real a datos/acciones.
//  - 'json'   : protocolo acción-JSON sobre texto. Útil solo con modelos sin
//               guardarraíles de Claude Code (NO funciona con DARIO).
const TOOLS_MODE = (process.env.CHAT_TOOLS_MODE || "off").toLowerCase();

const aiClient = new OpenAI({
  baseURL: AI_BASE_URL,
  apiKey: AI_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://os.dtgrowthpartners.com",
    "X-Title": "DT Growth Hub",
  },
});

// Catálogo de herramientas en texto, derivado de AI_TOOLS (para el modo 'json').
function buildToolsCatalog(): string {
  return (AI_TOOLS as any[])
    .map((t) => {
      const f = t.function;
      const props = f.parameters?.properties || {};
      const required: string[] = f.parameters?.required || [];
      const params = Object.entries(props)
        .map(([k, v]: any) => {
          const req = required.includes(k) ? " (requerido)" : "";
          const enumTxt = v.enum ? ` opciones: ${v.enum.join(", ")}` : "";
          return `    · ${k}${req}: ${v.description || ""}${enumTxt}`;
        })
        .join("\n");
      return `- ${f.name}: ${f.description}\n${params}`;
    })
    .join("\n");
}

// Detecta y extrae una llamada a herramienta en formato JSON dentro del texto del modelo.
function parseToolCall(text: string): { tool: string; args: any } | null {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const tryParse = (s: string) => {
    try { return JSON.parse(s); } catch { return null; }
  };
  let obj = tryParse(t);
  if (!obj) {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) obj = tryParse(m[0]);
  }
  if (obj && typeof obj === "object" && typeof obj.tool === "string") {
    return { tool: obj.tool, args: obj.args || obj.arguments || {} };
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
      const { message, conversationHistory } = req.body;
      const userId = (req as any).user.userId;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Message is required and must be a string'
        });
      }

      console.log('[Chat] Processing message with tools:', message, 'for user:', userId);

      const aiToolsService = new AIToolsService();
      const styleGuide = `IMPORTANTE - Estilo de la respuesta final al usuario:
- CONCISA y DIRECTA, máximo 3-4 líneas
- NO uses tablas markdown ni emojis excesivos
- Si hay muchos datos, resume con números clave y ofrece detallar después
- Conversacional y natural, como un compañero de equipo`;

      // ===== Modo 'off': solo conversación, sin acceso al sistema =====
      if (TOOLS_MODE === 'off') {
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          {
            role: 'system',
            content: `Eres DARIO, el asistente de DT Growth Partners. Responde de forma conversacional. No tienes acceso directo a los datos del sistema; si piden cifras exactas, acláralo y sugiere dónde verlas en DTOS.\n\n${styleGuide}`,
          },
        ];
        if (conversationHistory && Array.isArray(conversationHistory)) messages.push(...conversationHistory);
        messages.push({ role: 'user', content: message });
        const completion = await aiClient.chat.completions.create({ model: AI_MODEL, messages, temperature: 0.7, max_tokens: 2000 });
        return res.json({ success: true, response: cleanResponse(completion.choices[0].message.content || ''), usage: completion.usage });
      }

      // ===== Modo 'native': function-calling vía tool_calls (p. ej. OpenRouter) =====
      if (TOOLS_MODE === 'native') {
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          {
            role: 'system',
            content: `Eres DARIO, el asistente de DT Growth Partners. Tienes acceso a datos del sistema mediante herramientas.\n\n${styleGuide}`,
          },
        ];
        if (conversationHistory && Array.isArray(conversationHistory)) messages.push(...conversationHistory);
        messages.push({ role: 'user', content: message });

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

      // ===== Modo 'json' (default, DARIO): protocolo acción-JSON sobre texto =====
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `Eres DARIO, el asistente inteligente de DT Growth Partners con acceso real al sistema DTOS (tareas, clientes, finanzas, CRM, campañas, metas).

HERRAMIENTAS DISPONIBLES:
${buildToolsCatalog()}

CÓMO USAR LAS HERRAMIENTAS:
- Si necesitas datos del sistema o ejecutar una acción (crear/actualizar), responde ÚNICAMENTE con un objeto JSON en una sola línea, SIN texto adicional y SIN markdown:
  {"tool":"<nombre>","args":{ ... }}
- Recibirás un mensaje "RESULTADO de <tool>: <json>". Úsalo para responder o para llamar otra herramienta.
- Puedes encadenar herramientas (ej.: getTasks para obtener los IDs y luego updateTask con esos IDs).
- Para crear o actualizar: si el usuario fue claro, ejecútalo; si fue ambiguo, pregunta antes.
- Cuando ya tengas todo, responde al usuario en lenguaje natural normal (SIN JSON y sin llamar más herramientas).

Miembros del equipo válidos: Lía, Dairo, Stiven, Edgardo, Jhonathan.

${styleGuide}`,
        },
      ];
      if (conversationHistory && Array.isArray(conversationHistory)) messages.push(...conversationHistory);
      messages.push({ role: 'user', content: message });

      const MAX_STEPS = 6;
      for (let step = 1; step <= MAX_STEPS; step++) {
        console.log(`[Chat] (json-tools) paso ${step}/${MAX_STEPS}`);
        const completion = await aiClient.chat.completions.create({ model: AI_MODEL, messages, temperature: 0.3, max_tokens: 1500 });
        const content = completion.choices[0].message.content || '';
        const call = parseToolCall(content);
        if (!call) {
          return res.json({ success: true, response: cleanResponse(content), usage: completion.usage });
        }
        console.log(`[Chat] (json-tools) ejecutando ${call.tool}`, call.args);
        messages.push({ role: 'assistant', content });
        let result: any;
        try {
          result = await aiToolsService.executeTool(call.tool, call.args || {}, userId);
        } catch (error: any) {
          result = { success: false, error: error.message || 'Error al ejecutar la herramienta' };
        }
        messages.push({ role: 'user', content: `RESULTADO de ${call.tool}: ${JSON.stringify(result).slice(0, 6000)}` });
      }

      // Se agotaron los pasos: pedir una respuesta final con lo que haya.
      messages.push({ role: 'user', content: 'Responde ahora al usuario en lenguaje natural con la información que ya tienes. No llames más herramientas.' });
      const finalCompletion = await aiClient.chat.completions.create({ model: AI_MODEL, messages, temperature: 0.3, max_tokens: 1500 });
      return res.json({ success: true, response: cleanResponse(finalCompletion.choices[0].message.content || ''), usage: finalCompletion.usage });

    } catch (error: any) {
      return handleAIError(error, res);
    }
  }
}
