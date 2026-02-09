import { Router } from 'express';
import { invoiceController } from '../controllers/invoice.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

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
