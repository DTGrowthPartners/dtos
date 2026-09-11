import { Router } from 'express';
import { invoiceController } from '../controllers/invoice.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Descarga PÚBLICA del PDF con link firmado (HMAC). Va ANTES del authMiddleware.
router.get('/:id/pdf', invoiceController.downloadPublic);

router.use(authMiddleware);

router.post('/cartera/send-email', async (_req, res) => {
  try {
    const { enviarCarteraCorregida } = await import('../services/dailyReports.service');
    res.json(await enviarCarteraCorregida());
  } catch (error) {
    console.error('[Cartera] Error enviando reporte:', error);
    res.status(502).json({ error: 'No se pudo confirmar el envío a ambos destinatarios. Revisa el correo antes de reintentar.' });
  }
});

// Route to generate a new invoice PDF
router.post('/generate', invoiceController.generate);
router.get('/', invoiceController.list);
router.get('/unpaid', invoiceController.getUnpaidInvoices);
router.get('/:id/download', invoiceController.download);
router.patch('/:id/status', invoiceController.updateStatus);
router.get('/:id/payments', invoiceController.getPayments);
router.post('/:id/payments', invoiceController.addPayment);
router.delete('/:id/payments/:paymentId', invoiceController.deletePayment);
router.delete('/:id', invoiceController.delete);

export default router;
