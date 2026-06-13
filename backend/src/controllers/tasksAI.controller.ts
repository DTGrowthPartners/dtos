import { Request, Response } from 'express';
import { parseTaskFromText, parseTaskListFromText } from '../services/tasksAI.service';

export const tasksAIController = {
  parse: async (req: Request, res: Response) => {
    const { text } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Campo requerido: text (string no vacío)',
      });
    }
    if (text.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'El texto es demasiado largo (máx. 2000 caracteres).',
      });
    }
    try {
      const user = (req as any).user;
      console.log(`[tasks-ai] ${user?.email || '?'} -> parse (${text.length} chars)`);
      const parsed = await parseTaskFromText(text);
      res.json({ success: true, data: parsed });
    } catch (e: any) {
      const status = e?.status && Number.isInteger(e.status) ? e.status : 500;
      console.error('[tasks-ai] parse error:', e?.message || e);
      res.status(status).json({
        success: false,
        error: e?.message || 'No se pudo interpretar el texto',
      });
    }
  },

  parseList: async (req: Request, res: Response) => {
    const { text } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Campo requerido: text (string no vacío)' });
    }
    if (text.length > 4000) {
      return res.status(400).json({ success: false, error: 'La lista es demasiado larga (máx. 4000 caracteres).' });
    }
    try {
      const user = (req as any).user;
      console.log(`[tasks-ai] ${user?.email || '?'} -> parse-list (${text.length} chars)`);
      const tasks = await parseTaskListFromText(text);
      res.json({ success: true, tasks });
    } catch (e: any) {
      const status = e?.status && Number.isInteger(e.status) ? e.status : 500;
      console.error('[tasks-ai] parse-list error:', e?.message || e);
      res.status(status).json({ success: false, error: e?.message || 'No se pudo interpretar la lista' });
    }
  },
};
