import { Request, Response } from 'express';
import crmService from '../services/crm.service';
import {
  CreateDealDto,
  UpdateDealDto,
  ChangeStageDto,
  MarkAsLostDto,
  MarkAsWonDto,
  CreateActivityDto,
  CreateReminderDto,
} from '../dtos/crm.dto';

// ==================== Stages ====================

export const getStages = async (req: Request, res: Response) => {
  try {
    const stages = await crmService.getStages();
    res.json(stages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== Deals ====================

export const getDeals = async (req: Request, res: Response) => {
  try {
    const { stageId, ownerId, source, search } = req.query;
    const deals = await crmService.getDeals({
      stageId: stageId as string,
      ownerId: ownerId as string,
      source: source as string,
      search: search as string,
    });
    res.json(deals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDeal = async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const deal = await crmService.getDeal(dealId);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createDeal = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const data: CreateDealDto = req.body;
    const deal = await crmService.createDeal(data, userId);
    res.status(201).json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateDeal = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { dealId } = req.params;
    const data: UpdateDealDto = req.body;
    const deal = await crmService.updateDeal(dealId, data, userId);
    res.json(deal);
  } catch (error: any) {
    if (error.message === 'Deal not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

export const changeStage = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { dealId } = req.params;
    const data: ChangeStageDto = req.body;
    console.log('Change stage request:', { dealId, data, userId });
    const deal = await crmService.changeStage(dealId, data, userId);
    res.json(deal);
  } catch (error: any) {
    console.error('Change stage error:', error);
    if (error.message === 'Deal not found' || error.message === 'Stage not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

export const markAsLost = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { dealId } = req.params;
    const data: MarkAsLostDto = req.body;
    const deal = await crmService.markAsLost(dealId, data, userId);
    res.json(deal);
  } catch (error: any) {
    if (error.message === 'Deal not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

export const markAsWon = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { dealId } = req.params;
    const data: MarkAsWonDto = req.body;
    const deal = await crmService.markAsWon(dealId, data, userId);
    res.json(deal);
  } catch (error: any) {
    if (error.message === 'Deal not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

export const deleteDeal = async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    await crmService.deleteDeal(dealId);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== Activities ====================

export const getActivities = async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const activities = await crmService.getActivities(dealId);
    res.json(activities);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createActivity = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { dealId } = req.params;
    const data: CreateActivityDto = req.body;
    const activity = await crmService.createActivity(dealId, data, userId);
    res.status(201).json(activity);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== Reminders ====================

export const getPendingReminders = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { userId: filterUserId } = req.query;
    const reminders = await crmService.getPendingReminders(filterUserId as string || userId);
    res.json(reminders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createReminder = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { dealId } = req.params;
    const data: CreateReminderDto = req.body;
    const reminder = await crmService.createReminder(dealId, data, userId);
    res.status(201).json(reminder);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const completeReminder = async (req: Request, res: Response) => {
  try {
    const { reminderId } = req.params;
    const reminder = await crmService.completeReminder(reminderId);
    res.json(reminder);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteReminder = async (req: Request, res: Response) => {
  try {
    const { reminderId } = req.params;
    await crmService.deleteReminder(reminderId);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== Metrics ====================

export const getPipelineMetrics = async (req: Request, res: Response) => {
  try {
    const metrics = await crmService.getPipelineMetrics();
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getPerformanceMetrics = async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const metrics = await crmService.getPerformanceMetrics(days);
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export default {
  getStages,
  getDeals,
  getDeal,
  createDeal,
  updateDeal,
  changeStage,
  markAsLost,
  markAsWon,
  deleteDeal,
  getActivities,
  createActivity,
  getPendingReminders,
  createReminder,
  completeReminder,
  deleteReminder,
  getPipelineMetrics,
  getPerformanceMetrics,
};
