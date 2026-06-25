import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { register, test } from '../controllers/push.controller';

const router = Router();

router.use(authMiddleware);
router.post('/register', register);
router.post('/test', test);

export default router;
