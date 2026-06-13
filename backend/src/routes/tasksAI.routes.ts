import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { tasksAIController } from '../controllers/tasksAI.controller';

const router = Router();
router.use(authMiddleware);

router.post('/parse', tasksAIController.parse);
router.post('/parse-list', tasksAIController.parseList);

export default router;
