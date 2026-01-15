import { Router } from 'express';
import { ServiceController } from '../controllers/service.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const serviceController = new ServiceController();

router.use(authMiddleware);

router.post('/', serviceController.create.bind(serviceController));
router.get('/', serviceController.findAll.bind(serviceController));
router.put('/reorder', serviceController.reorder.bind(serviceController));
router.get('/:id', serviceController.findOne.bind(serviceController));
router.put('/:id', serviceController.update.bind(serviceController));
router.delete('/:id', serviceController.remove.bind(serviceController));

export default router;
