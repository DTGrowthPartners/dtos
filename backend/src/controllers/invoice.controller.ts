import { Request, Response, NextFunction } from 'express';
import { invoiceService } from '../services/invoice.service';
import { CreateInvoiceDto } from '../dtos/invoice.dto';
import { PrismaClient } from '@prisma/client';
import { googleSheetsService } from '../services/googleSheets.service';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

class InvoiceController {
  public generate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invoiceData: CreateInvoiceDto = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      // Basic validation
      if (!invoiceData.nombre_cliente || !invoiceData.identificacion || !invoiceData.servicios || !invoiceData.fecha) {
        res.status(400).json({ message: 'Missing required fields: nombre_cliente, identificacion, servicios, fecha' });
        return;
      }

      // Validate servicios array
      if (!Array.isArray(invoiceData.servicios) || invoiceData.servicios.length === 0) {
        res.status(400).json({ message: 'Debe incluir al menos un servicio' });
        return;
      }

      for (const servicio of invoiceData.servicios) {
        if (!servicio.descripcion || servicio.descripcion.trim() === '') {
          res.status(400).json({ message: 'Todos los servicios deben tener una descripción' });
          return;
        }
        if (typeof servicio.cantidad !== 'number' || servicio.cantidad <= 0) {
          res.status(400).json({ message: 'La cantidad debe ser un número mayor a 0' });
          return;
        }
        if (typeof servicio.precio_unitario !== 'number' || servicio.precio_unitario < 0) {
          res.status(400).json({ message: 'El precio unitario debe ser un número mayor o igual a 0' });
          return;
        }
      }

      const { generatedPath, invoiceNumber } = await invoiceService.generateInvoicePdf(invoiceData);

      // Calculate total amount
      const totalAmount = invoiceData.servicios.reduce(
        (sum, item) => sum + (item.cantidad * item.precio_unitario),
        0
      );

      // Save invoice record to database
      await prisma.invoice.create({
        data: {
          invoiceNumber,
          clientId: invoiceData.cliente_id || '',
          clientName: invoiceData.nombre_cliente,
          clientNit: invoiceData.identificacion,
          totalAmount,
          fecha: new Date(invoiceData.fecha),
          concepto: invoiceData.concepto,
          servicio: invoiceData.servicio_proyecto,
          observaciones: invoiceData.observaciones,
          filePath: generatedPath,
          createdBy: userId,
        },
      });

      // Ensure the path is absolute before sending
      const absolutePath = path.resolve(generatedPath);

      // Sanitize filename for HTTP headers
      const originalFilename = path.basename(absolutePath);
      // Replace any non-alphanumeric characters (except dots and hyphens) with underscores
      const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${sanitizedFilename}`);

      // Send the file (don't delete it, keep it for records)
      res.sendFile(absolutePath, (err) => {
        if (err) {
          console.error('Error sending file:', err);
          next(err);
        } else {
          console.log('Sent:', absolutePath);
        }
      });
    } catch (error) {
      next(error);
    }
  };

  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invoices = await prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        include: { payments: { orderBy: { paidAt: 'desc' } } },
      });

      res.json(invoices);
    } catch (error) {
      next(error);
    }
  };

  public delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      const invoice = await prisma.invoice.findUnique({
        where: { id },
      });

      if (!invoice) {
        res.status(404).json({ message: 'Invoice not found' });
        return;
      }

      // Delete the PDF file
      try {
        if (fs.existsSync(invoice.filePath)) {
          fs.unlinkSync(invoice.filePath);
        }
      } catch (error) {
        console.error('Error deleting PDF file:', error);
      }

      // Delete the database record
      await prisma.invoice.delete({
        where: { id },
      });

      res.json({ message: 'Invoice deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  public download = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      const invoice = await prisma.invoice.findUnique({
        where: { id },
      });

      if (!invoice) {
        res.status(404).json({ message: 'Invoice not found' });
        return;
      }

      const absolutePath = path.resolve(invoice.filePath);

      if (!fs.existsSync(absolutePath)) {
        res.status(404).json({ message: 'PDF file not found' });
        return;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${path.basename(absolutePath)}`);
      res.sendFile(absolutePath);
    } catch (error) {
      next(error);
    }
  };

  public updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { status, registerInSheets = true, cuenta = 'Principal' } = req.body;

      if (!['pendiente', 'enviada', 'parcial', 'pagada'].includes(status)) {
        res.status(400).json({ message: 'Estado inválido. Debe ser: pendiente, enviada, parcial o pagada' });
        return;
      }

      const invoice = await prisma.invoice.findUnique({
        where: { id },
      });

      if (!invoice) {
        res.status(404).json({ message: 'Invoice not found' });
        return;
      }

      // If marking as paid, optionally register income in Finanzas
      const updateData: any = { status };

      if (status === 'pagada' && invoice.status !== 'pagada') {
        updateData.paidAt = new Date();

        // Only add income to Google Sheets if registerInSheets is true
        if (registerInSheets) {
          const today = new Date().toISOString().split('T')[0];
          await googleSheetsService.addIncome({
            fecha: today,
            importe: invoice.totalAmount,
            descripcion: `Pago cuenta de cobro #${invoice.invoiceNumber.substring(0, 12)} - ${invoice.servicio || 'Servicios'}`,
            categoria: 'PAGO DE CLIENTE',
            cuenta: cuenta,
            entidad: invoice.clientName,
          });
        }
      }

      const updatedInvoice = await prisma.invoice.update({
        where: { id },
        data: updateData,
      });

      res.json(updatedInvoice);
    } catch (error) {
      next(error);
    }
  };

  public getUnpaidInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const unpaidInvoices = await prisma.invoice.findMany({
        where: {
          status: { in: ['pendiente', 'enviada', 'parcial'] },
        },
        include: { payments: { orderBy: { paidAt: 'desc' } } },
        orderBy: { fecha: 'asc' },
      });

      res.json(unpaidInvoices);
    } catch (error) {
      next(error);
    }
  };

  // ==================== PAYMENTS (ABONOS) ====================

  public addPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { amount, paymentMethod, reference, notes, registerInSheets = false, cuenta = 'Principal' } = req.body;

      if (!amount || amount <= 0) {
        res.status(400).json({ message: 'El monto debe ser mayor a 0' });
        return;
      }

      const invoice = await prisma.invoice.findUnique({ where: { id } });
      if (!invoice) {
        res.status(404).json({ message: 'Cuenta de cobro no encontrada' });
        return;
      }

      const remaining = invoice.totalAmount - invoice.paidAmount;
      if (amount > remaining + 0.01) {
        res.status(400).json({ message: `El abono excede el saldo pendiente ($${remaining.toLocaleString()})` });
        return;
      }

      // Create payment record
      await prisma.invoicePayment.create({
        data: { invoiceId: id, amount, paymentMethod, reference, notes },
      });

      // Recalculate paidAmount
      const totalPaid = await prisma.invoicePayment.aggregate({
        where: { invoiceId: id },
        _sum: { amount: true },
      });
      const newPaidAmount = totalPaid._sum.amount || 0;

      // Update invoice status
      let newStatus = invoice.status;
      const updateData: any = { paidAmount: newPaidAmount };

      if (newPaidAmount >= invoice.totalAmount - 0.01) {
        newStatus = 'pagada';
        updateData.status = 'pagada';
        updateData.paidAt = new Date();
      } else if (newPaidAmount > 0) {
        newStatus = 'parcial';
        updateData.status = 'parcial';
      }

      const updated = await prisma.invoice.update({
        where: { id },
        data: updateData,
        include: { payments: { orderBy: { paidAt: 'desc' } } },
      });

      // Register in Google Sheets if requested
      if (registerInSheets) {
        const today = new Date().toISOString().split('T')[0];
        await googleSheetsService.addIncome({
          fecha: today,
          importe: amount,
          descripcion: `Abono cuenta #${invoice.invoiceNumber.substring(0, 12)} - ${invoice.servicio || 'Servicios'}`,
          categoria: 'PAGO DE CLIENTE',
          cuenta,
          entidad: invoice.clientName,
        });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  };

  public getPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const payments = await prisma.invoicePayment.findMany({
        where: { invoiceId: id },
        orderBy: { paidAt: 'desc' },
      });
      res.json(payments);
    } catch (error) {
      next(error);
    }
  };

  public deletePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, paymentId } = req.params;

      await prisma.invoicePayment.delete({ where: { id: paymentId } });

      // Recalculate paidAmount
      const totalPaid = await prisma.invoicePayment.aggregate({
        where: { invoiceId: id },
        _sum: { amount: true },
      });
      const newPaidAmount = totalPaid._sum.amount || 0;

      // Update invoice status
      const invoice = await prisma.invoice.findUnique({ where: { id } });
      if (!invoice) {
        res.status(404).json({ message: 'Invoice not found' });
        return;
      }

      const updateData: any = { paidAmount: newPaidAmount };
      if (newPaidAmount <= 0) {
        updateData.status = invoice.paidAt ? 'enviada' : 'pendiente';
        updateData.paidAt = null;
      } else if (newPaidAmount < invoice.totalAmount - 0.01) {
        updateData.status = 'parcial';
        updateData.paidAt = null;
      }

      const updated = await prisma.invoice.update({
        where: { id },
        data: updateData,
        include: { payments: { orderBy: { paidAt: 'desc' } } },
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  };
}

export const invoiceController = new InvoiceController();
