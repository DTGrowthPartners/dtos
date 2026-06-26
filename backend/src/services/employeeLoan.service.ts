import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateEmployeeLoanDto {
  employeeName: string;
  terceroId?: string;
  concept: string;
  totalAmount: number;
  currency?: string;
  date: Date;
  dueDate?: Date;
  notes?: string;
  createdBy: string;
}

export interface UpdateEmployeeLoanDto {
  employeeName?: string;
  terceroId?: string;
  concept?: string;
  totalAmount?: number;
  currency?: string;
  date?: Date;
  dueDate?: Date;
  status?: string;
  notes?: string;
}

export interface CreateLoanPaymentDto {
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

export const employeeLoanService = {
  async getAll(filters?: { status?: string; terceroId?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.terceroId) where.terceroId = filters.terceroId;

    return prisma.employeeLoan.findMany({
      where,
      include: {
        payments: { orderBy: { paidAt: 'desc' } },
        _count: { select: { payments: true } },
      },
      orderBy: [{ status: 'asc' }, { date: 'desc' }],
    });
  },

  async getById(id: string) {
    return prisma.employeeLoan.findUnique({
      where: { id },
      include: { payments: { orderBy: { paidAt: 'desc' } } },
    });
  },

  async create(data: CreateEmployeeLoanDto) {
    // Consecutivo secuencial = max + 1
    const last = await prisma.employeeLoan.findFirst({
      where: { consecutivo: { not: null } },
      orderBy: { consecutivo: 'desc' },
      select: { consecutivo: true },
    });
    const consecutivo = (last?.consecutivo || 0) + 1;

    return prisma.employeeLoan.create({
      data: {
        consecutivo,
        employeeName: data.employeeName,
        terceroId: data.terceroId || null,
        concept: data.concept,
        totalAmount: data.totalAmount,
        paidAmount: 0,
        currency: data.currency || 'COP',
        date: data.date,
        dueDate: data.dueDate || null,
        status: 'pendiente',
        notes: data.notes || null,
        createdBy: data.createdBy,
      },
      include: { payments: true },
    });
  },

  async update(id: string, data: UpdateEmployeeLoanDto) {
    const loan = await prisma.employeeLoan.findUnique({ where: { id } });
    if (!loan) throw new Error('Préstamo no encontrado');

    const total = data.totalAmount ?? loan.totalAmount;
    const status = data.status ?? computeStatus(total, loan.paidAmount, loan.status);

    return prisma.employeeLoan.update({
      where: { id },
      data: { ...data, status },
      include: { payments: { orderBy: { paidAt: 'desc' } } },
    });
  },

  async remove(id: string) {
    return prisma.employeeLoan.delete({ where: { id } });
  },

  async addPayment(loanId: string, data: CreateLoanPaymentDto) {
    const loan = await prisma.employeeLoan.findUnique({ where: { id: loanId } });
    if (!loan) throw new Error('Préstamo no encontrado');

    await prisma.employeeLoanPayment.create({
      data: {
        loanId,
        amount: data.amount,
        currency: data.currency || loan.currency,
        paidAt: data.paidAt || new Date(),
        paymentMethod: data.paymentMethod || null,
        reference: data.reference || null,
        notes: data.notes || null,
      },
    });

    const paidAmount = loan.paidAmount + data.amount;
    const status = computeStatus(loan.totalAmount, paidAmount, loan.status === 'cancelado' ? 'cancelado' : undefined);
    await prisma.employeeLoan.update({ where: { id: loanId }, data: { paidAmount, status } });

    return this.getById(loanId);
  },

  async deletePayment(loanId: string, paymentId: string) {
    const payment = await prisma.employeeLoanPayment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new Error('Abono no encontrado');

    await prisma.employeeLoanPayment.delete({ where: { id: paymentId } });

    const loan = await prisma.employeeLoan.findUnique({ where: { id: loanId } });
    if (loan) {
      const paidAmount = Math.max(0, loan.paidAmount - payment.amount);
      const status = computeStatus(loan.totalAmount, paidAmount, loan.status === 'cancelado' ? 'cancelado' : undefined);
      await prisma.employeeLoan.update({ where: { id: loanId }, data: { paidAmount, status } });
    }

    return this.getById(loanId);
  },

  async summary() {
    const loans = await prisma.employeeLoan.findMany();
    const activos = loans.filter((l) => l.status !== 'cancelado');
    return {
      totalPrestado: activos.reduce((s, l) => s + l.totalAmount, 0),
      totalAbonado: activos.reduce((s, l) => s + l.paidAmount, 0),
      saldoPorCobrar: activos.reduce((s, l) => s + (l.totalAmount - l.paidAmount), 0),
      count: loans.length,
      pendientes: loans.filter((l) => l.status === 'pendiente' || l.status === 'parcial').length,
    };
  },
};
