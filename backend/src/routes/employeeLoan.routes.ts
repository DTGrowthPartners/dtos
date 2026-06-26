import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  getSummary,
  getLoans,
  getLoanById,
  createLoan,
  updateLoan,
  deleteLoan,
  addPayment,
  deletePayment,
} from '../controllers/employeeLoan.controller';

const router = Router();

router.use(authMiddleware);

router.get('/summary', getSummary);
router.get('/', getLoans);
router.get('/:id', getLoanById);
router.post('/', createLoan);
router.put('/:id', updateLoan);
router.delete('/:id', deleteLoan);

// Abonos
router.post('/:id/payments', addPayment);
router.delete('/:id/payments/:paymentId', deletePayment);

export default router;
