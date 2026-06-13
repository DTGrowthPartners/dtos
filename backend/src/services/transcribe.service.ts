import OpenAI, { toFile } from 'openai';

/**
 * Cliente OpenAI dedicado a transcripcion (Whisper). Es SEPARADO del cliente de
 * chat (que apunta a OpenRouter); Whisper requiere la API oficial de OpenAI.
 */
let client: OpenAI | null = null;
const getClient = (): OpenAI => {
  if (!process.env.OPENAI_API_KEY) {
    throw Object.assign(new Error('OPENAI_API_KEY no configurada para transcripcion'), { status: 500 });
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
};

const MODEL = process.env.WHISPER_MODEL || 'whisper-1';

/** Mapea mime a una extension de archivo que Whisper acepta. */
const extFromMime = (mime: string): string => {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  return 'webm';
};

/**
 * Transcribe audio (base64) a texto con Whisper.
 * @param audioBase64 audio en base64 (sin el prefijo data:)
 * @param mimeType    mime del audio grabado (ej. audio/webm)
 */
export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
  const oa = getClient();
  const buffer = Buffer.from(audioBase64, 'base64');
  if (buffer.length === 0) {
    throw Object.assign(new Error('Audio vacío'), { status: 400 });
  }
  // Limite defensivo ~24MB (Whisper acepta hasta 25MB)
  if (buffer.length > 24 * 1024 * 1024) {
    throw Object.assign(new Error('El audio es demasiado largo (máx ~24MB / ~20 min).'), { status: 400 });
  }

  const ext = extFromMime(mimeType || 'audio/webm');
  const file = await toFile(buffer, `audio.${ext}`, { type: mimeType || 'audio/webm' });

  try {
    const res = await oa.audio.transcriptions.create({
      file,
      model: MODEL,
      language: 'es', // español por defecto (mejora precisión)
      response_format: 'text',
    });
    // Con response_format 'text', el SDK devuelve el string directamente.
    const text = typeof res === 'string' ? res : (res as any)?.text || '';
    return String(text).trim();
  } catch (e: any) {
    const status = e?.status || e?.response?.status;
    if (status === 401) throw Object.assign(new Error('OPENAI_API_KEY inválida para Whisper.'), { status: 502 });
    if (status === 429) throw Object.assign(new Error('Whisper saturado (rate limit). Intenta en unos segundos.'), { status: 429 });
    throw e;
  }
};
