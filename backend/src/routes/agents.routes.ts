import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { agentsController } from '../controllers/agents.controller';

const router = Router();

// Todos los endpoints requieren sesion DTOS valida.
router.use(authMiddleware);

router.get('/', agentsController.list);
router.get('/:id/health', agentsController.health);
router.get('/:id/estado', agentsController.getEstado);
router.post('/:id/estado', agentsController.setEstado);
router.get('/:id/stats', agentsController.getStats);
router.post('/:id/enviar', agentsController.sendMessage);

export default router;
