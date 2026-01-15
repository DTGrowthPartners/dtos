import { Request, Response } from 'express';
import { tercerosService } from '../services/terceros.service';

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
}

export const tercerosController = new TercerosController();
