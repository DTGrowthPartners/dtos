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
} from '../dtos/crm.dto';

const prisma = new PrismaClient();

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
}) => {
  const where: any = {};

  if (filters?.stageId) {
    where.stageId = filters.stageId;
  }

  if (filters?.ownerId) {
    where.ownerId = filters.ownerId;
  }

  if (filters?.source) {
    where.source = filters.source;
  }

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { company: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
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

  // Calculate days in stage for each deal
  return deals.map((deal) => {
    const lastStageChange = deal.updatedAt;
    const daysInStage = Math.floor(
      (Date.now() - new Date(lastStageChange).getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      ...deal,
      daysInStage,
      nextReminder: deal.reminders[0] || null,
    };
  });
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

  return {
    ...deal,
    daysInStage,
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
      createdBy: userId,
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
  await prisma.deal.delete({ where: { id } });
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
  getActivities,
  createActivity,
  getPendingReminders,
  createReminder,
  completeReminder,
  deleteReminder,
  getPipelineMetrics,
  getPerformanceMetrics,
};
