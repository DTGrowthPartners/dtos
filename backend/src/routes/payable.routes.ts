import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  getSummary,
  getPayables,
  getPayableById,
  createPayable,
  updatePayable,
  deletePayable,
  addPayment,
  deletePayment,
} from '../controllers/payable.controller';

const router = Router();

router.use(authMiddleware);

router.get('/summary', getSummary);
router.get('/', getPayables);
router.get('/:id', getPayableById);
router.post('/', createPayable);
router.put('/:id', updatePayable);
router.delete('/:id', deletePayable);

// Abonos
router.post('/:id/payments', addPayment);
router.delete('/:id/payments/:paymentId', deletePayment);

export default router;
