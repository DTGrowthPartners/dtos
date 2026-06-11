import { Request, Response } from 'express';
import { listAllCrons, toggleUserCron } from '../services/crons.service';

export const cronsController = {
  list: async (_req: Request, res: Response) => {
    try {
      const crons = await listAllCrons();
      res.json({ crons, count: crons.length });
    } catch (e) {
      console.error('[crons] error:', e);
      res.status(500).json({
        success: false,
        error: e instanceof Error ? e.message : 'Error listando crons',
      });
    }
  },

  toggle: async (req: Request, res: Response) => {
    const { schedule, command, enable } = req.body || {};
    if (typeof schedule !== 'string' || typeof command !== 'string' || typeof enable !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: schedule (string), command (string), enable (boolean)',
      });
    }
    try {
      const user = (req as any).user;
      console.log(`[crons] ${user?.email || '?'} -> ${enable ? 'activar' : 'pausar'}: ${command.slice(0, 80)}`);
      const result = await toggleUserCron(schedule, command, enable);
      res.json({ success: true, ...result });
    } catch (e: any) {
      const status = e?.status && Number.isInteger(e.status) ? e.status : 500;
      console.error('[crons] toggle error:', e?.message || e);
      res.status(status).json({
        success: false,
        error: e?.message || 'Error toggling cron',
      });
    }
  },
};
