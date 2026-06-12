import OpenAI from 'openai';

/**
 * Cliente OpenAI apuntando a OpenRouter (mismo que /api/chat).
 * Reutilizamos OPENROUTER_API_KEY y OPENROUTER_MODEL del .env.
 */
const aiClient = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://os.dtgrowthpartners.com',
    'X-Title': 'DT-OS Tasks AI',
  },
});

const MODEL = process.env.OPENROUTER_MODEL || 'moonshotai/kimi-k2';

const TEAM_MEMBERS = ['Lía', 'Dairo', 'Stiven', 'Mariana', 'Jose', 'Anderson', 'Edgardo', 'Jhonathan'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
const TYPES = [
  'Estrategia',
  'Publicidad/Ads',
  'Contenido Orgánico',
  'Diseño',
  'Video/Multimedia',
  'Copywriting',
  'Revisión/QC',
  'Cliente/Reuniones',
] as const;

export interface ParsedTask {
  title: string;
  description: string;
  assignee: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate: string | null; // YYYY-MM-DD en zona America/Bogota
  dueTime: string | null; // HH:mm 24h
  type: string | null;
}

/** Construye el system prompt incluyendo la fecha actual de Bogotá. */
const buildSystemPrompt = (): string => {
  const nowBogota = new Date().toLocaleString('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'long',
    hour12: false,
  });

  return `Eres un asistente que extrae información estructurada de descripciones de tareas en español.

CONTEXTO TEMPORAL:
- Ahora mismo es: ${nowBogota} (zona horaria America/Bogota, UTC-5)
- Cuando el usuario diga fechas relativas ("mañana", "el lunes", "en 2 días", "hoy", "pasado mañana"), calcula la fecha exacta basándote en esta fecha.

EQUIPO DISPONIBLE (debes asignar SOLO con el nombre exacto de esta lista, respetando tildes):
${TEAM_MEMBERS.map((m) => `- ${m}`).join('\n')}
Variantes aceptadas: "Lia" → "Lía", "Jhonatan" → "Jhonathan".

PRIORIDADES VÁLIDAS: ${PRIORITIES.join(', ')}.
Reglas:
- HIGH si dice: "urgente", "lo antes posible", "ASAP", "crítico", "para hoy", "prioridad".
- LOW si dice: "cuando puedas", "sin prisa", "low", "no urgente".
- MEDIUM por defecto.

TIPOS VÁLIDOS: ${TYPES.join(', ')}.
Reglas:
- Si menciona "reunión", "cita", "llamada" → Cliente/Reuniones
- Si menciona "diseño", "logo", "banner" → Diseño
- Si menciona "video", "edición" → Video/Multimedia
- Si menciona "copy", "texto", "guión" → Copywriting
- Si menciona "campaña", "ads", "anuncio" → Publicidad/Ads
- Si menciona "reporte", "QC", "revisar" → Revisión/QC
- Si menciona "contenido", "post", "Instagram", "TikTok" → Contenido Orgánico
- Si no se infiere claramente, null.

INSTRUCCIONES DE SALIDA:
Responde EXCLUSIVAMENTE con un objeto JSON válido (sin texto antes o después, sin markdown, sin \`\`\`). El JSON debe tener exactamente estos campos:
{
  "title": string (máx. 80 caracteres, corto y accionable),
  "description": string (descripción extendida o vacío "" si no hay contexto extra),
  "assignee": string del equipo exacto o null,
  "priority": "LOW" | "MEDIUM" | "HIGH",
  "dueDate": "YYYY-MM-DD" o null,
  "dueTime": "HH:mm" (24h) o null,
  "type": uno de la lista de TIPOS o null
}`;
};

const SCHEMA_FALLBACK: ParsedTask = {
  title: '',
  description: '',
  assignee: null,
  priority: 'MEDIUM',
  dueDate: null,
  dueTime: null,
  type: null,
};

const normalizeAssignee = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;
  // Match case-insensitive con variantes acentuadas
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const target = norm(cleaned);
  const hit = TEAM_MEMBERS.find((m) => norm(m) === target);
  return hit || null;
};

const normalizePriority = (raw: unknown): 'LOW' | 'MEDIUM' | 'HIGH' => {
  if (typeof raw === 'string') {
    const upper = raw.toUpperCase();
    if (upper === 'LOW' || upper === 'MEDIUM' || upper === 'HIGH') return upper;
  }
  return 'MEDIUM';
};

const normalizeType = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const hit = TYPES.find((t) => t.toLowerCase() === raw.toLowerCase());
  return hit || null;
};

const isValidDate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

const isValidTime = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);

const sanitize = (raw: any): ParsedTask => ({
  title: typeof raw?.title === 'string' ? raw.title.slice(0, 80) : '',
  description: typeof raw?.description === 'string' ? raw.description : '',
  assignee: normalizeAssignee(raw?.assignee),
  priority: normalizePriority(raw?.priority),
  dueDate: isValidDate(raw?.dueDate) ? raw.dueDate : null,
  dueTime: isValidTime(raw?.dueTime) ? raw.dueTime : null,
  type: normalizeType(raw?.type),
});

export const parseTaskFromText = async (text: string): Promise<ParsedTask> => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw Object.assign(new Error('OpenRouter API key no configurada'), { status: 500 });
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return SCHEMA_FALLBACK;
  }

  const completion = await aiClient.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: trimmed },
    ],
    temperature: 0.2,
    max_tokens: 400,
  });

  const content = completion.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw Object.assign(new Error('La IA no devolvió contenido'), { status: 502 });
  }

  // Intento de parse — algunos modelos a veces envuelven en ```json
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      throw Object.assign(new Error(`Respuesta no es JSON: ${content.slice(0, 200)}`), { status: 502 });
    }
    parsed = JSON.parse(match[0]);
  }

  return sanitize(parsed);
};
