import { PrismaClient } from '@prisma/client';
import {
  CreateDealDto,
  UpdateDealDto,
  ChangeStageDto,
  MarkAsLostDto,
  MarkAsWonDto,
  CreateActivityDto,
  CreateReminderDto,
  PipelineMetricsDto,
  PerformanceMetricsDto,
  DealAlert,
} from '../dtos/crm.dto';

const prisma = new PrismaClient();

// ==================== Helper Functions ====================

const calculateDealAlerts = (deal: any): DealAlert[] => {
  const alerts: DealAlert[] = [];
  const now = new Date();

  // Calculate days since last interaction
  const lastInteraction = deal.lastInteractionAt ? new Date(deal.lastInteractionAt) : new Date(deal.createdAt);
  const daysSinceInteraction = Math.floor((now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24));

  // Alert: No interaction for 3+ days
  if (daysSinceInteraction >= 3 && !deal.stage?.isWon && !deal.stage?.isLost) {
    alerts.push({
      type: 'no_interaction',
      message: `${daysSinceInteraction} días sin interacción`,
      severity: daysSinceInteraction >= 7 ? 'urgent' : daysSinceInteraction >= 5 ? 'high' : 'medium',
    });
  }

  // Alert: Follow-up overdue
  if (deal.nextFollowUp) {
    const followUpDate = new Date(deal.nextFollowUp);
    if (followUpDate < now && !deal.stage?.isWon && !deal.stage?.isLost) {
      const daysOverdue = Math.floor((now.getTime() - followUpDate.getTime()) / (1000 * 60 * 60 * 24));
      alerts.push({
        type: 'follow_up_overdue',
        message: `Seguimiento vencido hace ${daysOverdue} día(s)`,
        severity: daysOverdue >= 3 ? 'urgent' : daysOverdue >= 1 ? 'high' : 'medium',
      });
    }
  }

  // Alert: High value deal dormant
  const HIGH_VALUE_THRESHOLD = 1000000; // 1M COP
  if (deal.estimatedValue && deal.estimatedValue >= HIGH_VALUE_THRESHOLD && daysSinceInteraction >= 3) {
    alerts.push({
      type: 'high_value_dormant',
      message: 'Prospecto de alto valor sin actividad reciente',
      severity: 'urgent',
    });
  }

  // Alert: Meeting coming up in 24h
  if (deal.meetingScheduledAt) {
    const meetingDate = new Date(deal.meetingScheduledAt);
    const hoursUntilMeeting = (meetingDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntilMeeting > 0 && hoursUntilMeeting <= 24) {
      alerts.push({
        type: 'meeting_reminder',
        message: 'Reunión en las próximas 24 horas',
        severity: 'high',
      });
    }
  }

  return alerts;
};

const calculateDaysSinceInteraction = (deal: any): number => {
  const lastInteraction = deal.lastInteractionAt ? new Date(deal.lastInteractionAt) : new Date(deal.createdAt);
  return Math.floor((Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24));
};

// ==================== Deal Stages ====================

export const getStages = async () => {
  return prisma.dealStage.findMany({
    orderBy: { position: 'asc' },
    include: {
      _count: {
        select: { deals: true },
      },
    },
  });
};

export const seedDefaultStages = async () => {
  const existingStages = await prisma.dealStage.count();
  if (existingStages > 0) return;

  const stages = [
    { name: 'Nuevo Prospecto', slug: 'nuevo', position: 1, color: '#3B82F6', isWon: false, isLost: false },
    { name: 'Contactado', slug: 'contactado', position: 2, color: '#8B5CF6', isWon: false, isLost: false },
    { name: 'Reunión Agendada', slug: 'reunion', position: 3, color: '#F59E0B', isWon: false, isLost: false },
    { name: 'Propuesta Enviada', slug: 'propuesta', position: 4, color: '#EC4899', isWon: false, isLost: false },
    { name: 'Negociación', slug: 'negociacion', position: 5, color: '#EF4444', isWon: false, isLost: false },
    { name: 'Ganado', slug: 'ganado', position: 6, color: '#10B981', isWon: true, isLost: false },
    { name: 'Perdido', slug: 'perdido', position: 7, color: '#6B7280', isWon: false, isLost: true },
  ];

  await prisma.dealStage.createMany({ data: stages });
};

// ==================== Deals ====================

export const getDeals = async (filters?: {
  stageId?: string;
  ownerId?: string;
  source?: string;
  search?: string;
  priority?: string;
  hasAlerts?: boolean;
  followUpOverdue?: boolean;
  tags?: string[];
  includeDeleted?: boolean;
}) => {
  const where: any = {
    // By default, exclude soft-deleted deals
    deletedAt: filters?.includeDeleted ? undefined : null,
  };

  if (filters?.stageId) {
    where.stageId = filters.stageId;
  }

  if (filters?.ownerId) {
    where.ownerId = filters.ownerId;
  }

  if (filters?.source) {
    where.source = filters.source;
  }

  if (filters?.priority) {
    where.priority = filters.priority;
  }

  if (filters?.followUpOverdue) {
    where.nextFollowUp = { lt: new Date() };
    where.stage = { isWon: false, isLost: false };
  }

  if (filters?.tags && filters.tags.length > 0) {
    where.tags = { hasSome: filters.tags };
  }

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { company: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { tags: { hasSome: [filters.search] } },
    ];
  }

  const deals = await prisma.deal.findMany({
    where,
    include: {
      stage: true,
      service: {
        select: { id: true, name: true, icon: true },
      },
      owner: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      tercero: true,
      reminders: {
        where: { isCompleted: false },
        orderBy: { remindAt: 'asc' },
        take: 1,
      },
      _count: {
        select: { activities: true },
      },
    },
    orderBy: [{ stageId: 'asc' }, { createdAt: 'desc' }],
  });

  // Calculate days in stage, alerts, and days since interaction for each deal
  const enrichedDeals = deals.map((deal) => {
    const lastStageChange = deal.updatedAt;
    const daysInStage = Math.floor(
      (Date.now() - new Date(lastStageChange).getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysSinceInteraction = calculateDaysSinceInteraction(deal);
    const alerts = calculateDealAlerts(deal);

    return {
      ...deal,
      daysInStage,
      daysSinceInteraction,
      alerts,
      nextReminder: deal.reminders[0] || null,
    };
  });

  // Filter by hasAlerts if specified
  if (filters?.hasAlerts) {
    return enrichedDeals.filter((deal) => deal.alerts.length > 0);
  }

  return enrichedDeals;
};

export const getDeal = async (id: string) => {
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      stage: true,
      service: {
        select: { id: true, name: true, icon: true },
      },
      owner: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      tercero: {
        include: {
          organizacion: true,
        },
      },
      activities: {
        orderBy: { performedAt: 'desc' },
        include: {
          performedByUser: {
            select: { id: true, firstName: true, lastName: true },
          },
          fromStage: {
            select: { id: true, name: true, color: true },
          },
          toStage: {
            select: { id: true, name: true, color: true },
          },
        },
      },
      reminders: {
        orderBy: { remindAt: 'asc' },
        include: {
          assignedToUser: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
    },
  });

  if (!deal) return null;

  const daysInStage = Math.floor(
    (Date.now() - new Date(deal.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysSinceInteraction = calculateDaysSinceInteraction(deal);
  const alerts = calculateDealAlerts(deal);

  return {
    ...deal,
    daysInStage,
    daysSinceInteraction,
    alerts,
    nextReminder: deal.reminders.find((r) => !r.isCompleted) || null,
  };
};

export const createDeal = async (data: CreateDealDto, userId: string) => {
  // First ensure default stages exist
  await seedDefaultStages();

  // If no stageId provided, use the first stage
  let stageId = data.stageId;
  if (!stageId) {
    const firstStage = await prisma.dealStage.findFirst({
      orderBy: { position: 'asc' },
    });
    if (!firstStage) throw new Error('No stages found. Please seed stages first.');
    stageId = firstStage.id;
  }

  // If company is provided, find or create Organizacion
  let organizacionId: string | undefined;
  if (data.company) {
    const existingOrg = await prisma.organizacion.findFirst({
      where: { nombre: { equals: data.company, mode: 'insensitive' } },
    });

    if (existingOrg) {
      organizacionId = existingOrg.id;
    } else {
      const newOrg = await prisma.organizacion.create({
        data: { nombre: data.company },
      });
      organizacionId = newOrg.id;
    }
  }

  // Create Tercero as prospecto linked to Organizacion
  const tercero = await prisma.tercero.create({
    data: {
      nombre: data.name,
      email: data.email,
      telefono: data.phone,
      telefonoCodigo: data.phoneCountryCode || '+57',
      esProspecto: true,
      esCliente: false,
      organizacionId,
    },
  });

  const deal = await prisma.deal.create({
    data: {
      name: data.name,
      company: data.company,
      phone: data.phone,
      phoneCountryCode: data.phoneCountryCode || '+57',
      email: data.email,
      stageId,
      estimatedValue: data.estimatedValue,
      currency: data.currency || 'COP',
      serviceId: data.serviceId,
      serviceNotes: data.serviceNotes,
      source: data.source,
      sourceDetail: data.sourceDetail,
      ownerId: data.ownerId || userId,
      expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
      notes: data.notes,
      // CRM v2 fields
      probability: data.probability ?? 50,
      priority: data.priority || 'media',
      nextFollowUp: data.nextFollowUp ? new Date(data.nextFollowUp) : null,
      tags: data.tags || [],
      lastInteractionAt: new Date(), // Set to now on creation
      createdBy: userId,
      // Link to Tercero
      terceroId: tercero.id,
    },
    include: {
      stage: true,
      service: {
        select: { id: true, name: true, icon: true },
      },
      owner: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      tercero: true,
    },
  });

  // Create initial activity
  await prisma.dealActivity.create({
    data: {
      dealId: deal.id,
      type: 'note',
      title: 'Deal creado',
      description: `Prospecto ${deal.name} agregado al pipeline`,
      performedBy: userId,
    },
  });

  return deal;
};

export const updateDeal = async (id: string, data: UpdateDealDto, userId: string) => {
  const existingDeal = await prisma.deal.findUnique({ where: { id } });
  if (!existingDeal) throw new Error('Deal not found');

  // If stage is changing, track it
  const stageChanged = data.stageId && data.stageId !== existingDeal.stageId;

  const deal = await prisma.deal.update({
    where: { id },
    data: {
      name: data.name,
      company: data.company,
      phone: data.phone,
      phoneCountryCode: data.phoneCountryCode,
      email: data.email,
      stageId: data.stageId,
      estimatedValue: data.estimatedValue,
      currency: data.currency,
      serviceId: data.serviceId,
      serviceNotes: data.serviceNotes,
      source: data.source,
      sourceDetail: data.sourceDetail,
      ownerId: data.ownerId,
      firstContactAt: data.firstContactAt ? new Date(data.firstContactAt) : undefined,
      meetingScheduledAt: data.meetingScheduledAt ? new Date(data.meetingScheduledAt) : undefined,
      proposalSentAt: data.proposalSentAt ? new Date(data.proposalSentAt) : undefined,
      expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
      notes: data.notes,
      // CRM v2 fields
      probability: data.probability,
      priority: data.priority,
      nextFollowUp: data.nextFollowUp ? new Date(data.nextFollowUp) : undefined,
      tags: data.tags,
    },
    include: {
      stage: true,
      service: {
        select: { id: true, name: true, icon: true },
      },
      owner: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  // Create stage change activity if needed
  if (stageChanged && data.stageId) {
    await prisma.dealActivity.create({
      data: {
        dealId: id,
        type: 'stage_change',
        title: 'Cambio de etapa',
        fromStageId: existingDeal.stageId,
        toStageId: data.stageId,
        performedBy: userId,
      },
    });
  }

  return deal;
};

export const changeStage = async (id: string, data: ChangeStageDto, userId: string) => {
  const existingDeal = await prisma.deal.findUnique({ where: { id } });
  if (!existingDeal) throw new Error('Deal not found');

  const newStage = await prisma.dealStage.findUnique({ where: { id: data.stageId } });
  if (!newStage) throw new Error('Stage not found');

  // Update the deal stage
  const deal = await prisma.deal.update({
    where: { id },
    data: {
      stageId: data.stageId,
      // Update timestamps based on stage
      ...(newStage.slug === 'contactado' && !existingDeal.firstContactAt
        ? { firstContactAt: new Date() }
        : {}),
      ...(newStage.slug === 'reunion' && !existingDeal.meetingScheduledAt
        ? { meetingScheduledAt: new Date() }
        : {}),
      ...(newStage.slug === 'propuesta' && !existingDeal.proposalSentAt
        ? { proposalSentAt: new Date() }
        : {}),
    },
    include: {
      stage: true,
      service: {
        select: { id: true, name: true, icon: true },
      },
      owner: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  // Create stage change activity
  await prisma.dealActivity.create({
    data: {
      dealId: id,
      type: 'stage_change',
      title: 'Cambio de etapa',
      description: data.notes,
      fromStageId: existingDeal.stageId,
      toStageId: data.stageId,
      performedBy: userId,
    },
  });

  return deal;
};

export const markAsLost = async (id: string, data: MarkAsLostDto, userId: string) => {
  const lostStage = await prisma.dealStage.findFirst({ where: { isLost: true } });
  if (!lostStage) throw new Error('Lost stage not found');

  const existingDeal = await prisma.deal.findUnique({ where: { id } });
  if (!existingDeal) throw new Error('Deal not found');

  const deal = await prisma.deal.update({
    where: { id },
    data: {
      stageId: lostStage.id,
      lostReason: data.reason,
      lostNotes: data.notes,
      closedAt: new Date(),
    },
    include: {
      stage: true,
    },
  });

  // Create activity
  await prisma.dealActivity.create({
    data: {
      dealId: id,
      type: 'stage_change',
      title: 'Deal perdido',
      description: `Razón: ${data.reason}${data.notes ? `. ${data.notes}` : ''}`,
      fromStageId: existingDeal.stageId,
      toStageId: lostStage.id,
      performedBy: userId,
    },
  });

  return deal;
};

export const markAsWon = async (id: string, data: MarkAsWonDto, userId: string) => {
  const wonStage = await prisma.dealStage.findFirst({ where: { isWon: true } });
  if (!wonStage) throw new Error('Won stage not found');

  const existingDeal = await prisma.deal.findUnique({ where: { id } });
  if (!existingDeal) throw new Error('Deal not found');

  const deal = await prisma.deal.update({
    where: { id },
    data: {
      stageId: wonStage.id,
      estimatedValue: data.finalValue,
      closedAt: new Date(),
    },
    include: {
      stage: true,
    },
  });

  // Convert Tercero from prospecto to cliente
  if (existingDeal.terceroId) {
    await prisma.tercero.update({
      where: { id: existingDeal.terceroId },
      data: {
        esCliente: true,
        esProspecto: false,
      },
    });
  }

  // Create activity
  await prisma.dealActivity.create({
    data: {
      dealId: id,
      type: 'stage_change',
      title: 'Deal ganado',
      description: data.notes || `Valor final: ${data.finalValue}`,
      fromStageId: existingDeal.stageId,
      toStageId: wonStage.id,
      performedBy: userId,
    },
  });

  return deal;
};

export const deleteDeal = async (id: string) => {
  // Soft delete - just mark as deleted
  await prisma.deal.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};

// ==================== Trash Functions ====================

export const getDeletedDeals = async () => {
  const deals = await prisma.deal.findMany({
    where: {
      deletedAt: { not: null },
    },
    include: {
      stage: true,
      service: {
        select: { id: true, name: true, icon: true },
      },
      owner: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
    orderBy: { deletedAt: 'desc' },
  });

  return deals;
};

export const restoreDeal = async (id: string) => {
  const deal = await prisma.deal.update({
    where: { id },
    data: { deletedAt: null },
    include: {
      stage: true,
      service: {
        select: { id: true, name: true, icon: true },
      },
    },
  });
  return deal;
};

export const permanentlyDeleteDeal = async (id: string) => {
  // First, get the deal to check if it has a tercero associated
  const deal = await prisma.deal.findUnique({
    where: { id },
    select: { terceroId: true, deletedAt: true },
  });

  if (!deal) throw new Error('Deal not found');
  if (!deal.deletedAt) throw new Error('Deal must be in trash before permanent deletion');

  // Permanently delete the deal (activities and reminders cascade automatically)
  await prisma.deal.delete({ where: { id } });
};

export const emptyTrash = async () => {
  // Delete all soft-deleted deals permanently
  const result = await prisma.deal.deleteMany({
    where: {
      deletedAt: { not: null },
    },
  });
  return result.count;
};

// ==================== Public Lead Capture ====================

export interface PublicLeadDto {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  source?: string;
  sourceDetail?: string;
}

// Helper to get or create system user for public API operations
const getSystemUserId = async (): Promise<string> => {
  const SYSTEM_EMAIL = 'system@dtgrowthpartners.com';

  // Try to find existing system user
  let systemUser = await prisma.user.findUnique({
    where: { email: SYSTEM_EMAIL },
  });

  // If not exists, create one
  if (!systemUser) {
    // First get or create a system role
    let systemRole = await prisma.role.findFirst({
      where: { name: 'System' },
    });

    if (!systemRole) {
      systemRole = await prisma.role.create({
        data: {
          name: 'System',
          description: 'System user for automated operations',
          permissions: [],
        },
      });
    }

    systemUser = await prisma.user.create({
      data: {
        email: SYSTEM_EMAIL,
        firstName: 'Sistema',
        lastName: 'Automático',
        phone: '',
        roleId: systemRole.id,
      },
    });
  }

  return systemUser.id;
};

export const createPublicLead = async (data: PublicLeadDto) => {
  // Ensure default stages exist
  await seedDefaultStages();

  // Get system user ID for foreign key constraints
  const systemUserId = await getSystemUserId();

  // Get the first stage (Nuevo Prospecto)
  const firstStage = await prisma.dealStage.findFirst({
    orderBy: { position: 'asc' },
  });
  if (!firstStage) throw new Error('No stages found');

  // Create the deal name from first and last name
  const dealName = `${data.firstName} ${data.lastName}`.trim();

  // If company is provided, find or create Organizacion
  let organizacionId: string | undefined;
  if (data.company) {
    const existingOrg = await prisma.organizacion.findFirst({
      where: { nombre: { equals: data.company, mode: 'insensitive' } },
    });

    if (existingOrg) {
      organizacionId = existingOrg.id;
    } else {
      const newOrg = await prisma.organizacion.create({
        data: { nombre: data.company },
      });
      organizacionId = newOrg.id;
    }
  }

  // Create Tercero as prospecto linked to Organizacion
  const tercero = await prisma.tercero.create({
    data: {
      nombre: dealName,
      email: data.email,
      telefono: data.phone,
      telefonoCodigo: '+57',
      esProspecto: true,
      esCliente: false,
      organizacionId,
    },
  });

  const deal = await prisma.deal.create({
    data: {
      name: dealName,
      company: data.company,
      phone: data.phone,
      phoneCountryCode: '+57',
      email: data.email,
      stageId: firstStage.id,
      currency: 'COP',
      source: data.source || 'web',
      sourceDetail: data.sourceDetail || 'Formulario externo',
      notes: data.message,
      probability: 50,
      priority: 'media',
      lastInteractionAt: new Date(),
      createdBy: systemUserId,
      // Link to Tercero
      terceroId: tercero.id,
    },
    include: {
      stage: true,
      tercero: true,
    },
  });

  // Create initial activity
  await prisma.dealActivity.create({
    data: {
      dealId: deal.id,
      type: 'note',
      title: 'Lead recibido via formulario externo',
      description: data.message || 'Lead capturado desde formulario web',
      performedBy: systemUserId,
    },
  });

  return deal;
};

// ==================== Activities ====================

export const getActivities = async (dealId: string) => {
  return prisma.dealActivity.findMany({
    where: { dealId },
    orderBy: { performedAt: 'desc' },
    include: {
      performedByUser: {
        select: { id: true, firstName: true, lastName: true },
      },
      fromStage: {
        select: { id: true, name: true, color: true },
      },
      toStage: {
        select: { id: true, name: true, color: true },
      },
    },
  });
};

export const createActivity = async (dealId: string, data: CreateActivityDto, userId: string) => {
  // Update lastInteractionAt on the deal
  await prisma.deal.update({
    where: { id: dealId },
    data: { lastInteractionAt: new Date() },
  });

  return prisma.dealActivity.create({
    data: {
      dealId,
      type: data.type,
      title: data.title,
      description: data.description,
      performedBy: userId,
    },
    include: {
      performedByUser: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });
};

// ==================== Reminders ====================

export const getPendingReminders = async (userId?: string) => {
  const where: any = { isCompleted: false };
  if (userId) {
    where.OR = [{ assignedTo: userId }, { createdBy: userId }];
  }

  return prisma.dealReminder.findMany({
    where,
    orderBy: { remindAt: 'asc' },
    include: {
      deal: {
        select: { id: true, name: true, company: true },
      },
      assignedToUser: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });
};

export const createReminder = async (dealId: string, data: CreateReminderDto, userId: string) => {
  return prisma.dealReminder.create({
    data: {
      dealId,
      title: data.title,
      remindAt: new Date(data.remindAt),
      assignedTo: data.assignedTo || userId,
      createdBy: userId,
    },
    include: {
      deal: {
        select: { id: true, name: true, company: true },
      },
      assignedToUser: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });
};

export const completeReminder = async (id: string) => {
  return prisma.dealReminder.update({
    where: { id },
    data: {
      isCompleted: true,
      completedAt: new Date(),
    },
  });
};

export const deleteReminder = async (id: string) => {
  await prisma.dealReminder.delete({ where: { id } });
};

// ==================== Metrics ====================

export const getPipelineMetrics = async (): Promise<PipelineMetricsDto> => {
  const stages = await prisma.dealStage.findMany({
    orderBy: { position: 'asc' },
  });

  const stagesBreakdown = await Promise.all(
    stages
      .filter((s) => !s.isWon && !s.isLost)
      .map(async (stage) => {
        const deals = await prisma.deal.findMany({
          where: { stageId: stage.id },
          select: { estimatedValue: true },
        });
        return {
          stageId: stage.id,
          stageName: stage.name,
          stageColor: stage.color,
          count: deals.length,
          value: deals.reduce((sum, d) => sum + (d.estimatedValue || 0), 0),
        };
      })
  );

  const pipelineValue = stagesBreakdown.reduce((sum, s) => sum + s.value, 0);
  const activeDeals = stagesBreakdown.reduce((sum, s) => sum + s.count, 0);

  // Deals needing follow-up (no activity in 3+ days)
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const dealsNeedingFollowUp = await prisma.deal.count({
    where: {
      stage: { isWon: false, isLost: false },
      OR: [
        {
          activities: {
            none: {},
          },
        },
        {
          activities: {
            every: {
              performedAt: { lt: threeDaysAgo },
            },
          },
        },
      ],
    },
  });

  return {
    pipelineValue,
    activeDeals,
    stagesBreakdown,
    dealsNeedingFollowUp,
  };
};

export const getPerformanceMetrics = async (days: number = 90): Promise<PerformanceMetricsDto> => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const wonStage = await prisma.dealStage.findFirst({ where: { isWon: true } });
  const lostStage = await prisma.dealStage.findFirst({ where: { isLost: true } });

  const closedDeals = await prisma.deal.findMany({
    where: {
      closedAt: { gte: startDate },
      OR: [{ stageId: wonStage?.id }, { stageId: lostStage?.id }],
    },
    select: {
      stageId: true,
      estimatedValue: true,
      lostReason: true,
      createdAt: true,
      closedAt: true,
    },
  });

  const wonDeals = closedDeals.filter((d) => d.stageId === wonStage?.id);
  const lostDeals = closedDeals.filter((d) => d.stageId === lostStage?.id);

  const totalWon = wonDeals.length;
  const totalLost = lostDeals.length;
  const winRate = closedDeals.length > 0 ? (totalWon / closedDeals.length) * 100 : 0;
  const wonValue = wonDeals.reduce((sum, d) => sum + (d.estimatedValue || 0), 0);

  // Average sales cycle for won deals
  const salesCycles = wonDeals
    .filter((d) => d.closedAt && d.createdAt)
    .map((d) => {
      const diff = new Date(d.closedAt!).getTime() - new Date(d.createdAt).getTime();
      return diff / (1000 * 60 * 60 * 24);
    });
  const averageSalesCycle =
    salesCycles.length > 0
      ? salesCycles.reduce((sum, c) => sum + c, 0) / salesCycles.length
      : 0;

  // Lost reasons breakdown
  const reasonCounts = lostDeals.reduce(
    (acc, d) => {
      const reason = d.lostReason || 'otro';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const lostReasons = Object.entries(reasonCounts).map(([reason, count]) => ({
    reason,
    count,
    percentage: totalLost > 0 ? (count / totalLost) * 100 : 0,
  }));

  return {
    winRate,
    averageSalesCycle,
    totalWon,
    totalLost,
    wonValue,
    lostReasons,
  };
};

export default {
  getStages,
  seedDefaultStages,
  getDeals,
  getDeal,
  createDeal,
  updateDeal,
  changeStage,
  markAsLost,
  markAsWon,
  deleteDeal,
  getDeletedDeals,
  restoreDeal,
  permanentlyDeleteDeal,
  emptyTrash,
  createPublicLead,
  getActivities,
  createActivity,
  getPendingReminders,
  createReminder,
  completeReminder,
  deleteReminder,
  getPipelineMetrics,
  getPerformanceMetrics,
};
