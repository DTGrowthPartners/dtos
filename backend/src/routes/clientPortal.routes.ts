import { Router } from 'express';
import multer from 'multer';
import * as ClientPortalController from '../controllers/clientPortal.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireClientRole, requireAdminRole, attachClientId } from '../middlewares/clientPortal.middleware';

const router = Router();

// Configurar multer para archivos Excel en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo se aceptan archivos Excel (.xlsx, .xls) y CSV.'));
    }
  },
});

// ==================== RUTAS PÚBLICAS (para registro) ====================

// Validar invitación (sin auth)
router.get('/invitations/validate/:token', ClientPortalController.validateInvitation);

// Aceptar invitación y crear cuenta (sin auth, pero requiere token válido)
router.post('/invitations/accept', ClientPortalController.acceptInvitation);

// ==================== RUTAS DEL PORTAL (para clientes) ====================

// Dashboard del cliente
router.get('/portal/dashboard', authMiddleware, requireClientRole, attachClientId, ClientPortalController.getDashboard);

// Campañas del cliente
router.get('/portal/campaigns', authMiddleware, requireClientRole, attachClientId, ClientPortalController.getCampaigns);

// Presupuesto vs Ventas del cliente
router.get('/portal/sales-budget', authMiddleware, requireClientRole, attachClientId, ClientPortalController.getSalesBudget);

// Servicios del cliente
router.get('/portal/services', authMiddleware, requireClientRole, attachClientId, ClientPortalController.getServices);

// ==================== RUTAS ADMIN (gestionar datos de clientes) ====================

// Listar clientes para el portal
router.get('/admin/clients', authMiddleware, requireAdminRole, ClientPortalController.listClientsForPortal);

// Detalle de un cliente
router.get('/admin/clients/:clientId', authMiddleware, requireAdminRole, ClientPortalController.getClientDetail);

// --- Campañas ---
router.post('/admin/clients/:clientId/campaigns', authMiddleware, requireAdminRole, ClientPortalController.createCampaign);
router.put('/admin/campaigns/:id', authMiddleware, requireAdminRole, ClientPortalController.updateCampaign);
router.delete('/admin/campaigns/:id', authMiddleware, requireAdminRole, ClientPortalController.deleteCampaign);

// --- Presupuesto/Ventas ---
router.post('/admin/clients/:clientId/sales-budget', authMiddleware, requireAdminRole, ClientPortalController.createOrUpdateSalesBudget);
router.delete('/admin/sales-budget/:id', authMiddleware, requireAdminRole, ClientPortalController.deleteSalesBudget);

// --- Servicios ---
router.post('/admin/clients/:clientId/services', authMiddleware, requireAdminRole, ClientPortalController.createServiceStatus);
router.put('/admin/services/:id', authMiddleware, requireAdminRole, ClientPortalController.updateServiceStatus);
router.delete('/admin/services/:id', authMiddleware, requireAdminRole, ClientPortalController.deleteServiceStatus);

// --- Invitaciones ---
router.get('/admin/clients/:clientId/invitations', authMiddleware, requireAdminRole, ClientPortalController.listPendingInvitations);
router.post('/admin/clients/:clientId/invite', authMiddleware, requireAdminRole, ClientPortalController.createInvitation);
router.delete('/admin/invitations/:id', authMiddleware, requireAdminRole, ClientPortalController.deleteInvitation);

// --- Servicios del Sistema ---
router.get('/services', authMiddleware, ClientPortalController.getAllServices);

// --- Archivos Excel (Admin) ---
router.post('/admin/clients/:clientId/excel', authMiddleware, requireAdminRole, upload.single('file'), ClientPortalController.uploadExcelFile);
router.get('/admin/clients/:clientId/excel', authMiddleware, requireAdminRole, ClientPortalController.getClientExcelFiles);
router.get('/admin/excel/:id', authMiddleware, requireAdminRole, ClientPortalController.getExcelFile);
router.put('/admin/excel/:id', authMiddleware, requireAdminRole, ClientPortalController.updateExcelFile);
router.delete('/admin/excel/:id', authMiddleware, requireAdminRole, ClientPortalController.deleteExcelFile);

// --- Archivos Excel (Portal) ---
router.get('/portal/excel', authMiddleware, requireClientRole, attachClientId, ClientPortalController.getPortalExcelFiles);
router.get('/portal/excel/:id', authMiddleware, requireClientRole, attachClientId, ClientPortalController.getExcelFile);

export default router;
