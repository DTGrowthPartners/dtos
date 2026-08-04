import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { factusService } from '../services/factus.service';

/** Facturación electrónica DIAN vía Factus (sandbox mientras se prueba). */
const router = Router();
router.use(authMiddleware);

// GET /api/factus/estado — conexión, modo (sandbox/producción) y rangos activos
router.get('/estado', async (_req, res) => {
  try {
    res.json(await factusService.estado());
  } catch (e: any) {
    res.status(502).json({ ok: false, message: e?.message || 'Factus no disponible' });
  }
});

// POST /api/factus/emitir/:invoiceId — body: { tipoPersona?, ivaPct?, municipio?, sendEmail? }
router.post('/emitir/:invoiceId', async (req, res) => {
  try {
    const { tipoPersona, ivaPct, municipio, sendEmail } = req.body || {};
    const result = await factusService.emitirCuenta(req.params.invoiceId, {
      tipoPersona: tipoPersona === 'natural' ? 'natural' : tipoPersona === 'juridica' ? 'juridica' : undefined,
      ivaPct: typeof ivaPct === 'number' ? ivaPct : undefined,
      municipio: typeof municipio === 'string' && /^\d{5}$/.test(municipio) ? municipio : undefined,
      sendEmail: sendEmail === true,
    });
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ ok: false, message: e?.message || 'No se pudo emitir la factura' });
  }
});

// POST /api/factus/anular/:invoiceId — nota crédito de anulación. body: { motivo?, ivaPct? }
router.post('/anular/:invoiceId', async (req, res) => {
  try {
    const { motivo, ivaPct } = req.body || {};
    const result = await factusService.anularFactura(
      req.params.invoiceId,
      typeof motivo === 'string' ? motivo : undefined,
      typeof ivaPct === 'number' ? ivaPct : 0
    );
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ ok: false, message: e?.message || 'No se pudo anular la factura' });
  }
});

// GET /api/factus/pdf/:invoiceId — PDF oficial DIAN de la factura emitida
router.get('/pdf/:invoiceId', async (req, res) => {
  try {
    const { buffer, fileName } = await factusService.descargarPdf(req.params.invoiceId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(buffer);
  } catch (e: any) {
    res.status(400).json({ ok: false, message: e?.message || 'No se pudo descargar el PDF' });
  }
});

export default router;
