import { Router } from 'express';
import { ClientController } from '../controllers/client.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const clientController = new ClientController();

router.use(authMiddleware);

router.post('/', clientController.create.bind(clientController));
router.get('/', clientController.findAll.bind(clientController));
router.get('/:id', clientController.findOne.bind(clientController));
router.put('/:id', clientController.update.bind(clientController));
router.delete('/:id', clientController.remove.bind(clientController));
router.post('/:id/share', clientController.shareClient.bind(clientController));

export default router;
