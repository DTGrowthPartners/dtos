import { Request, Response } from 'express';
import { payableService } from '../services/payable.service';

export const getSummary = async (_req: Request, res: Response) => {
  try {
    res.json(await payableService.summary());
  } catch (error: any) {
    console.error('Error getting payables summary:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getPayables = async (req: Request, res: Response) => {
  try {
    const { status, category } = req.query;
    const payables = await payableService.getAll({
      status: status as string | undefined,
      category: category as string | undefined,
    });
    res.json(payables);
  } catch (error: any) {
    console.error('Error getting payables:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getPayableById = async (req: Request, res: Response) => {
  try {
    const payable = await payableService.getById(req.params.id);
    if (!payable) return res.status(404).json({ error: 'Cuenta por pagar no encontrada' });
    res.json(payable);
  } catch (error: any) {
    console.error('Error getting payable:', error);
    res.status(500).json({ error: error.message });
  }
};

export const createPayable = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const data = req.body;
    if (!data.supplierName || !data.concept || !data.totalAmount || !data.issueDate) {
      return res.status(400).json({ error: 'Campos requeridos: supplierName, concept, totalAmount, issueDate' });
    }
    const payable = await payableService.create({
      ...data,
      totalAmount: Number(data.totalAmount),
      issueDate: new Date(data.issueDate),
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      createdBy: userId,
    });
    res.status(201).json(payable);
  } catch (error: any) {
    console.error('Error creating payable:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updatePayable = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const payable = await payableService.update(req.params.id, {
      ...data,
      totalAmount: data.totalAmount !== undefined ? Number(data.totalAmount) : undefined,
      issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    });
    res.json(payable);
  } catch (error: any) {
    console.error('Error updating payable:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deletePayable = async (req: Request, res: Response) => {
  try {
    await payableService.remove(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting payable:', error);
    res.status(500).json({ error: error.message });
  }
};

export const addPayment = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    if (!data.amount) return res.status(400).json({ error: 'El abono requiere un monto' });
    const payable = await payableService.addPayment(req.params.id, {
      ...data,
      amount: Number(data.amount),
      paidAt: data.paidAt ? new Date(data.paidAt) : undefined,
    });
    res.status(201).json(payable);
  } catch (error: any) {
    console.error('Error adding payable payment:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deletePayment = async (req: Request, res: Response) => {
  try {
    const payable = await payableService.deletePayment(req.params.id, req.params.paymentId);
    res.json(payable);
  } catch (error: any) {
    console.error('Error deleting payable payment:', error);
    res.status(500).json({ error: error.message });
  }
};
