import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { metaGastoService } from '../services/metaGasto.service';

/** Gasto en pauta Meta (snapshots del reporte diario) para el dashboard. */
const router = Router();
router.use(authMiddleware);

// GET /api/meta-gasto/mes[?mes=YYYY-MM] — total de todas las cuentas
router.get('/mes', async (req, res) => {
  try {
    const mes = typeof req.query.mes === 'string' && /^\d{4}-\d{2}$/.test(req.query.mes) ? req.query.mes : undefined;
    res.json(await metaGastoService.getGastoMes(mes));
  } catch (e: any) {
    res.status(502).json({ ok: false, error: e?.message || 'gasto-mes no disponible' });
  }
});

// GET /api/meta-gasto/detalle[?mes=YYYY-MM] — desglose por cuenta
router.get('/detalle', async (req, res) => {
  try {
    const mes = typeof req.query.mes === 'string' && /^\d{4}-\d{2}$/.test(req.query.mes) ? req.query.mes : undefined;
    res.json(await metaGastoService.getDetalle(mes));
  } catch (e: any) {
    res.status(502).json({ ok: false, error: e?.message || 'gasto-mes no disponible' });
  }
});

export default router;
