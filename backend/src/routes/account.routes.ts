import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  getAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
  registerPayment,
  getPayments,
  deletePayment,
  getSummary,
  getOverdue,
} from '../controllers/account.controller';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Summary and analytics
router.get('/summary', getSummary);
router.get('/overdue', getOverdue);

// CRUD operations
router.get('/', getAccounts);
router.get('/:id', getAccountById);
router.post('/', createAccount);
router.put('/:id', updateAccount);
router.delete('/:id', deleteAccount);

// Payments
router.get('/:id/payments', getPayments);
router.post('/:id/payments', registerPayment);
router.delete('/:id/payments/:paymentId', deletePayment);

export default router;
