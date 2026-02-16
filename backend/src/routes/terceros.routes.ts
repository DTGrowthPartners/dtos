import { Router } from 'express';
import { tercerosController } from '../controllers/terceros.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

// Estadísticas
router.get('/estadisticas', (req, res) => tercerosController.getEstadisticas(req, res));

// Sync from Google Sheets
router.post('/sync-from-sheets', (req, res) => tercerosController.syncFromSheets(req, res));

// Terceros
router.get('/', (req, res) => tercerosController.findAll(req, res));
router.get('/:id', (req, res) => tercerosController.findOne(req, res));
router.post('/', (req, res) => tercerosController.create(req, res));
router.put('/:id', (req, res) => tercerosController.update(req, res));
router.delete('/:id', (req, res) => tercerosController.delete(req, res));
router.post('/:id/convertir-cliente', (req, res) => tercerosController.convertirACliente(req, res));

// Organizaciones
router.get('/organizaciones/list', (req, res) => tercerosController.findAllOrganizaciones(req, res));
router.get('/organizaciones/:id', (req, res) => tercerosController.findOneOrganizacion(req, res));
router.post('/organizaciones', (req, res) => tercerosController.createOrganizacion(req, res));
router.put('/organizaciones/:id', (req, res) => tercerosController.updateOrganizacion(req, res));
router.delete('/organizaciones/:id', (req, res) => tercerosController.deleteOrganizacion(req, res));

// Clientes (empresas de la vista Clientes para asociar terceros)
router.get('/clients/list', (req, res) => tercerosController.findAllClients(req, res));

export default router;
