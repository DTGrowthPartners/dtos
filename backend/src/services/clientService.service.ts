import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// DTOs
export interface CreateClientServiceDto {
  serviceId: string;
  precioCliente?: number;
  moneda?: string;
  frecuencia?: string;
  fechaInicio?: Date;
  fechaProximoCobro?: Date;
  fechaVencimiento?: Date;
  notas?: string;
}

export interface UpdateClientServiceDto {
  precioCliente?: number;
  moneda?: string;
  frecuencia?: string;
  fechaProximoCobro?: Date;
  fechaVencimiento?: Date;
  estado?: string;
  notas?: string;
}

// Constantes
export const FRECUENCIAS = ['mensual', 'trimestral', 'semestral', 'anual', 'unico'] as const;
export const ESTADOS = ['activo', 'pausado', 'cancelado'] as const;

// Funciones auxiliares
const calculateNextBillingDate = (startDate: Date, frecuencia: string): Date => {
  const date = new Date(startDate);
  switch (frecuencia) {
    case 'mensual':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'trimestral':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'semestral':
      date.setMonth(date.getMonth() + 6);
      break;
    case 'anual':
      date.setFullYear(date.getFullYear() + 1);
      break;
    case 'unico':
      return date; // No hay proximo cobro
  }
  return date;
};

const normalizeToMonthly = (price: number, frecuencia: string): number => {
  switch (frecuencia) {
    case 'mensual':
      return price;
    case 'trimestral':
      return price / 3;
    case 'semestral':
      return price / 6;
    case 'anual':
      return price / 12;
    case 'unico':
      return 0; // No es recurrente
    default:
      return price;
  }
};

// Servicios del cliente
export const getClientServices = async (clientId: string) => {
  return prisma.clientService.findMany({
    where: { clientId },
    include: {
      service: {
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          currency: true,
          icon: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const assignServiceToClient = async (clientId: string, data: CreateClientServiceDto) => {
  // Verificar que el cliente existe
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error('Cliente no encontrado');

  // Verificar que el servicio existe
  const service = await prisma.service.findUnique({ where: { id: data.serviceId } });
  if (!service) throw new Error('Servicio no encontrado');

  // Verificar si ya existe la asignacion
  const existing = await prisma.clientService.findUnique({
    where: { clientId_serviceId: { clientId, serviceId: data.serviceId } },
  });
  if (existing) throw new Error('El cliente ya tiene este servicio asignado');

  const fechaInicio = data.fechaInicio || new Date();
  const frecuencia = data.frecuencia || 'mensual';
  const fechaProximoCobro = data.fechaProximoCobro || calculateNextBillingDate(fechaInicio, frecuencia);

  return prisma.clientService.create({
    data: {
      clientId,
      serviceId: data.serviceId,
      precioCliente: data.precioCliente,
      moneda: data.moneda || 'COP',
      frecuencia,
      fechaInicio,
      fechaProximoCobro,
      fechaVencimiento: data.fechaVencimiento,
      notas: data.notas,
      estado: 'activo',
      startDate: fechaInicio,
    },
    include: {
      service: {
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          currency: true,
          icon: true,
        },
      },
      client: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
};

export const updateClientService = async (clientId: string, serviceId: string, data: UpdateClientServiceDto) => {
  const existing = await prisma.clientService.findUnique({
    where: { clientId_serviceId: { clientId, serviceId } },
  });
  if (!existing) throw new Error('Asignacion no encontrada');

  return prisma.clientService.update({
    where: { clientId_serviceId: { clientId, serviceId } },
    data: {
      precioCliente: data.precioCliente,
      moneda: data.moneda,
      frecuencia: data.frecuencia,
      fechaProximoCobro: data.fechaProximoCobro,
      fechaVencimiento: data.fechaVencimiento,
      estado: data.estado,
      notas: data.notas,
      endDate: data.estado === 'cancelado' ? new Date() : undefined,
    },
    include: {
      service: {
        select: {
          id: true,
          name: true,
          price: true,
          currency: true,
          icon: true,
        },
      },
    },
  });
};

export const removeServiceFromClient = async (clientId: string, serviceId: string) => {
  const existing = await prisma.clientService.findUnique({
    where: { clientId_serviceId: { clientId, serviceId } },
  });
  if (!existing) throw new Error('Asignacion no encontrada');

  return prisma.clientService.delete({
    where: { clientId_serviceId: { clientId, serviceId } },
  });
};

// Clientes de un servicio
export const getServiceClients = async (serviceId: string) => {
  return prisma.clientService.findMany({
    where: { serviceId },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          logo: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

// Metricas de ingresos
export const getServiceRevenueMetrics = async () => {
  const clientServices = await prisma.clientService.findMany({
    where: { estado: 'activo' },
    include: {
      service: {
        select: {
          id: true,
          name: true,
          price: true,
          currency: true,
        },
      },
      client: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Calcular MRR (Monthly Recurring Revenue)
  let totalMRR = 0;
  const serviceBreakdown: Record<string, { serviceName: string; clientCount: number; totalRevenue: number; prices: number[] }> = {};
  const clientBreakdown: Record<string, { clientName: string; servicesCount: number; monthlyValue: number; services: string[] }> = {};

  for (const cs of clientServices) {
    const price = cs.precioCliente ?? cs.service.price;
    const monthlyValue = normalizeToMonthly(price, cs.frecuencia);

    // Solo sumar si no es pago unico
    if (cs.frecuencia !== 'unico') {
      totalMRR += monthlyValue;
    }

    // Service breakdown
    if (!serviceBreakdown[cs.service.id]) {
      serviceBreakdown[cs.service.id] = {
        serviceName: cs.service.name,
        clientCount: 0,
        totalRevenue: 0,
        prices: [],
      };
    }
    serviceBreakdown[cs.service.id].clientCount++;
    serviceBreakdown[cs.service.id].totalRevenue += price;
    serviceBreakdown[cs.service.id].prices.push(price);

    // Client breakdown
    if (!clientBreakdown[cs.client.id]) {
      clientBreakdown[cs.client.id] = {
        clientName: cs.client.name,
        servicesCount: 0,
        monthlyValue: 0,
        services: [],
      };
    }
    clientBreakdown[cs.client.id].servicesCount++;
    clientBreakdown[cs.client.id].monthlyValue += monthlyValue;
    clientBreakdown[cs.client.id].services.push(cs.service.name);
  }

  return {
    totalMRR,
    totalARR: totalMRR * 12,
    activeClientsWithServices: Object.keys(clientBreakdown).length,
    totalActiveServices: clientServices.length,
    serviceBreakdown: Object.entries(serviceBreakdown).map(([serviceId, data]) => ({
      serviceId,
      serviceName: data.serviceName,
      clientCount: data.clientCount,
      totalRevenue: data.totalRevenue,
      avgPrice: data.prices.length > 0 ? data.prices.reduce((a, b) => a + b, 0) / data.prices.length : 0,
    })).sort((a, b) => b.totalRevenue - a.totalRevenue),
    clientBreakdown: Object.entries(clientBreakdown).map(([clientId, data]) => ({
      clientId,
      clientName: data.clientName,
      servicesCount: data.servicesCount,
      monthlyValue: data.monthlyValue,
      services: data.services,
    })).sort((a, b) => b.monthlyValue - a.monthlyValue),
  };
};

export default {
  getClientServices,
  assignServiceToClient,
  updateClientService,
  removeServiceFromClient,
  getServiceClients,
  getServiceRevenueMetrics,
  FRECUENCIAS,
  ESTADOS,
};
