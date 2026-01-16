import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateAccountDto {
  type: 'receivable' | 'payable';
  entityName: string;
  entityLogo?: string;
  clientId?: string;
  amount: number;
  currency?: string;
  isRecurring?: boolean;
  frequency?: string;
  frequencyDays?: number;
  startDate: Date;
  endDate?: Date;
  concept: string;
  category?: string;
  notes?: string;
  createdBy: string;
}

export interface UpdateAccountDto {
  entityName?: string;
  entityLogo?: string;
  clientId?: string;
  amount?: number;
  currency?: string;
  isRecurring?: boolean;
  frequency?: string;
  frequencyDays?: number;
  startDate?: Date;
  nextDueDate?: Date;
  endDate?: Date;
  concept?: string;
  category?: string;
  status?: string;
  notes?: string;
}

export interface CreatePaymentDto {
  accountId: string;
  amount: number;
  currency?: string;
  paidAt?: Date;
  dueDate?: Date;
  status?: string;
  paymentMethod?: string;
  receiptUrl?: string;
  reference?: string;
  notes?: string;
}

// Calculate next due date based on frequency
function calculateNextDueDate(
  currentDate: Date,
  frequency: string,
  frequencyDays?: number
): Date {
  const next = new Date(currentDate);

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
    case 'custom':
      if (frequencyDays) {
        next.setDate(next.getDate() + frequencyDays);
      }
      break;
    default:
      // For non-standard frequencies, use frequencyDays
      if (frequencyDays) {
        next.setDate(next.getDate() + frequencyDays);
      }
  }

  return next;
}

export const accountService = {
  // Create a new account
  async create(data: CreateAccountDto) {
    const nextDueDate = data.isRecurring && data.frequency
      ? calculateNextDueDate(data.startDate, data.frequency, data.frequencyDays)
      : data.startDate;

    return prisma.account.create({
      data: {
        ...data,
        nextDueDate,
      },
      include: {
        client: true,
        payments: {
          orderBy: { paidAt: 'desc' },
          take: 5,
        },
      },
    });
  },

  // Get all accounts with filters
  async getAll(filters?: {
    type?: 'receivable' | 'payable';
    status?: string;
    clientId?: string;
    category?: string;
  }) {
    const where: any = {};

    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;
    if (filters?.clientId) where.clientId = filters.clientId;
    if (filters?.category) where.category = filters.category;

    return prisma.account.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
        payments: {
          orderBy: { paidAt: 'desc' },
          take: 3,
        },
        _count: {
          select: { payments: true },
        },
      },
      orderBy: [
        { nextDueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  },

  // Get account by ID
  async getById(id: string) {
    return prisma.account.findUnique({
      where: { id },
      include: {
        client: true,
        payments: {
          orderBy: { paidAt: 'desc' },
        },
      },
    });
  },

  // Update account
  async update(id: string, data: UpdateAccountDto) {
    // Recalculate nextDueDate if frequency changes
    let nextDueDate = data.nextDueDate;
    if (data.isRecurring !== undefined || data.frequency || data.frequencyDays) {
      const account = await prisma.account.findUnique({ where: { id } });
      if (account) {
        const isRecurring = data.isRecurring ?? account.isRecurring;
        const frequency = data.frequency ?? account.frequency;
        const frequencyDays = data.frequencyDays ?? account.frequencyDays;
        const startDate = data.startDate ?? account.startDate;

        if (isRecurring && frequency) {
          nextDueDate = calculateNextDueDate(startDate, frequency, frequencyDays ?? undefined);
        }
      }
    }

    return prisma.account.update({
      where: { id },
      data: {
        ...data,
        ...(nextDueDate && { nextDueDate }),
      },
      include: {
        client: true,
        payments: {
          orderBy: { paidAt: 'desc' },
          take: 5,
        },
      },
    });
  },

  // Delete account
  async delete(id: string) {
    return prisma.account.delete({
      where: { id },
    });
  },

  // ==================== PAYMENTS ====================

  // Register a payment
  async registerPayment(data: CreatePaymentDto) {
    const payment = await prisma.accountPayment.create({
      data: {
        ...data,
        paidAt: data.paidAt || new Date(),
      },
    });

    // Update nextDueDate for recurring accounts
    const account = await prisma.account.findUnique({
      where: { id: data.accountId },
    });

    if (account && account.isRecurring && account.frequency) {
      const nextDueDate = calculateNextDueDate(
        account.nextDueDate || new Date(),
        account.frequency,
        account.frequencyDays ?? undefined
      );

      // Check if we've reached the end date
      if (account.endDate && nextDueDate > account.endDate) {
        await prisma.account.update({
          where: { id: data.accountId },
          data: { status: 'completed' },
        });
      } else {
        await prisma.account.update({
          where: { id: data.accountId },
          data: { nextDueDate },
        });
      }
    }

    return payment;
  },

  // Get payments for an account
  async getPayments(accountId: string) {
    return prisma.accountPayment.findMany({
      where: { accountId },
      orderBy: { paidAt: 'desc' },
    });
  },

  // Delete a payment
  async deletePayment(paymentId: string) {
    return prisma.accountPayment.delete({
      where: { id: paymentId },
    });
  },

  // ==================== ANALYTICS ====================

  // Get summary statistics
  async getSummary() {
    const [receivables, payables, upcomingReceivables, upcomingPayables] = await Promise.all([
      // Total receivables
      prisma.account.aggregate({
        where: { type: 'receivable', status: 'active' },
        _sum: { amount: true },
        _count: true,
      }),
      // Total payables
      prisma.account.aggregate({
        where: { type: 'payable', status: 'active' },
        _sum: { amount: true },
        _count: true,
      }),
      // Upcoming receivables (next 30 days)
      prisma.account.findMany({
        where: {
          type: 'receivable',
          status: 'active',
          nextDueDate: {
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: { id: true, amount: true, nextDueDate: true, entityName: true },
      }),
      // Upcoming payables (next 30 days)
      prisma.account.findMany({
        where: {
          type: 'payable',
          status: 'active',
          nextDueDate: {
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: { id: true, amount: true, nextDueDate: true, entityName: true },
      }),
    ]);

    return {
      receivables: {
        total: receivables._sum.amount || 0,
        count: receivables._count,
        upcoming: upcomingReceivables,
      },
      payables: {
        total: payables._sum.amount || 0,
        count: payables._count,
        upcoming: upcomingPayables,
      },
      balance: (receivables._sum.amount || 0) - (payables._sum.amount || 0),
    };
  },

  // Get overdue accounts
  async getOverdue() {
    const now = new Date();
    return prisma.account.findMany({
      where: {
        status: 'active',
        nextDueDate: { lt: now },
      },
      include: {
        client: {
          select: { id: true, name: true, logo: true },
        },
      },
      orderBy: { nextDueDate: 'asc' },
    });
  },
};

export default accountService;
