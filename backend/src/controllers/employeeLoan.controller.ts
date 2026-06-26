import { Request, Response } from 'express';
import { employeeLoanService } from '../services/employeeLoan.service';
import { googleSheetsService } from '../services/googleSheets.service';

export const getSummary = async (_req: Request, res: Response) => {
  try {
    res.json(await employeeLoanService.summary());
  } catch (error: any) {
    console.error('Error getting employee loans summary:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getLoans = async (req: Request, res: Response) => {
  try {
    const { status, terceroId } = req.query;
    const loans = await employeeLoanService.getAll({
      status: status as string | undefined,
      terceroId: terceroId as string | undefined,
    });
    res.json(loans);
  } catch (error: any) {
    console.error('Error getting employee loans:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getLoanById = async (req: Request, res: Response) => {
  try {
    const loan = await employeeLoanService.getById(req.params.id);
    if (!loan) return res.status(404).json({ error: 'Préstamo no encontrado' });
    res.json(loan);
  } catch (error: any) {
    console.error('Error getting employee loan:', error);
    res.status(500).json({ error: error.message });
  }
};

export const createLoan = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const data = req.body;
    if (!data.employeeName || !data.concept || !data.totalAmount || !data.date) {
      return res.status(400).json({ error: 'Campos requeridos: employeeName, concept, totalAmount, date' });
    }
    const loan = await employeeLoanService.create({
      ...data,
      totalAmount: Number(data.totalAmount),
      date: new Date(data.date),
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      createdBy: userId,
    });
    res.status(201).json(loan);
  } catch (error: any) {
    console.error('Error creating employee loan:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateLoan = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const loan = await employeeLoanService.update(req.params.id, {
      ...data,
      totalAmount: data.totalAmount !== undefined ? Number(data.totalAmount) : undefined,
      date: data.date ? new Date(data.date) : undefined,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    });
    res.json(loan);
  } catch (error: any) {
    console.error('Error updating employee loan:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteLoan = async (req: Request, res: Response) => {
  try {
    await employeeLoanService.remove(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting employee loan:', error);
    res.status(500).json({ error: error.message });
  }
};

export const addPayment = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    if (!data.amount) return res.status(400).json({ error: 'El abono requiere un monto' });
    const loan = await employeeLoanService.addPayment(req.params.id, {
      ...data,
      amount: Number(data.amount),
      paidAt: data.paidAt ? new Date(data.paidAt) : undefined,
    });

    // Register in Google Sheets (non-blocking — failure doesn't roll back the payment)
    try {
      const paymentDate = data.paidAt
        ? new Date(data.paidAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      await googleSheetsService.addEmployeeLoanPayment({
        fecha: paymentDate,
        importe: Number(data.amount),
        employeeName: loan.employeeName,
        consecutivo: loan.consecutivo,
        paymentMethod: data.paymentMethod || 'transferencia',
        cuentaDestino: data.cuentaDestino || '',
      });
    } catch (sheetsErr) {
      console.error('Google Sheets write failed (payment already saved):', sheetsErr);
    }

    res.status(201).json(loan);
  } catch (error: any) {
    console.error('Error adding loan payment:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deletePayment = async (req: Request, res: Response) => {
  try {
    const loan = await employeeLoanService.deletePayment(req.params.id, req.params.paymentId);
    res.json(loan);
  } catch (error: any) {
    console.error('Error deleting loan payment:', error);
    res.status(500).json({ error: error.message });
  }
};
