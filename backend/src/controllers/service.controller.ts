import { Request, Response } from 'express';
import { ServiceService } from '../services/service.service';

const serviceService = new ServiceService();

export class ServiceController {
  async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const service = await serviceService.create(req.body, userId);
      res.status(201).json(service);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Error creating service' });
    }
  }

  async findAll(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const services = await serviceService.findAll(userId);
      res.json(services);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Error fetching services' });
    }
  }

  async findOne(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const service = await serviceService.findOne(req.params.id, userId);
      res.json(service);
    } catch (error) {
      res.status(404).json({ message: error instanceof Error ? error.message : 'Service not found' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const service = await serviceService.update(req.params.id, req.body, userId);
      res.json(service);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Error updating service' });
    }
  }

  async remove(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const result = await serviceService.remove(req.params.id, userId);
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Error deleting service' });
    }
  }
}
