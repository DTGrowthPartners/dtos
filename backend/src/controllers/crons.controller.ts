import { Request, Response } from 'express';
import { listAllCrons } from '../services/crons.service';

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
};
