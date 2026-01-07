import { Request, Response } from 'express';
import { TaskService } from '../services/task.service';

const taskService = new TaskService();

export class TaskController {
  async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const task = await taskService.create(req.body, userId);
      res.status(201).json(task);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Error creating task' });
    }
  }

  async findAll(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const tasks = await taskService.findAll(userId);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Error fetching tasks' });
    }
  }

  async findOne(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const task = await taskService.findOne(req.params.id, userId);
      res.json(task);
    } catch (error) {
      res.status(404).json({ message: error instanceof Error ? error.message : 'Task not found' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const task = await taskService.update(req.params.id, req.body, userId);
      res.json(task);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Error updating task' });
    }
  }

  async updatePositions(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const result = await taskService.updatePositions(req.body.updates, userId);
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Error updating positions' });
    }
  }

  async remove(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const result = await taskService.remove(req.params.id, userId);
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Error deleting task' });
    }
  }

  async addComment(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const comment = await taskService.addComment(req.params.id, req.body, userId);
      res.status(201).json(comment);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Error adding comment' });
    }
  }
}
