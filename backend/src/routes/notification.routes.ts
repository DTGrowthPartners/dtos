import { Router } from 'express';
import notificationController from '../controllers/notification.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get notifications for logged-in user
router.get('/', notificationController.getNotifications);

// Get unread count
router.get('/unread-count', notificationController.getUnreadCount);

// Mark all as read
router.post('/mark-all-read', notificationController.markAllAsRead);

// Mark single notification as read
router.post('/:notificationId/read', notificationController.markAsRead);

// Delete notification
router.delete('/:notificationId', notificationController.deleteNotification);

// Send task notification (from frontend when assigning tasks)
router.post('/task', notificationController.sendTaskNotification);

export default router;
