import { Request, Response } from 'express';
import * as agentsService from '../services/agents.service';

const handleErr = (res: Response, err: any) => {
  const status = err?.status && Number.isInteger(err.status) ? err.status : 500;
  console.error('[agents] error:', err?.message || err);
  res.status(status).json({
    success: false,
    error: err?.message || 'Error procesando solicitud',
    details: err?.body,
  });
};

export const agentsController = {
  list: async (_req: Request, res: Response) => {
    try {
      res.json({ agents: agentsService.listAgentsPublic() });
    } catch (e) {
      handleErr(res, e);
    }
  },

  health: async (req: Request, res: Response) => {
    try {
      const data = await agentsService.agentHealth(req.params.id);
      res.json(data);
    } catch (e) {
      handleErr(res, e);
    }
  },

  getEstado: async (req: Request, res: Response) => {
    try {
      const data = await agentsService.agentGetEstado(req.params.id);
      res.json(data);
    } catch (e) {
      handleErr(res, e);
    }
  },

  setEstado: async (req: Request, res: Response) => {
    try {
      const por = (req as any).user?.email || req.body.por || 'dtos';
      const body: agentsService.SetEstadoBody = {
        activo: req.body.activo,
        modo: req.body.modo,
        razon: req.body.razon,
        por,
      };
      const data = await agentsService.agentSetEstado(req.params.id, body);
      res.json(data);
    } catch (e) {
      handleErr(res, e);
    }
  },

  getStats: async (req: Request, res: Response) => {
    try {
      const data = await agentsService.agentGetStats(req.params.id);
      res.json(data);
    } catch (e) {
      handleErr(res, e);
    }
  },

  sendMessage: async (req: Request, res: Response) => {
    try {
      const { numero, grupo, mensaje } = req.body;
      if (!mensaje) {
        return res.status(400).json({ success: false, error: 'Campo requerido: mensaje' });
      }
      if (!numero && !grupo) {
        return res.status(400).json({ success: false, error: 'Se requiere numero o grupo' });
      }
      const data = await agentsService.agentSendMessage(req.params.id, { numero, grupo, mensaje });
      res.json(data);
    } catch (e) {
      handleErr(res, e);
    }
  },
};
