import { Request, Response } from 'express';
import { transcribeAudio } from '../services/transcribe.service';

export const transcribeController = {
  transcribe: async (req: Request, res: Response) => {
    const { audio, mimeType } = req.body || {};
    if (typeof audio !== 'string' || !audio) {
      return res.status(400).json({ success: false, error: 'Campo requerido: audio (base64)' });
    }
    try {
      const user = (req as any).user;
      const text = await transcribeAudio(audio, typeof mimeType === 'string' ? mimeType : 'audio/webm');
      console.log(`[transcribe] ${user?.email || '?'} -> ${text.length} chars`);
      res.json({ success: true, text });
    } catch (e: any) {
      const status = e?.status && Number.isInteger(e.status) ? e.status : 500;
      console.error('[transcribe] error:', e?.message || e);
      res.status(status).json({ success: false, error: e?.message || 'No se pudo transcribir el audio' });
    }
  },
};
