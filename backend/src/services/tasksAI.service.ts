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
/**
 * Cadena de modelos gratuitos para intentar en orden cuando el principal falla
 * por creditos (402) o rate limit (429). Los models :free de OpenRouter tienen
 * cuotas estrictas que se rotan por minuto y por dia, asi que tener varios
 * candidatos da resilencia.
 */
const MODEL_FALLBACK_CHAIN: string[] = (process.env.OPENROUTER_MODEL_FALLBACK_CHAIN || [
  'openai/gpt-oss-120b:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-4-31b-it:free',
].join(',')).split(',').map((s) => s.trim()).filter(Boolean);

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

/** System prompt compacto — minimiza tokens de entrada (OpenRouter cobra por max_tokens upfront). */
const buildSystemPrompt = (): string => {
  // Solo necesitamos YYYY-MM-DD y dia de la semana para que la AI calcule fechas relativas.
  const nowBogota = new Date().toLocaleString('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  return `Extrae JSON de la tarea descrita por el usuario. Hoy: ${nowBogota} (America/Bogota).
Equipo (usa nombre exacto, Lia=Lía, Jhonatan=Jhonathan): ${TEAM_MEMBERS.join(', ')}.
Prioridad: HIGH si "urgente/ASAP/crítico", LOW si "sin prisa/cuando puedas", sino MEDIUM.
Tipo: ${TYPES.join(' | ')} o null.
Responde SOLO JSON: {"title":"max 80c","description":"contexto o \\"\\"","assignee":"nombre o null","priority":"LOW|MEDIUM|HIGH","dueDate":"YYYY-MM-DD o null","dueTime":"HH:mm o null","type":"tipo o null"}`;
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

/**
 * Llama al modelo con la cadena de fallback (principal -> modelos gratis) y
 * devuelve el contenido de texto. Centraliza el manejo de errores de OpenRouter.
 */
const chatComplete = async (systemPrompt: string, userContent: string, maxTokens: number): Promise<string> => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw Object.assign(new Error('OpenRouter API key no configurada'), { status: 500 });
  }
  const callModel = (model: string) =>
    aiClient.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.2,
      max_tokens: maxTokens,
    });

  const modelChain = [MODEL, ...MODEL_FALLBACK_CHAIN.filter((m) => m !== MODEL)];
  let completion: Awaited<ReturnType<typeof callModel>> | null = null;
  let lastErr: any = null;

  for (const model of modelChain) {
    try {
      completion = await callModel(model);
      if (model !== MODEL) console.warn(`[tasks-ai] usado fallback ${model} (principal ${MODEL} no disponible)`);
      break;
    } catch (err: any) {
      lastErr = err;
      const status = err?.status || err?.response?.status;
      if (status !== 402 && status !== 429 && status !== 503 && status !== 404) break;
      console.warn(`[tasks-ai] ${model} fallo con ${status}, probando siguiente...`);
    }
  }

  if (!completion) {
    const status = lastErr?.status || lastErr?.response?.status;
    if (status === 402) {
      throw Object.assign(
        new Error('Sin créditos en OpenRouter y todos los modelos gratuitos están saturados. Recarga la cuenta o espera unos minutos: https://openrouter.ai/settings/credits'),
        { status: 402 }
      );
    }
    if (status === 429) throw Object.assign(new Error('Todos los modelos disponibles están saturados (rate limit). Intenta en unos segundos.'), { status: 429 });
    if (status === 401 || status === 403) throw Object.assign(new Error('OPENROUTER_API_KEY inválida o sin permisos.'), { status: 502 });
    if (status === 400) throw Object.assign(new Error('El modelo rechazó la petición. Probable: contexto demasiado largo.'), { status: 502 });
    throw lastErr || new Error('No se pudo conectar con ningún modelo de IA');
  }

  const content = completion.choices?.[0]?.message?.content?.trim();
  if (!content) throw Object.assign(new Error('La IA no devolvió contenido'), { status: 502 });
  return content;
};

export const parseTaskFromText = async (text: string): Promise<ParsedTask> => {
  const trimmed = text.trim();
  if (!trimmed) return SCHEMA_FALLBACK;

  const content = await chatComplete(buildSystemPrompt(), trimmed, 250);

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw Object.assign(new Error(`Respuesta no es JSON: ${content.slice(0, 200)}`), { status: 502 });
    parsed = JSON.parse(match[0]);
  }
  return sanitize(parsed);
};

/** System prompt para interpretar una LISTA de tareas (bullets pegados). */
const buildListSystemPrompt = (): string => {
  const nowBogota = new Date().toLocaleString('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  return `Recibes una LISTA de tareas (vienen como bullets/lineas, a veces cortas o informales). Para CADA item genera una tarea limpia y accionable.
Hoy: ${nowBogota} (America/Bogota).
Reglas:
- Reescribe el titulo para que sea claro y accionable (empieza con verbo), max 80 chars. Ej: "audios bot dairo" -> "Grabar audios para el bot de Dairo".
- Equipo (usa nombre exacto, Lia=Lía, Jhonatan=Jhonathan): ${TEAM_MEMBERS.join(', ')}. Si el item menciona a alguien, asignalo; sino assignee=null.
- Prioridad: HIGH si "urgente/ASAP/hoy/ya", LOW si "sin prisa/cuando puedas", sino MEDIUM.
- Tipo: ${TYPES.join(' | ')} o null.
- dueDate "YYYY-MM-DD" o null; dueTime "HH:mm" o null.
- NO inventes items que no esten en la lista. Un item = una tarea.
Responde SOLO un JSON: {"tasks":[{"title","description","assignee","priority","dueDate","dueTime","type"}, ...]} sin texto extra ni markdown.`;
};

export const parseTaskListFromText = async (text: string): Promise<ParsedTask[]> => {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // max_tokens generoso porque son varias tareas; cap por seguridad.
  const content = await chatComplete(buildListSystemPrompt(), trimmed, 1500);

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw Object.assign(new Error(`Respuesta no es JSON: ${content.slice(0, 200)}`), { status: 502 });
    parsed = JSON.parse(match[0]);
  }

  const arr = Array.isArray(parsed?.tasks) ? parsed.tasks : Array.isArray(parsed) ? parsed : [];
  return arr
    .map((t: any) => sanitize(t))
    .filter((t: ParsedTask) => t.title.trim().length > 0)
    .slice(0, 40); // cap defensivo
};
