import { Request, Response } from 'express';
import clientServiceService from '../services/clientService.service';

// Servicios de un cliente
export const getClientServices = async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const services = await clientServiceService.getClientServices(clientId);
    res.json(services);
  } catch (error: any) {
    console.error('Error getting client services:', error);
    res.status(500).json({ error: error.message });
  }
};

export const assignServiceToClient = async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { serviceId, precioCliente, moneda, frecuencia, fechaInicio, fechaProximoCobro, fechaVencimiento, notas } = req.body;

    if (!serviceId) {
      return res.status(400).json({ error: 'serviceId es requerido' });
    }

    const clientService = await clientServiceService.assignServiceToClient(clientId, {
      serviceId,
      precioCliente: precioCliente ? parseFloat(precioCliente) : undefined,
      moneda,
      frecuencia,
      fechaInicio: fechaInicio ? new Date(fechaInicio) : undefined,
      fechaProximoCobro: fechaProximoCobro ? new Date(fechaProximoCobro) : undefined,
      fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : undefined,
      notas,
    });

    res.status(201).json(clientService);
  } catch (error: any) {
    console.error('Error assigning service to client:', error);
    if (error.message.includes('ya tiene este servicio')) {
      return res.status(409).json({ error: error.message });
    }
    if (error.message.includes('no encontrado')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

export const updateClientService = async (req: Request, res: Response) => {
  try {
    const { clientId, serviceId } = req.params;
    const { precioCliente, moneda, frecuencia, fechaProximoCobro, fechaVencimiento, estado, notas } = req.body;

    const clientService = await clientServiceService.updateClientService(clientId, serviceId, {
      precioCliente: precioCliente !== undefined ? parseFloat(precioCliente) : undefined,
      moneda,
      frecuencia,
      fechaProximoCobro: fechaProximoCobro ? new Date(fechaProximoCobro) : undefined,
      fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : undefined,
      estado,
      notas,
    });

    res.json(clientService);
  } catch (error: any) {
    console.error('Error updating client service:', error);
    if (error.message.includes('no encontrada')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

export const removeServiceFromClient = async (req: Request, res: Response) => {
  try {
    const { clientId, serviceId } = req.params;
    await clientServiceService.removeServiceFromClient(clientId, serviceId);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error removing service from client:', error);
    if (error.message.includes('no encontrada')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

// Clientes de un servicio
export const getServiceClients = async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;
    const clients = await clientServiceService.getServiceClients(serviceId);
    res.json(clients);
  } catch (error: any) {
    console.error('Error getting service clients:', error);
    res.status(500).json({ error: error.message });
  }
};

// Metricas de ingresos
export const getServiceRevenueMetrics = async (_req: Request, res: Response) => {
  try {
    const metrics = await clientServiceService.getServiceRevenueMetrics();
    res.json(metrics);
  } catch (error: any) {
    console.error('Error getting service revenue metrics:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  getClientServices,
  assignServiceToClient,
  updateClientService,
  removeServiceFromClient,
  getServiceClients,
  getServiceRevenueMetrics,
};
