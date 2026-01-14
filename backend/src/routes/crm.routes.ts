import { Router } from 'express';
import crmController from '../controllers/crm.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// ==================== Stages ====================
router.get('/stages', crmController.getStages);

// ==================== Deals ====================
router.get('/deals', crmController.getDeals);
router.get('/deals/:dealId', crmController.getDeal);
router.post('/deals', crmController.createDeal);
router.patch('/deals/:dealId', crmController.updateDeal);
router.patch('/deals/:dealId/stage', crmController.changeStage);
router.post('/deals/:dealId/lost', crmController.markAsLost);
router.post('/deals/:dealId/won', crmController.markAsWon);
router.delete('/deals/:dealId', crmController.deleteDeal);

// ==================== Activities ====================
router.get('/deals/:dealId/activities', crmController.getActivities);
router.post('/deals/:dealId/activities', crmController.createActivity);

// ==================== Reminders ====================
router.get('/reminders/pending', crmController.getPendingReminders);
router.post('/deals/:dealId/reminders', crmController.createReminder);
router.patch('/reminders/:reminderId/complete', crmController.completeReminder);
router.delete('/reminders/:reminderId', crmController.deleteReminder);

// ==================== Metrics ====================
router.get('/metrics/pipeline', crmController.getPipelineMetrics);
router.get('/metrics/performance', crmController.getPerformanceMetrics);

export default router;
