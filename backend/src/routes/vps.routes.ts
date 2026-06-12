import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { vpsController } from '../controllers/vps.controller';

const router = Router();
router.use(authMiddleware);

router.get('/health', vpsController.health);

export default router;
