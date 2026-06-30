import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { getClientesV2, getClienteV2 } from '../services/clientesV2.service';

const router = Router();
router.use(authMiddleware);

// GET /api/clientes-v2 — lista con saldo calculado + orden por urgencia + resumen
router.get('/', async (_req: Request, res: Response) => {
  try {
    res.json(await getClientesV2());
  } catch (e: any) {
    console.error('[clientes-v2] list error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/clientes-v2/:id — un cliente con facturas, actividad y totales
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const c = await getClienteV2(req.params.id);
    if (!c) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(c);
  } catch (e: any) {
    console.error('[clientes-v2] detail error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
