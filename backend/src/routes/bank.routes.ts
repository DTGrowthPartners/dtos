import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middlewares/auth.middleware';

/** Movimientos bancarios detectados por el monitor de correos (tabla BankTransaction). */
const router = Router();
const prisma = new PrismaClient();
router.use(authMiddleware);

// GET /api/bank/transactions?take=100&tipo=entrante|saliente
router.get('/transactions', async (req, res) => {
  try {
    const take = Math.min(parseInt(String(req.query.take || '100'), 10) || 100, 500);
    const tipo = req.query.tipo === 'entrante' || req.query.tipo === 'saliente' ? String(req.query.tipo) : undefined;
    const txs = await prisma.bankTransaction.findMany({
      where: tipo ? { tipo } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
    });
    res.json(txs);
  } catch (e: any) {
    res.status(500).json({ message: e?.message || 'Error listando movimientos' });
  }
});

export default router;
