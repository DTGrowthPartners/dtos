import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { processesController } from '../controllers/processes.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', processesController.list);
router.post('/:name/action', processesController.action);
router.get('/:name/logs', processesController.logs);

export default router;
