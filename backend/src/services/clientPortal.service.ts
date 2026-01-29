import { PrismaClient, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as XLSX from 'xlsx';
import { sendClientAccessEmail } from './email.service';
import { admin } from '../app';

const prisma = new PrismaClient();

// ==================== SERVICIOS DEL SISTEMA ====================

// Obtener todos los servicios del sistema (para seleccionar en el portal)
export const getAllServices = async () => {
  return prisma.service.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      name: true,
      description: true,
      icon: true,
      price: true,
      currency: true,
    },
    orderBy: { order: 'asc' },
  });
};

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
    include: {
      service: {
        select: { id: true, name: true, description: true, icon: true },
      },
    },
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
  serviceId?: string; // ID del servicio del sistema (opcional)
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
      serviceId: data.serviceId,
      name: data.name,
      status: data.status || 'active',
      progress: data.progress || 0,
      startDate: data.startDate,
      endDate: data.endDate,
      deliverables: data.deliverables,
      notes: data.notes,
    },
    include: {
      service: {
        select: { id: true, name: true, description: true, icon: true },
      },
    },
  });
};

export const updateServiceStatus = async (id: string, data: {
  serviceId?: string | null;
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
    include: {
      service: {
        select: { id: true, name: true, description: true, icon: true },
      },
    },
  });
};

export const deleteServiceStatus = async (id: string) => {
  return prisma.portalServiceStatus.delete({
    where: { id },
  });
};

// ==================== CREAR ACCESO AL PORTAL ====================

export const createClientAccess = async (clientId: string, email: string, firstName: string, lastName: string, createdBy: string) => {
  // Verificar si el email ya está registrado
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error('Este email ya está registrado en el sistema');
  }

  // Obtener información del cliente
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true },
  });

  if (!client) {
    throw new Error('Cliente no encontrado');
  }

  // Obtener el rol "client"
  let clientRole = await prisma.role.findFirst({
    where: { name: 'client' },
  });

  if (!clientRole) {
    // Crear el rol si no existe
    clientRole = await prisma.role.create({
      data: {
        name: 'client',
        description: 'Usuario del portal de clientes',
        permissions: ['portal:read'],
      },
    });
  }

  // Generar contraseña temporal aleatoria
  const tempPassword = randomBytes(16).toString('hex');

  // Crear usuario en Firebase
  let firebaseUser;
  try {
    firebaseUser = await admin.auth().createUser({
      email,
      password: tempPassword,
      displayName: `${firstName} ${lastName}`,
    });
  } catch (firebaseError: any) {
    if (firebaseError.code === 'auth/email-already-exists') {
      // Si el usuario ya existe en Firebase, obtenerlo
      firebaseUser = await admin.auth().getUserByEmail(email);
    } else {
      throw new Error(`Error al crear usuario en Firebase: ${firebaseError.message}`);
    }
  }

  // Crear usuario en nuestra base de datos
  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      firebaseUid: firebaseUser.uid,
      roleId: clientRole.id,
      portalClientId: clientId,
    },
    include: {
      role: true,
    },
  });

  // Generar link de restablecimiento de contraseña
  const frontendUrl = process.env.FRONTEND_URL || 'https://os.dtgrowthpartners.com';
  let passwordResetLink;
  try {
    passwordResetLink = await admin.auth().generatePasswordResetLink(email, {
      url: `${frontendUrl}/login`,
    });
  } catch (linkError) {
    console.error('Error generating password reset link:', linkError);
    // Usar link genérico si falla
    passwordResetLink = `${frontendUrl}/login`;
  }

  // Enviar email con credenciales
  try {
    await sendClientAccessEmail(email, firstName, client.name, passwordResetLink);
    console.log(`Access email sent to ${email}`);
  } catch (emailError) {
    console.error('Error sending access email:', emailError);
    // No lanzamos error para no bloquear la creación del usuario
  }

  return {
    user,
    passwordResetLink,
  };
};

// Reenviar email de acceso
export const resendClientAccessEmail = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      portalClient: { select: { name: true } },
    },
  });

  if (!user || !user.portalClientId) {
    throw new Error('Usuario no encontrado o no es un usuario del portal');
  }

  const frontendUrl = process.env.FRONTEND_URL || 'https://os.dtgrowthpartners.com';
  const passwordResetLink = await admin.auth().generatePasswordResetLink(user.email, {
    url: `${frontendUrl}/login`,
  });

  await sendClientAccessEmail(
    user.email,
    user.firstName,
    user.portalClient?.name || 'Portal de Clientes',
    passwordResetLink
  );

  return { success: true };
};

// Eliminar usuario del portal
export const deletePortalUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  // Eliminar de Firebase si tiene firebaseUid
  if (user.firebaseUid) {
    try {
      await admin.auth().deleteUser(user.firebaseUid);
    } catch (firebaseError) {
      console.error('Error deleting user from Firebase:', firebaseError);
      // Continuar con la eliminación en nuestra BD
    }
  }

  // Eliminar de nuestra base de datos
  return prisma.user.delete({
    where: { id: userId },
  });
};

// Listar usuarios del portal de un cliente
export const listPortalUsers = async (clientId: string) => {
  return prisma.user.findMany({
    where: { portalClientId: clientId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
};

// ==================== EXCEL FILES ====================

// Subir y parsear archivo Excel
export const uploadExcelFile = async (
  clientId: string,
  uploadedBy: string,
  fileBuffer: Buffer,
  fileName: string,
  name: string,
  description?: string
) => {
  // Parsear el archivo Excel
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetNames = workbook.SheetNames;

  // Convertir cada hoja a JSON
  const data: Record<string, any[]> = {};
  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    data[sheetName] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  }

  return prisma.portalExcelFile.create({
    data: {
      clientId,
      name,
      fileName,
      data: data as any,
      sheetNames,
      description,
      uploadedBy,
    },
  });
};

// Obtener archivos Excel de un cliente
export const getClientExcelFiles = async (clientId: string) => {
  return prisma.portalExcelFile.findMany({
    where: { clientId },
    select: {
      id: true,
      name: true,
      fileName: true,
      sheetNames: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
};

// Obtener un archivo Excel específico con datos
export const getExcelFile = async (id: string, clientId?: string) => {
  const where: Prisma.PortalExcelFileWhereInput = { id };
  if (clientId) where.clientId = clientId;

  return prisma.portalExcelFile.findFirst({
    where,
  });
};

// Eliminar archivo Excel
export const deleteExcelFile = async (id: string) => {
  return prisma.portalExcelFile.delete({
    where: { id },
  });
};

// Actualizar archivo Excel
export const updateExcelFile = async (id: string, data: {
  name?: string;
  description?: string;
}) => {
  return prisma.portalExcelFile.update({
    where: { id },
    data,
  });
};
