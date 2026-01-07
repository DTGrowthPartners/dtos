import { Router } from 'express';
import { invoiceController } from '../controllers/invoice.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

// Route to generate a new invoice PDF
router.post('/generate', invoiceController.generate);
router.get('/', invoiceController.list);
router.get('/:id/download', invoiceController.download);
router.delete('/:id', invoiceController.delete);

export default router;
