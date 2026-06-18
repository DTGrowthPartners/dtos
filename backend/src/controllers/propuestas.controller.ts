import { Request, Response } from 'express';
import OpenAI from 'openai';

// Reutiliza el mismo proveedor del chat (DARIO / Claude por defecto).
const AI_BASE_URL = process.env.CHAT_AI_BASE_URL || 'http://localhost:3456/v1';
const AI_API_KEY = process.env.CHAT_AI_API_KEY || 'dario';
const AI_MODEL = process.env.PROPOSALS_AI_MODEL || process.env.CHAT_AI_MODEL || 'claude-sonnet-4-6';

const aiClient = new OpenAI({ baseURL: AI_BASE_URL, apiKey: AI_API_KEY });

// Esquema de la propuesta que renderiza el frontend con la plantilla de marca DTGP.
const PROPOSAL_SCHEMA = `{
  "cliente": "Nombre del negocio/prospecto",
  "titulo": "Título de la propuesta (ej: 'Propuesta de Agente IA', 'Propuesta E-commerce Shopify')",
  "subtitulo": "Subtítulo corto",
  "fecha": "Mes Año (ej: 'Junio 2026')",
  "resumenEjecutivo": "1-2 párrafos. Qué propone DTGP y el valor principal.",
  "diagnostico": { "intro": "Frase intro del estado actual del cliente", "puntos": ["dolor/observación", "..."] },
  "oportunidad": "Frase de oportunidad/impacto (va en caja destacada).",
  "solucion": "Párrafo describiendo la solución propuesta.",
  "capacidades": [ { "icon": "💬", "titulo": "Nombre", "descripcion": "Qué hace" } ],
  "fases": [ { "titulo": "Semana 1-2: ...", "descripcion": "Qué se hace" } ],
  "inversion": {
    "implementacion": { "items": [ { "concepto": "...", "valor": "$X" } ], "total": "$X" },
    "mensual": { "items": [ { "concepto": "...", "valor": "$X" } ], "total": "$X" },
    "oferta": "Oferta de lanzamiento opcional (o cadena vacía)"
  },
  "roi": { "texto": "Explicación del retorno", "cifras": [ { "label": "...", "valor": "$X" } ] },
  "porQue": ["Razón 1 para elegir DTGP", "..."],
  "notaPrecios": "Aclaración si los precios son estimados (o cadena vacía)"
}`;

const SYSTEM_PROMPT = `Eres un consultor comercial senior de DT Growth Partners (DTGP), agencia de marketing digital y desarrollo de software en Cartagena, Colombia (servicios: pauta/Meta Ads, desarrollo web y e-commerce Shopify, agentes de IA para WhatsApp, estrategia de crecimiento).

Tu tarea: a partir de la TRANSCRIPCIÓN de una reunión con un prospecto, redactar una propuesta comercial profesional en ESPAÑOL siguiendo el estilo de DTGP (claro, orientado a resultados, sin relleno).

Analiza la transcripción para identificar: el negocio del prospecto, sus problemas/necesidades, lo que se ofreció, el alcance, y si se mencionaron precios o presupuestos.

Devuelve ÚNICAMENTE un objeto JSON válido (sin markdown, sin texto fuera del JSON) con EXACTAMENTE este esquema:
${PROPOSAL_SCHEMA}

Reglas:
- Todo en español, montos en COP con separador de miles (ej: "$2.000.000").
- Incluye 4-7 capacidades y 3-4 fases de implementación.
- Si la transcripción menciona precios, úsalos. Si NO, propón valores estimados realistas para Colombia y explica en "notaPrecios" que son estimados a confirmar.
- Si algo no aplica (ej: no hay fee mensual), deja la sección con items vacíos ([]) y total "".
- Usa emojis simples en "icon" de capacidades.
- Sé concreto y específico al negocio del prospecto; no inventes datos que contradigan la transcripción.`;

const cleanJson = (text: string): string => {
  let t = (text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  return t;
};

export const propuestasController = {
  generate: async (req: Request, res: Response) => {
    try {
      const { transcript, cliente, notas } = req.body || {};
      if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 30) {
        return res.status(400).json({ success: false, error: 'Se requiere una transcripción (mínimo unas frases).' });
      }

      const userContent =
        `TRANSCRIPCIÓN DE LA REUNIÓN:\n${transcript.trim()}\n\n` +
        (cliente ? `CLIENTE/PROSPECTO: ${cliente}\n` : '') +
        (notas ? `NOTAS ADICIONALES: ${notas}\n` : '') +
        `\nGenera la propuesta en JSON según el esquema indicado.`;

      const completion = await aiClient.chat.completions.create({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        temperature: 0.4,
        max_tokens: 4000,
      });

      const raw = completion.choices[0]?.message?.content || '';
      let proposal: any;
      try {
        proposal = JSON.parse(cleanJson(raw));
      } catch {
        return res.status(502).json({ success: false, error: 'La IA no devolvió un JSON válido. Reintenta.' , raw: raw.slice(0, 500) });
      }

      res.json({ success: true, proposal });
    } catch (e: any) {
      const status = e?.status || e?.response?.status;
      if (status === 402) {
        return res.status(200).json({ success: false, error: 'Sin créditos de IA en este momento.' });
      }
      console.error('[propuestas] generate error:', e?.message || e);
      res.status(500).json({ success: false, error: e?.message || 'Error generando la propuesta' });
    }
  },
};

export default propuestasController;
