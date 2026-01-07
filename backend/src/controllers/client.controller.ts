import { Request, Response } from 'express';
import { ClientService } from '../services/client.service';

const clientService = new ClientService();

export class ClientController {
  async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const client = await clientService.create(req.body, userId);
      res.status(201).json(client);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Error creating client' });
    }
  }

  async findAll(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const clients = await clientService.findAll(userId);
      res.json(clients);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Error fetching clients' });
    }
  }

  async findOne(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const client = await clientService.findOne(req.params.id, userId);
      res.json(client);
    } catch (error) {
      res.status(404).json({ message: error instanceof Error ? error.message : 'Client not found' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const client = await clientService.update(req.params.id, req.body, userId);
      res.json(client);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Error updating client' });
    }
  }

  async remove(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const result = await clientService.remove(req.params.id, userId);
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Error deleting client' });
    }
  }

  async shareClient(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      const share = await clientService.shareClient(req.params.id, userId, email);
      res.status(201).json(share);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Error sharing client' });
    }
  }
}
