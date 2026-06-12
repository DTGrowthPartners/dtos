import { Request, Response } from 'express';
import { listLogSources, tailLog } from '../services/logs.service';

const handleErr = (res: Response, e: any) => {
  const status = e?.status && Number.isInteger(e.status) ? e.status : 500;
  console.error('[logs] error:', e?.message || e);
  res.status(status).json({
    success: false,
    error: e?.message || 'Error procesando solicitud',
  });
};

export const logsController = {
  list: async (_req: Request, res: Response) => {
    try {
      const sources = await listLogSources();
      res.json({ sources, count: sources.length });
    } catch (e) {
      handleErr(res, e);
    }
  },

  tail: async (req: Request, res: Response) => {
    const { id } = req.params;
    const lines = parseInt((req.query.lines as string) || '200', 10);
    const grep = req.query.grep as string | undefined;
    try {
      const result = await tailLog(id, lines, grep);
      res.json({ success: true, ...result });
    } catch (e) {
      handleErr(res, e);
    }
  },
};
