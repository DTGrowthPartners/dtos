import express from 'express';
import { financeController } from '../controllers/finance.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = express.Router();

router.get('/data', authMiddleware, (req, res) =>
  financeController.getFinanceData(req, res)
);

export default router;
