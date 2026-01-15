import { Router } from 'express';
import { ServiceController } from '../controllers/service.controller';
import clientServiceController from '../controllers/clientService.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const serviceController = new ServiceController();

router.use(authMiddleware);

// Service Revenue Metrics (debe ir antes de rutas con :id)
router.get('/metrics/revenue', clientServiceController.getServiceRevenueMetrics);

// Service CRUD
router.post('/', serviceController.create.bind(serviceController));
router.get('/', serviceController.findAll.bind(serviceController));
router.put('/reorder', serviceController.reorder.bind(serviceController));
router.get('/:id', serviceController.findOne.bind(serviceController));
router.put('/:id', serviceController.update.bind(serviceController));
router.delete('/:id', serviceController.remove.bind(serviceController));

// Service Clients (clientes que tienen este servicio)
router.get('/:serviceId/clients', clientServiceController.getServiceClients);

export default router;
