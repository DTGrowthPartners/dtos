import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { logsController } from '../controllers/logs.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', logsController.list);
router.get('/:id/tail', logsController.tail);

export default router;
