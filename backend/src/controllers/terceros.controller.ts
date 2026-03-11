import { Request, Response } from 'express';
import { tercerosService } from '../services/terceros.service';
import { googleSheetsService } from '../services/googleSheets.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class TercerosController {
  // ==================== TERCEROS ====================

  async findAll(req: Request, res: Response) {
    try {
      const { esProspecto, esCliente, esProveedor, esEmpleado, estado, search } = req.query;

      const terceros = await tercerosService.findAllTerceros({
        esProspecto: esProspecto === 'true' ? true : esProspecto === 'false' ? false : undefined,
        esCliente: esCliente === 'true' ? true : esCliente === 'false' ? false : undefined,
        esProveedor: esProveedor === 'true' ? true : esProveedor === 'false' ? false : undefined,
        esEmpleado: esEmpleado === 'true' ? true : esEmpleado === 'false' ? false : undefined,
        estado: estado as string,
        search: search as string,
      });

      res.json(terceros);
    } catch (error) {
      console.error('Error in findAll terceros:', error);
      res.status(500).json({ message: 'Error al obtener terceros' });
    }
  }

  async findOne(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tercero = await tercerosService.findTerceroById(id);

      if (!tercero) {
        return res.status(404).json({ message: 'Tercero no encontrado' });
      }

      res.json(tercero);
    } catch (error) {
      console.error('Error in findOne tercero:', error);
      res.status(500).json({ message: 'Error al obtener tercero' });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const tercero = await tercerosService.createTercero(req.body);
      res.status(201).json(tercero);
    } catch (error) {
      console.error('Error in create tercero:', error);
      res.status(400).json({ message: 'Error al crear tercero' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tercero = await tercerosService.updateTercero(id, req.body);
      res.json(tercero);
    } catch (error) {
      console.error('Error in update tercero:', error);
      res.status(400).json({ message: 'Error al actualizar tercero' });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await tercerosService.deleteTercero(id);
      res.status(204).send();
    } catch (error) {
      console.error('Error in delete tercero:', error);
      res.status(400).json({ message: 'Error al eliminar tercero' });
    }
  }

  async convertirACliente(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tercero = await tercerosService.convertirACliente(id);
      res.json(tercero);
    } catch (error) {
      console.error('Error in convertirACliente:', error);
      res.status(400).json({ message: 'Error al convertir a cliente' });
    }
  }

  // ==================== ORGANIZACIONES ====================

  async findAllOrganizaciones(req: Request, res: Response) {
    try {
      const { estado, search } = req.query;
      const organizaciones = await tercerosService.findAllOrganizaciones({
        estado: estado as string,
        search: search as string,
      });
      res.json(organizaciones);
    } catch (error) {
      console.error('Error in findAll organizaciones:', error);
      res.status(500).json({ message: 'Error al obtener organizaciones' });
    }
  }

  async findOneOrganizacion(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const organizacion = await tercerosService.findOrganizacionById(id);

      if (!organizacion) {
        return res.status(404).json({ message: 'Organización no encontrada' });
      }

      res.json(organizacion);
    } catch (error) {
      console.error('Error in findOne organizacion:', error);
      res.status(500).json({ message: 'Error al obtener organización' });
    }
  }

  async createOrganizacion(req: Request, res: Response) {
    try {
      const organizacion = await tercerosService.createOrganizacion(req.body);
      res.status(201).json(organizacion);
    } catch (error) {
      console.error('Error in create organizacion:', error);
      res.status(400).json({ message: 'Error al crear organización' });
    }
  }

  async updateOrganizacion(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const organizacion = await tercerosService.updateOrganizacion(id, req.body);
      res.json(organizacion);
    } catch (error) {
      console.error('Error in update organizacion:', error);
      res.status(400).json({ message: 'Error al actualizar organización' });
    }
  }

  async deleteOrganizacion(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await tercerosService.deleteOrganizacion(id);
      res.status(204).send();
    } catch (error) {
      console.error('Error in delete organizacion:', error);
      res.status(400).json({ message: 'Error al eliminar organización' });
    }
  }

  // ==================== CLIENTES (para asociar terceros) ====================

  async findAllClients(req: Request, res: Response) {
    try {
      const clients = await tercerosService.findAllClients();
      res.json(clients);
    } catch (error) {
      console.error('Error in findAll clients:', error);
      res.status(500).json({ message: 'Error al obtener clientes' });
    }
  }

  // ==================== ESTADÍSTICAS ====================

  async getEstadisticas(req: Request, res: Response) {
    try {
      const stats = await tercerosService.getEstadisticas();
      res.json(stats);
    } catch (error) {
      console.error('Error in getEstadisticas:', error);
      res.status(500).json({ message: 'Error al obtener estadísticas' });
    }
  }

  // ==================== SYNC FROM GOOGLE SHEETS ====================

  async syncFromSheets(req: Request, res: Response) {
    try {
      // 1. Read all terceros from Google Sheets
      const sheetsTerceros = await googleSheetsService.getTerceros();

      // 2. Read all existing terceros from Prisma
      const existingTerceros = await prisma.tercero.findMany({
        select: { id: true, nombre: true },
      });

      // Build a lookup map by normalized name
      const existingMap = new Map<string, string>();
      for (const t of existingTerceros) {
        existingMap.set(t.nombre.toLowerCase().trim(), t.id);
      }

      let created = 0;
      let updated = 0;
      const details: { nombre: string; action: 'created' | 'updated' }[] = [];

      for (const st of sheetsTerceros) {
        if (!st.nombre || !st.nombre.trim()) continue;

        // Map tipo to boolean flags
        const esCliente = st.tipo === 'cliente';
        const esProveedor = st.tipo === 'proveedor' || st.tipo === 'freelancer';
        const esEmpleado = st.tipo === 'empleado';

        const data = {
          nombre: st.nombre.trim(),
          email: st.email || undefined,
          telefono: st.telefono || undefined,
          documento: st.nit || undefined,
          esCliente,
          esProveedor,
          esEmpleado,
          categoriaProveedor: st.tipo === 'proveedor' || st.tipo === 'freelancer' ? (st.categoria || undefined) : undefined,
          estado: st.estado || 'activo',
        };

        const existingId = existingMap.get(st.nombre.toLowerCase().trim());

        if (existingId) {
          // Update existing - only update fields that have values from Sheets
          const updateData: any = {};
          if (data.email) updateData.email = data.email;
          if (data.telefono) updateData.telefono = data.telefono;
          if (data.documento) updateData.documento = data.documento;
          updateData.esCliente = data.esCliente;
          updateData.esProveedor = data.esProveedor;
          updateData.esEmpleado = data.esEmpleado;
          if (data.categoriaProveedor) updateData.categoriaProveedor = data.categoriaProveedor;
          updateData.estado = data.estado;

          await prisma.tercero.update({
            where: { id: existingId },
            data: updateData,
          });
          updated++;
          details.push({ nombre: st.nombre, action: 'updated' });
        } else {
          // Create new
          await prisma.tercero.create({ data });
          created++;
          details.push({ nombre: st.nombre, action: 'created' });
        }
      }

      console.log(`[Terceros Sync] ${created} creados, ${updated} actualizados de ${sheetsTerceros.length} en Sheets`);

      res.json({
        success: true,
        message: `Sincronización completada: ${created} creados, ${updated} actualizados`,
        created,
        updated,
        total: sheetsTerceros.length,
        details,
      });
    } catch (error) {
      console.error('Error in syncFromSheets:', error);
      res.status(500).json({ message: 'Error al sincronizar terceros desde Google Sheets' });
    }
  }
}

export const tercerosController = new TercerosController();
