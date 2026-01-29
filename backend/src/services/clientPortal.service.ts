import { PrismaClient, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

// ==================== PORTAL (para clientes) ====================

// Dashboard del cliente - resumen de todo
export const getClientDashboard = async (clientId: string) => {
  const [client, campaigns, salesBudgets, services] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, email: true, logo: true },
    }),
    prisma.portalCampaign.findMany({
      where: { clientId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.portalSalesBudget.findMany({
      where: { clientId, year: new Date().getFullYear() },
      orderBy: { month: 'asc' },
    }),
    prisma.portalServiceStatus.findMany({
      where: { clientId, status: { in: ['active', 'pending'] } },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  // Calcular métricas de campañas activas
  const activeCampaigns = await prisma.portalCampaign.findMany({
    where: { clientId, status: 'active' },
  });

  const campaignMetrics = activeCampaigns.reduce(
    (acc, c) => ({
      totalBudget: acc.totalBudget + Number(c.budget),
      totalSpent: acc.totalSpent + Number(c.spent),
      totalImpressions: acc.totalImpressions + c.impressions,
      totalClicks: acc.totalClicks + c.clicks,
      totalConversions: acc.totalConversions + c.conversions,
    }),
    { totalBudget: 0, totalSpent: 0, totalImpressions: 0, totalClicks: 0, totalConversions: 0 }
  );

  // Calcular totales de presupuesto vs ventas del año
  const budgetSalesMetrics = salesBudgets.reduce(
    (acc, sb) => ({
      totalBudget: acc.totalBudget + Number(sb.budget),
      totalSales: acc.totalSales + Number(sb.sales),
      totalLeads: acc.totalLeads + sb.leads,
      totalCustomers: acc.totalCustomers + sb.customers,
    }),
    { totalBudget: 0, totalSales: 0, totalLeads: 0, totalCustomers: 0 }
  );

  return {
    client,
    campaigns: campaigns.map(c => ({
      ...c,
      budget: Number(c.budget),
      spent: Number(c.spent),
      ctr: c.ctr ? Number(c.ctr) : null,
      cpc: c.cpc ? Number(c.cpc) : null,
      cpa: c.cpa ? Number(c.cpa) : null,
    })),
    salesBudgets: salesBudgets.map(sb => ({
      ...sb,
      budget: Number(sb.budget),
      sales: Number(sb.sales),
    })),
    services,
    metrics: {
      campaigns: campaignMetrics,
      budgetSales: budgetSalesMetrics,
      activeServices: services.filter(s => s.status === 'active').length,
      pendingServices: services.filter(s => s.status === 'pending').length,
    },
  };
};

// Obtener campañas del cliente
export const getClientCampaigns = async (clientId: string, filters?: {
  status?: string;
  platform?: string;
}) => {
  const where: Prisma.PortalCampaignWhereInput = { clientId };

  if (filters?.status) where.status = filters.status;
  if (filters?.platform) where.platform = filters.platform;

  const campaigns = await prisma.portalCampaign.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  });

  return campaigns.map(c => ({
    ...c,
    budget: Number(c.budget),
    spent: Number(c.spent),
    ctr: c.ctr ? Number(c.ctr) : null,
    cpc: c.cpc ? Number(c.cpc) : null,
    cpa: c.cpa ? Number(c.cpa) : null,
  }));
};

// Obtener presupuesto vs ventas
export const getClientSalesBudget = async (clientId: string, year: number) => {
  const budgets = await prisma.portalSalesBudget.findMany({
    where: { clientId, year },
    orderBy: { month: 'asc' },
  });

  return budgets.map(sb => ({
    ...sb,
    budget: Number(sb.budget),
    sales: Number(sb.sales),
  }));
};

// Obtener servicios del cliente
export const getClientServices = async (clientId: string) => {
  const services = await prisma.portalServiceStatus.findMany({
    where: { clientId },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
  });

  return services;
};

// ==================== ADMIN (gestionar datos de clientes) ====================

// Listar todos los clientes con sus datos del portal
export const listClientsForPortal = async () => {
  const clients = await prisma.client.findMany({
    where: { status: 'active' },
    include: {
      portalUsers: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
      _count: {
        select: {
          portalCampaigns: true,
          portalBudgets: true,
          portalServices: true,
          portalInvitations: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return clients;
};

// Obtener detalle de un cliente para admin
export const getClientDetail = async (clientId: string) => {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      portalUsers: {
        select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
      },
      portalCampaigns: { orderBy: { updatedAt: 'desc' } },
      portalBudgets: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
      portalServices: { orderBy: { updatedAt: 'desc' } },
      portalInvitations: {
        where: { usedAt: null },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!client) return null;

  return {
    ...client,
    portalCampaigns: client.portalCampaigns.map(c => ({
      ...c,
      budget: Number(c.budget),
      spent: Number(c.spent),
      ctr: c.ctr ? Number(c.ctr) : null,
      cpc: c.cpc ? Number(c.cpc) : null,
      cpa: c.cpa ? Number(c.cpa) : null,
    })),
    portalBudgets: client.portalBudgets.map(sb => ({
      ...sb,
      budget: Number(sb.budget),
      sales: Number(sb.sales),
    })),
  };
};

// ==================== CRUD Campañas ====================

export const createCampaign = async (clientId: string, data: {
  name: string;
  platform: string;
  budget: number;
  startDate: Date;
  endDate?: Date;
  status?: string;
  notes?: string;
}) => {
  return prisma.portalCampaign.create({
    data: {
      clientId,
      name: data.name,
      platform: data.platform,
      budget: data.budget,
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status || 'active',
      notes: data.notes,
    },
  });
};

export const updateCampaign = async (id: string, data: {
  name?: string;
  platform?: string;
  status?: string;
  budget?: number;
  spent?: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  ctr?: number;
  cpc?: number;
  cpa?: number;
  startDate?: Date;
  endDate?: Date;
  notes?: string;
}) => {
  return prisma.portalCampaign.update({
    where: { id },
    data,
  });
};

export const deleteCampaign = async (id: string) => {
  return prisma.portalCampaign.delete({
    where: { id },
  });
};

// ==================== CRUD Presupuesto/Ventas ====================

export const createOrUpdateSalesBudget = async (clientId: string, data: {
  month: number;
  year: number;
  budget: number;
  sales?: number;
  leads?: number;
  customers?: number;
  notes?: string;
}) => {
  return prisma.portalSalesBudget.upsert({
    where: {
      clientId_month_year: {
        clientId,
        month: data.month,
        year: data.year,
      },
    },
    update: {
      budget: data.budget,
      sales: data.sales,
      leads: data.leads,
      customers: data.customers,
      notes: data.notes,
    },
    create: {
      clientId,
      month: data.month,
      year: data.year,
      budget: data.budget,
      sales: data.sales || 0,
      leads: data.leads || 0,
      customers: data.customers || 0,
      notes: data.notes,
    },
  });
};

export const deleteSalesBudget = async (id: string) => {
  return prisma.portalSalesBudget.delete({
    where: { id },
  });
};

// ==================== CRUD Servicios ====================

export const createServiceStatus = async (clientId: string, data: {
  name: string;
  status?: string;
  progress?: number;
  startDate: Date;
  endDate?: Date;
  deliverables?: string;
  notes?: string;
}) => {
  return prisma.portalServiceStatus.create({
    data: {
      clientId,
      name: data.name,
      status: data.status || 'active',
      progress: data.progress || 0,
      startDate: data.startDate,
      endDate: data.endDate,
      deliverables: data.deliverables,
      notes: data.notes,
    },
  });
};

export const updateServiceStatus = async (id: string, data: {
  name?: string;
  status?: string;
  progress?: number;
  startDate?: Date;
  endDate?: Date;
  deliverables?: string;
  notes?: string;
}) => {
  return prisma.portalServiceStatus.update({
    where: { id },
    data,
  });
};

export const deleteServiceStatus = async (id: string) => {
  return prisma.portalServiceStatus.delete({
    where: { id },
  });
};

// ==================== INVITACIONES ====================

export const createInvitation = async (clientId: string, email: string, invitedBy: string) => {
  // Verificar si ya existe una invitación pendiente para este email
  const existingInvitation = await prisma.portalInvitation.findFirst({
    where: {
      clientId,
      email,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (existingInvitation) {
    throw new Error('Ya existe una invitación pendiente para este email');
  }

  // Verificar si el email ya está registrado como usuario del portal
  const existingUser = await prisma.user.findFirst({
    where: {
      email,
      portalClientId: clientId,
    },
  });

  if (existingUser) {
    throw new Error('Este email ya está registrado como usuario del portal');
  }

  // Crear token único
  const token = randomBytes(32).toString('hex');

  // Expira en 7 días
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  return prisma.portalInvitation.create({
    data: {
      clientId,
      email,
      token,
      expiresAt,
      invitedBy,
    },
  });
};

export const validateInvitation = async (token: string) => {
  const invitation = await prisma.portalInvitation.findUnique({
    where: { token },
    include: {
      client: {
        select: { id: true, name: true, logo: true },
      },
    },
  });

  if (!invitation) {
    throw new Error('Invitación no encontrada');
  }

  if (invitation.usedAt) {
    throw new Error('Esta invitación ya fue utilizada');
  }

  if (invitation.expiresAt < new Date()) {
    throw new Error('Esta invitación ha expirado');
  }

  return invitation;
};

export const acceptInvitation = async (token: string, userData: {
  firebaseUid: string;
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
}) => {
  // Validar la invitación
  const invitation = await validateInvitation(token);

  // Verificar que el email coincide
  if (invitation.email.toLowerCase() !== userData.email.toLowerCase()) {
    throw new Error('El email no coincide con la invitación');
  }

  // Obtener el rol "client"
  const clientRole = await prisma.role.findUnique({
    where: { id: 'client' },
  });

  if (!clientRole) {
    throw new Error('Rol de cliente no encontrado');
  }

  // Crear usuario
  const user = await prisma.user.create({
    data: {
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      password: userData.password,
      firebaseUid: userData.firebaseUid,
      roleId: clientRole.id,
      portalClientId: invitation.clientId,
    },
  });

  // Marcar invitación como usada
  await prisma.portalInvitation.update({
    where: { id: invitation.id },
    data: { usedAt: new Date() },
  });

  return user;
};

export const deleteInvitation = async (id: string) => {
  return prisma.portalInvitation.delete({
    where: { id },
  });
};

export const listPendingInvitations = async (clientId: string) => {
  return prisma.portalInvitation.findMany({
    where: {
      clientId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
};
