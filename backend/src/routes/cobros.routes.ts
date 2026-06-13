import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { cobrosController } from '../controllers/cobros.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', cobrosController.list);
router.post('/:id/pay', cobrosController.pay);
router.post('/:id/unpay', cobrosController.unpay);

export default router;
