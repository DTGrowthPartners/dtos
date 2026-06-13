import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { transcribeController } from '../controllers/transcribe.controller';

const router = Router();
router.use(authMiddleware);

router.post('/', transcribeController.transcribe);

export default router;
