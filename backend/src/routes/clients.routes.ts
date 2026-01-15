import { Router } from 'express';
import { ClientController } from '../controllers/client.controller';
import clientServiceController from '../controllers/clientService.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const clientController = new ClientController();

router.use(authMiddleware);

// Client CRUD
router.post('/', clientController.create.bind(clientController));
router.get('/', clientController.findAll.bind(clientController));
router.get('/:id', clientController.findOne.bind(clientController));
router.put('/:id', clientController.update.bind(clientController));
router.delete('/:id', clientController.remove.bind(clientController));
router.post('/:id/share', clientController.shareClient.bind(clientController));

// Client Services (servicios asignados a un cliente)
router.get('/:clientId/services', clientServiceController.getClientServices);
router.post('/:clientId/services', clientServiceController.assignServiceToClient);
router.put('/:clientId/services/:serviceId', clientServiceController.updateClientService);
router.delete('/:clientId/services/:serviceId', clientServiceController.removeServiceFromClient);

export default router;
