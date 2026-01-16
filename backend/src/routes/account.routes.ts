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
  getClientBalances,
  getAccountsByClient,
  createInvoiceFromAccount,
} from '../controllers/account.controller';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Summary and analytics
router.get('/summary', getSummary);
router.get('/overdue', getOverdue);
router.get('/client-balances', getClientBalances);

// Client-specific accounts
router.get('/by-client/:clientId', getAccountsByClient);

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

// Invoice generation
router.post('/:id/invoice', createInvoiceFromAccount);

export default router;
