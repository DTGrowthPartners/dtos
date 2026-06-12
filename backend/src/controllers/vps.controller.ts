import { Request, Response } from 'express';
import { getVpsHealth } from '../services/vps.service';

export const vpsController = {
  health: async (_req: Request, res: Response) => {
    try {
      const data = await getVpsHealth();
      res.json(data);
    } catch (e) {
      console.error('[vps] error:', e);
      res.status(500).json({
        success: false,
        error: e instanceof Error ? e.message : 'Error leyendo estado del VPS',
      });
    }
  },
};
