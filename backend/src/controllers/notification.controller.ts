import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import notificationService from '../services/notification.service';

const prisma = new PrismaClient();

// Get notifications for the logged-in user
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { limit, unreadOnly } = req.query;

    const notifications = await notificationService.getByUser(userId, {
      limit: limit ? parseInt(limit as string) : 50,
      unreadOnly: unreadOnly === 'true',
    });

    res.json(notifications);
  } catch (error: any) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get unread count
export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const count = await notificationService.getUnreadCount(userId);
    res.json({ count });
  } catch (error: any) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ error: error.message });
  }
};

// Mark notification as read
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { notificationId } = req.params;

    await notificationService.markAsRead(notificationId, userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: error.message });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    await notificationService.markAllAsRead(userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete notification
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { notificationId } = req.params;

    await notificationService.delete(notificationId, userId);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: error.message });
  }
};

// Send task assignment notification (called from frontend)
export const sendTaskNotification = async (req: Request, res: Response) => {
  try {
    const senderId = (req as any).user.userId;
    const { type, taskTitle, taskId, assigneeName, senderName } = req.body;

    // Find user by firstName (team member name)
    const assigneeUser = await prisma.user.findFirst({
      where: {
        firstName: {
          equals: assigneeName,
          mode: 'insensitive',
        },
      },
    });

    if (!assigneeUser) {
      // If user not found, just return success (not all team members may be registered)
      return res.json({ success: true, message: 'User not found, notification skipped' });
    }

    // Don't notify if assigning to self
    if (assigneeUser.id === senderId) {
      return res.json({ success: true, message: 'Self-assignment, notification skipped' });
    }

    let notification;

    if (type === 'task_assigned') {
      notification = await notificationService.create({
        type: 'task_assigned',
        title: 'Nueva tarea asignada',
        message: `${senderName} te asignó la tarea: "${taskTitle}"`,
        recipientId: assigneeUser.id,
        senderId,
        link: '/tareas',
        resourceId: taskId,
        resourceType: 'task',
      });
    } else if (type === 'task_completed') {
      // Find task creator
      const creatorUser = await prisma.user.findFirst({
        where: {
          firstName: {
            equals: assigneeName, // In this case, assigneeName is actually the creator name
            mode: 'insensitive',
          },
        },
      });

      if (creatorUser && creatorUser.id !== senderId) {
        notification = await notificationService.create({
          type: 'task_completed',
          title: 'Tarea completada',
          message: `${senderName} completó la tarea: "${taskTitle}"`,
          recipientId: creatorUser.id,
          senderId,
          link: '/tareas',
          resourceId: taskId,
          resourceType: 'task',
        });
      }
    }

    res.status(201).json({ success: true, notification });
  } catch (error: any) {
    console.error('Error sending task notification:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  sendTaskNotification,
};
