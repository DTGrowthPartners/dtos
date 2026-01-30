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

  async addIncome(req: Request, res: Response) {
    try {
      const { fecha, importe, descripcion, categoria, cuenta, entidad } = req.body;

      // Validar campos requeridos
      if (!fecha || !importe || !descripcion || !categoria) {
        return res.status(400).json({
          message: 'Campos requeridos: fecha, importe, descripcion, categoria',
        });
      }

      await googleSheetsService.addIncome({
        fecha,
        importe: Number(importe),
        descripcion,
        categoria,
        cuenta: cuenta || '',
        entidad: entidad || '',
      });

      res.json({ message: 'Ingreso agregado correctamente' });
    } catch (error) {
      console.error('Error in addIncome:', error);
      res.status(500).json({
        message: 'Error al agregar ingreso',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getBudget(req: Request, res: Response) {
    try {
      const budgetData = await googleSheetsService.getBudgetData();
      res.json(budgetData);
    } catch (error) {
      console.error('Error in getBudget:', error);
      res.status(500).json({
        message: 'Error al obtener datos del presupuesto',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==================== TERCEROS ====================

  async getTerceros(req: Request, res: Response) {
    try {
      const { tipo, estado } = req.query;
      let terceros = await googleSheetsService.getTerceros();

      // Filter by type if specified
      if (tipo) {
        terceros = terceros.filter(t => t.tipo === tipo);
      }

      // Filter by status (default: show only active)
      if (estado) {
        terceros = terceros.filter(t => t.estado === estado);
      } else {
        terceros = terceros.filter(t => t.estado === 'activo');
      }

      res.json(terceros);
    } catch (error) {
      console.error('Error in getTerceros:', error);
      res.status(500).json({
        message: 'Error al obtener terceros',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async addTercero(req: Request, res: Response) {
    try {
      const { tipo, nombre, nit, email, telefono, direccion, categoria, cuentaBancaria, salarioBase, cargo } = req.body;

      if (!tipo || !nombre) {
        return res.status(400).json({
          message: 'Campos requeridos: tipo, nombre',
        });
      }

      const id = await googleSheetsService.addTercero({
        tipo,
        nombre,
        nit,
        email,
        telefono,
        direccion,
        categoria,
        cuentaBancaria,
        salarioBase: salarioBase ? Number(salarioBase) : undefined,
        cargo,
        estado: 'activo',
      });

      res.json({ id, message: 'Tercero agregado correctamente' });
    } catch (error) {
      console.error('Error in addTercero:', error);
      res.status(500).json({
        message: 'Error al agregar tercero',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateTercero(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;

      if (!id) {
        return res.status(400).json({ message: 'ID requerido' });
      }

      await googleSheetsService.updateTercero(id, updates);
      res.json({ message: 'Tercero actualizado correctamente' });
    } catch (error) {
      console.error('Error in updateTercero:', error);
      res.status(500).json({
        message: 'Error al actualizar tercero',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteTercero(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ message: 'ID requerido' });
      }

      await googleSheetsService.deleteTercero(id);
      res.json({ message: 'Tercero eliminado correctamente' });
    } catch (error) {
      console.error('Error in deleteTercero:', error);
      res.status(500).json({
        message: 'Error al eliminar tercero',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==================== NÓMINA ====================

  async getNomina(req: Request, res: Response) {
    try {
      const nomina = await googleSheetsService.getNomina();
      res.json(nomina);
    } catch (error) {
      console.error('Error in getNomina:', error);
      res.status(500).json({
        message: 'Error al obtener nómina',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async addNominaRecord(req: Request, res: Response) {
    try {
      const { fecha, terceroId, terceroNombre, concepto, salarioBase, deducciones, bonificaciones, totalPagado, notas } = req.body;

      if (!fecha || !terceroId || !concepto || totalPagado === undefined) {
        return res.status(400).json({
          message: 'Campos requeridos: fecha, terceroId, concepto, totalPagado',
        });
      }

      const id = await googleSheetsService.addNominaRecord({
        fecha,
        terceroId,
        terceroNombre,
        concepto,
        salarioBase: Number(salarioBase) || 0,
        deducciones: Number(deducciones) || 0,
        bonificaciones: Number(bonificaciones) || 0,
        totalPagado: Number(totalPagado),
        notas,
      });

      res.json({ id, message: 'Registro de nómina agregado correctamente' });
    } catch (error) {
      console.error('Error in addNominaRecord:', error);
      res.status(500).json({
        message: 'Error al agregar registro de nómina',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==================== REPORTS ====================

  async getExpensesByTercero(req: Request, res: Response) {
    try {
      const summary = await googleSheetsService.getExpensesByTercero();
      res.json(summary);
    } catch (error) {
      console.error('Error in getExpensesByTercero:', error);
      res.status(500).json({
        message: 'Error al obtener resumen de gastos',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==================== DISPONIBLE ====================

  async getDisponible(req: Request, res: Response) {
    try {
      const data = await googleSheetsService.getDisponible();
      res.json(data);
    } catch (error) {
      console.error('Error in getDisponible:', error);
      res.status(500).json({
        message: 'Error al obtener saldo disponible',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const financeController = new FinanceController();
