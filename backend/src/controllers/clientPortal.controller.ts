import { Request, Response } from 'express';
import * as ClientPortalService from '../services/clientPortal.service';

// ==================== PORTAL (para clientes) ====================

export const getDashboard = async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).portalClientId;
    const dashboard = await ClientPortalService.getClientDashboard(clientId);
    res.json(dashboard);
  } catch (error) {
    console.error('Error getting dashboard:', error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Error al obtener dashboard' });
  }
};

export const getCampaigns = async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).portalClientId;
    const { status, platform } = req.query;
    const campaigns = await ClientPortalService.getClientCampaigns(clientId, {
      status: status as string,
      platform: platform as string,
    });
    res.json(campaigns);
  } catch (error) {
    console.error('Error getting campaigns:', error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Error al obtener campañas' });
  }
};

export const getSalesBudget = async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).portalClientId;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const budgets = await ClientPortalService.getClientSalesBudget(clientId, year);
    res.json(budgets);
  } catch (error) {
    console.error('Error getting sales budget:', error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Error al obtener presupuesto' });
  }
};

export const getServices = async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).portalClientId;
    const services = await ClientPortalService.getClientServices(clientId);
    res.json(services);
  } catch (error) {
    console.error('Error getting services:', error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Error al obtener servicios' });
  }
};

// ==================== ADMIN (gestionar datos de clientes) ====================

export const listClientsForPortal = async (req: Request, res: Response) => {
  try {
    const clients = await ClientPortalService.listClientsForPortal();
    res.json(clients);
  } catch (error) {
    console.error('Error listing clients:', error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Error al listar clientes' });
  }
};

export const getClientDetail = async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const client = await ClientPortalService.getClientDetail(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    res.json(client);
  } catch (error) {
    console.error('Error getting client detail:', error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Error al obtener cliente' });
  }
};

// ==================== CRUD Campañas (Admin) ====================

export const createCampaign = async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const campaign = await ClientPortalService.createCampaign(clientId, {
      ...req.body,
      startDate: new Date(req.body.startDate),
      endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
    });
    res.status(201).json(campaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Error al crear campaña' });
  }
};

export const updateCampaign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    const campaign = await ClientPortalService.updateCampaign(id, data);
    res.json(campaign);
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Error al actualizar campaña' });
  }
};

export const deleteCampaign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await ClientPortalService.deleteCampaign(id);
    res.json({ message: 'Campaña eliminada' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Error al eliminar campaña' });
  }
};

// ==================== CRUD Presupuesto/Ventas (Admin) ====================

export const createOrUpdateSalesBudget = async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const budget = await ClientPortalService.createOrUpdateSalesBudget(clientId, req.body);
    res.json(budget);
  } catch (error) {
    console.error('Error creating/updating sales budget:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Error al guardar presupuesto' });
  }
};

export const deleteSalesBudget = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await ClientPortalService.deleteSalesBudget(id);
    res.json({ message: 'Presupuesto eliminado' });
  } catch (error) {
    console.error('Error deleting sales budget:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Error al eliminar presupuesto' });
  }
};

// ==================== CRUD Servicios (Admin) ====================

export const createServiceStatus = async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const service = await ClientPortalService.createServiceStatus(clientId, {
      ...req.body,
      startDate: new Date(req.body.startDate),
      endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
    });
    res.status(201).json(service);
  } catch (error) {
    console.error('Error creating service status:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Error al crear servicio' });
  }
};

export const updateServiceStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    const service = await ClientPortalService.updateServiceStatus(id, data);
    res.json(service);
  } catch (error) {
    console.error('Error updating service status:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Error al actualizar servicio' });
  }
};

export const deleteServiceStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await ClientPortalService.deleteServiceStatus(id);
    res.json({ message: 'Servicio eliminado' });
  } catch (error) {
    console.error('Error deleting service status:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Error al eliminar servicio' });
  }
};

// ==================== INVITACIONES ====================

export const createInvitation = async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { email } = req.body;
    const userId = (req as any).user.userId;
    const invitation = await ClientPortalService.createInvitation(clientId, email, userId);
    res.status(201).json(invitation);
  } catch (error) {
    console.error('Error creating invitation:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Error al crear invitación' });
  }
};

export const validateInvitation = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const invitation = await ClientPortalService.validateInvitation(token);
    res.json(invitation);
  } catch (error) {
    console.error('Error validating invitation:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Invitación inválida' });
  }
};

export const acceptInvitation = async (req: Request, res: Response) => {
  try {
    const { token, firebaseUid, email, firstName, lastName, password } = req.body;
    const user = await ClientPortalService.acceptInvitation(token, {
      firebaseUid,
      email,
      firstName,
      lastName,
      password,
    });
    res.status(201).json({ message: 'Cuenta creada exitosamente', userId: user.id });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Error al aceptar invitación' });
  }
};

export const deleteInvitation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await ClientPortalService.deleteInvitation(id);
    res.json({ message: 'Invitación eliminada' });
  } catch (error) {
    console.error('Error deleting invitation:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Error al eliminar invitación' });
  }
};

export const listPendingInvitations = async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const invitations = await ClientPortalService.listPendingInvitations(clientId);
    res.json(invitations);
  } catch (error) {
    console.error('Error listing invitations:', error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Error al listar invitaciones' });
  }
};

// ==================== SERVICIOS DEL SISTEMA ====================

export const getAllServices = async (req: Request, res: Response) => {
  try {
    const services = await ClientPortalService.getAllServices();
    res.json(services);
  } catch (error) {
    console.error('Error getting services:', error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Error al obtener servicios' });
  }
};

// ==================== EXCEL FILES ====================

export const uploadExcelFile = async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const userId = (req as any).user.userId;
    const { name, description } = req.body;

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ message: 'No se proporcionó ningún archivo' });
    }

    const excelFile = await ClientPortalService.uploadExcelFile(
      clientId,
      userId,
      file.buffer,
      file.originalname,
      name || file.originalname.replace(/\.[^/.]+$/, ''),
      description
    );

    res.status(201).json(excelFile);
  } catch (error) {
    console.error('Error uploading Excel file:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Error al subir archivo Excel' });
  }
};

export const getClientExcelFiles = async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const files = await ClientPortalService.getClientExcelFiles(clientId);
    res.json(files);
  } catch (error) {
    console.error('Error getting Excel files:', error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Error al obtener archivos Excel' });
  }
};

export const getExcelFile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Si es portal, usar el clientId del usuario
    const clientId = (req as any).portalClientId || undefined;
    const file = await ClientPortalService.getExcelFile(id, clientId);

    if (!file) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    res.json(file);
  } catch (error) {
    console.error('Error getting Excel file:', error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Error al obtener archivo Excel' });
  }
};

export const deleteExcelFile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await ClientPortalService.deleteExcelFile(id);
    res.json({ message: 'Archivo eliminado' });
  } catch (error) {
    console.error('Error deleting Excel file:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Error al eliminar archivo' });
  }
};

export const updateExcelFile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const file = await ClientPortalService.updateExcelFile(id, req.body);
    res.json(file);
  } catch (error) {
    console.error('Error updating Excel file:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Error al actualizar archivo' });
  }
};

// Portal: Obtener archivos Excel del cliente logueado
export const getPortalExcelFiles = async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).portalClientId;
    const files = await ClientPortalService.getClientExcelFiles(clientId);
    res.json(files);
  } catch (error) {
    console.error('Error getting portal Excel files:', error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Error al obtener archivos' });
  }
};
