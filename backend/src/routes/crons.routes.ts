import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { cronsController } from '../controllers/crons.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', cronsController.list);

export default router;
