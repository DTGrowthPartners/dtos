import { Request, Response } from 'express';
import {
  listProcesses,
  actOnProcess,
  tailProcessLog,
  ProcessAction,
} from '../services/processes.service';

const handleErr = (res: Response, e: any) => {
  const status = e?.status && Number.isInteger(e.status) ? e.status : 500;
  console.error('[processes] error:', e?.message || e);
  res.status(status).json({
    success: false,
    error: e?.message || 'Error procesando solicitud',
  });
};

export const processesController = {
  list: async (_req: Request, res: Response) => {
    try {
      const processes = await listProcesses();
      res.json({ processes, count: processes.length });
    } catch (e) {
      handleErr(res, e);
    }
  },

  action: async (req: Request, res: Response) => {
    const { name } = req.params;
    const { action } = req.body || {};
    if (!['start', 'stop', 'restart'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'action debe ser start | stop | restart',
      });
    }
    try {
      const user = (req as any).user;
      console.log(`[processes] ${user?.email || '?'} -> ${action} ${name}`);
      const result = await actOnProcess(name, action as ProcessAction);
      res.json({ success: true, ...result });
    } catch (e) {
      handleErr(res, e);
    }
  },

  logs: async (req: Request, res: Response) => {
    const { name } = req.params;
    const lines = parseInt((req.query.lines as string) || '200', 10);
    const stream = (req.query.stream as string) === 'err' ? 'err' : 'out';
    try {
      const result = await tailProcessLog(name, stream, lines);
      res.json({ success: true, ...result });
    } catch (e) {
      handleErr(res, e);
    }
  },
};
