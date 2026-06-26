import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreatePayableDto {
  supplierName: string;
  terceroId?: string;
  concept: string;
  category?: string;
  totalAmount: number;
  currency?: string;
  issueDate: Date;
  dueDate?: Date;
  notes?: string;
  createdBy: string;
}

export interface UpdatePayableDto {
  supplierName?: string;
  terceroId?: string;
  concept?: string;
  category?: string;
  totalAmount?: number;
  currency?: string;
  issueDate?: Date;
  dueDate?: Date;
  status?: string;
  notes?: string;
}

export interface CreatePayablePaymentDto {
  amount: number;
  currency?: string;
  paidAt?: Date;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}

// pendiente | parcial | pagado | cancelado
function computeStatus(total: number, paid: number, currentStatus?: string): string {
  if (currentStatus === 'cancelado') return 'cancelado';
  if (paid <= 0) return 'pendiente';
  if (paid >= total) return 'pagado';
  return 'parcial';
}

export const payableService = {
  async getAll(filters?: { status?: string; category?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.category) where.category = filters.category;

    return prisma.payable.findMany({
      where,
      include: {
        payments: { orderBy: { paidAt: 'desc' } },
        _count: { select: { payments: true } },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { issueDate: 'desc' }],
    });
  },

  async getById(id: string) {
    return prisma.payable.findUnique({
      where: { id },
      include: { payments: { orderBy: { paidAt: 'desc' } } },
    });
  },

  async create(data: CreatePayableDto) {
    return prisma.payable.create({
      data: {
        supplierName: data.supplierName,
        terceroId: data.terceroId || null,
        concept: data.concept,
        category: data.category || null,
        totalAmount: data.totalAmount,
        paidAmount: 0,
        currency: data.currency || 'COP',
        issueDate: data.issueDate,
        dueDate: data.dueDate || null,
        status: 'pendiente',
        notes: data.notes || null,
        createdBy: data.createdBy,
      },
      include: { payments: true },
    });
  },

  async update(id: string, data: UpdatePayableDto) {
    const payable = await prisma.payable.findUnique({ where: { id } });
    if (!payable) throw new Error('Cuenta por pagar no encontrada');

    const total = data.totalAmount ?? payable.totalAmount;
    const status = data.status ?? computeStatus(total, payable.paidAmount, payable.status);

    return prisma.payable.update({
      where: { id },
      data: { ...data, status },
      include: { payments: { orderBy: { paidAt: 'desc' } } },
    });
  },

  async remove(id: string) {
    return prisma.payable.delete({ where: { id } });
  },

  async addPayment(payableId: string, data: CreatePayablePaymentDto) {
    const payable = await prisma.payable.findUnique({ where: { id: payableId } });
    if (!payable) throw new Error('Cuenta por pagar no encontrada');

    await prisma.payablePayment.create({
      data: {
        payableId,
        amount: data.amount,
        currency: data.currency || payable.currency,
        paidAt: data.paidAt || new Date(),
        paymentMethod: data.paymentMethod || null,
        reference: data.reference || null,
        notes: data.notes || null,
      },
    });

    const paidAmount = payable.paidAmount + data.amount;
    const status = computeStatus(payable.totalAmount, paidAmount, payable.status === 'cancelado' ? 'cancelado' : undefined);
    await prisma.payable.update({ where: { id: payableId }, data: { paidAmount, status } });

    return this.getById(payableId);
  },

  async deletePayment(payableId: string, paymentId: string) {
    const payment = await prisma.payablePayment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new Error('Abono no encontrado');

    await prisma.payablePayment.delete({ where: { id: paymentId } });

    const payable = await prisma.payable.findUnique({ where: { id: payableId } });
    if (payable) {
      const paidAmount = Math.max(0, payable.paidAmount - payment.amount);
      const status = computeStatus(payable.totalAmount, paidAmount, payable.status === 'cancelado' ? 'cancelado' : undefined);
      await prisma.payable.update({ where: { id: payableId }, data: { paidAmount, status } });
    }

    return this.getById(payableId);
  },

  async summary() {
    const payables = await prisma.payable.findMany();
    const activos = payables.filter((p) => p.status !== 'cancelado');
    const today = new Date();
    return {
      totalFacturado: activos.reduce((s, p) => s + p.totalAmount, 0),
      totalPagado: activos.reduce((s, p) => s + p.paidAmount, 0),
      saldoPorPagar: activos.reduce((s, p) => s + (p.totalAmount - p.paidAmount), 0),
      vencidas: activos.filter((p) => p.status !== 'pagado' && p.dueDate && new Date(p.dueDate) < today).length,
      count: payables.length,
    };
  },
};
