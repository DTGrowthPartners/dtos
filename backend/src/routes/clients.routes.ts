import { Router } from 'express';
import { ClientController } from '../controllers/client.controller';
import clientServiceController from '../controllers/clientService.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { generarCuentaDeServicio } from '../services/recurringInvoices.service';

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

// Comisión por inversión en pauta (spend desde Meta si está conectado)
router.get('/:id/comision', clientController.getComision.bind(clientController));

// Client Sedes (sucursales físicas del cliente)
router.get('/:id/sedes', clientController.getSedes.bind(clientController));
router.post('/:id/sedes', clientController.addSede.bind(clientController));
router.put('/:id/sedes/:sedeId', clientController.updateSede.bind(clientController));
router.delete('/:id/sedes/:sedeId', clientController.deleteSede.bind(clientController));

// Client Services (servicios asignados a un cliente)
router.get('/:clientId/services', clientServiceController.getClientServices);
router.post('/:clientId/services', clientServiceController.assignServiceToClient);
router.put('/:clientId/services/:serviceId', clientServiceController.updateClientService);
router.delete('/:clientId/services/:serviceId', clientServiceController.removeServiceFromClient);

// Generar la cuenta de cobro de UN servicio contratado desde el perfil del cliente
// (botón "Generar cuenta"). Crea el PDF + Invoice borrador amarrada al servicio y
// avanza el próximo cobro (único → sin más cobros).
router.post('/:clientId/services/:clientServiceId/generar-cuenta', async (req, res) => {
  try {
    const user = (req as any).user;
    const cuenta = await generarCuentaDeServicio(req.params.clientServiceId, user?.email || 'perfil-cliente');
    res.json({ success: true, ...cuenta });
  } catch (e: any) {
    res.status(Number.isInteger(e?.status) ? e.status : 500).json({ success: false, error: e?.message || 'No se pudo generar la cuenta' });
  }
});

export default router;
