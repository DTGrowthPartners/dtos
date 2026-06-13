import { Request, Response } from 'express';
import { getCobrosForPeriod, markCobroPaid, unmarkCobroPaid } from '../services/cobros.service';

const handleErr = (res: Response, e: any) => {
  const status = e?.status && Number.isInteger(e.status) ? e.status : 500;
  console.error('[cobros] error:', e?.message || e);
  res.status(status).json({ success: false, error: e?.message || 'Error procesando solicitud' });
};

export const cobrosController = {
  list: async (req: Request, res: Response) => {
    try {
      const period = req.query.period as string | undefined;
      const data = await getCobrosForPeriod(period);
      res.json(data);
    } catch (e) {
      handleErr(res, e);
    }
  },

  pay: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const { metodoPago, referencia, nota } = req.body || {};
      const updated = await markCobroPaid(id, {
        metodoPago,
        referencia,
        nota,
        registradoPor: user?.email || 'dtos',
      });
      res.json({ success: true, cobro: updated });
    } catch (e) {
      handleErr(res, e);
    }
  },

  unpay: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updated = await unmarkCobroPaid(id);
      res.json({ success: true, cobro: updated });
    } catch (e) {
      handleErr(res, e);
    }
  },
};
