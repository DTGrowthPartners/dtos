import express from 'express';
import { financeController } from '../controllers/finance.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = express.Router();

// Finance data
router.get('/data', authMiddleware, (req, res) =>
  financeController.getFinanceData(req, res)
);

router.post('/expense', authMiddleware, (req, res) =>
  financeController.addExpense(req, res)
);

router.post('/income', authMiddleware, (req, res) =>
  financeController.addIncome(req, res)
);

router.get('/budget', authMiddleware, (req, res) =>
  financeController.getBudget(req, res)
);

// Terceros (Third Parties)
router.get('/terceros', authMiddleware, (req, res) =>
  financeController.getTerceros(req, res)
);

router.post('/terceros', authMiddleware, (req, res) =>
  financeController.addTercero(req, res)
);

router.put('/terceros/:id', authMiddleware, (req, res) =>
  financeController.updateTercero(req, res)
);

router.delete('/terceros/:id', authMiddleware, (req, res) =>
  financeController.deleteTercero(req, res)
);

// Nómina (Payroll)
router.get('/nomina', authMiddleware, (req, res) =>
  financeController.getNomina(req, res)
);

router.post('/nomina', authMiddleware, (req, res) =>
  financeController.addNominaRecord(req, res)
);

// Reports
router.get('/expenses-by-tercero', authMiddleware, (req, res) =>
  financeController.getExpensesByTercero(req, res)
);

// Disponible (saldo por cuenta)
router.get('/disponible', authMiddleware, (req, res) =>
  financeController.getDisponible(req, res)
);

// Client Goals (Meta de Clientes)
router.get('/client-goals', authMiddleware, (req, res) =>
  financeController.getClientGoals(req, res)
);

router.get('/client-goals/months', authMiddleware, (req, res) =>
  financeController.getClientGoalsMonths(req, res)
);

export default router;
