import { Request, Response } from 'express';
import accountService from '../services/account.service';

// Get all accounts
export const getAccounts = async (req: Request, res: Response) => {
  try {
    const { type, status, clientId, category } = req.query;

    const accounts = await accountService.getAll({
      type: type as 'receivable' | 'payable' | undefined,
      status: status as string | undefined,
      clientId: clientId as string | undefined,
      category: category as string | undefined,
    });

    res.json(accounts);
  } catch (error: any) {
    console.error('Error getting accounts:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get account by ID
export const getAccountById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const account = await accountService.getById(id);

    if (!account) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    res.json(account);
  } catch (error: any) {
    console.error('Error getting account:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create account
export const createAccount = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const data = req.body;

    const account = await accountService.create({
      ...data,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      createdBy: userId,
    });

    res.status(201).json(account);
  } catch (error: any) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update account
export const updateAccount = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const account = await accountService.update(id, {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    });

    res.json(account);
  } catch (error: any) {
    console.error('Error updating account:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete account
export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await accountService.delete(id);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: error.message });
  }
};

// Register payment
export const registerPayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const payment = await accountService.registerPayment({
      accountId: id,
      ...data,
      paidAt: data.paidAt ? new Date(data.paidAt) : undefined,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    });

    res.status(201).json(payment);
  } catch (error: any) {
    console.error('Error registering payment:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get payments for an account
export const getPayments = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payments = await accountService.getPayments(id);
    res.json(payments);
  } catch (error: any) {
    console.error('Error getting payments:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete payment
export const deletePayment = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    await accountService.deletePayment(paymentId);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get summary
export const getSummary = async (_req: Request, res: Response) => {
  try {
    const summary = await accountService.getSummary();
    res.json(summary);
  } catch (error: any) {
    console.error('Error getting summary:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get overdue accounts
export const getOverdue = async (_req: Request, res: Response) => {
  try {
    const overdue = await accountService.getOverdue();
    res.json(overdue);
  } catch (error: any) {
    console.error('Error getting overdue accounts:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get client balances
export const getClientBalances = async (_req: Request, res: Response) => {
  try {
    const balances = await accountService.getClientBalances();
    res.json(balances);
  } catch (error: any) {
    console.error('Error getting client balances:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get accounts by client
export const getAccountsByClient = async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const accounts = await accountService.getByClient(clientId);
    res.json(accounts);
  } catch (error: any) {
    console.error('Error getting client accounts:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create invoice from account
export const createInvoiceFromAccount = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const { invoiceNumber, clientNit, observaciones } = req.body;

    const invoice = await accountService.createInvoiceFromAccount(id, {
      invoiceNumber,
      clientNit,
      observaciones,
      createdBy: userId,
    });

    res.status(201).json(invoice);
  } catch (error: any) {
    console.error('Error creating invoice from account:', error);
    res.status(500).json({ error: error.message });
  }
};
