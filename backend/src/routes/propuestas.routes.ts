import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import propuestasController from '../controllers/propuestas.controller';

const router = Router();

router.use(authMiddleware);

// POST /api/propuestas/generate — genera una propuesta a partir de una transcripción
router.post('/generate', propuestasController.generate);

export default router;
