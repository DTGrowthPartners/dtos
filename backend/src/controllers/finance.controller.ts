import { Request, Response } from 'express';
import { googleSheetsService } from '../services/googleSheets.service';

export class FinanceController {
  async getFinanceData(req: Request, res: Response) {
    try {
      const data = await googleSheetsService.getFinanceData();
      res.json(data);
    } catch (error) {
      console.error('Error in getFinanceData:', error);
      res.status(500).json({
        message: 'Error al obtener datos financieros',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async addExpense(req: Request, res: Response) {
    try {
      const { fecha, importe, descripcion, categoria, cuenta, entidad } = req.body;

      // Validar campos requeridos
      if (!fecha || !importe || !descripcion || !categoria) {
        return res.status(400).json({
          message: 'Campos requeridos: fecha, importe, descripcion, categoria',
        });
      }

      await googleSheetsService.addExpense({
        fecha,
        importe: Number(importe),
        descripcion,
        categoria,
        cuenta: cuenta || '',
        entidad: entidad || 'DT Growth Partners',
      });

      res.json({ message: 'Gasto agregado correctamente' });
    } catch (error) {
      console.error('Error in addExpense:', error);
      res.status(500).json({
        message: 'Error al agregar gasto',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const financeController = new FinanceController();
