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
}

export const financeController = new FinanceController();
