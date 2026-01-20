import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import notificationService from '../services/notification.service';

const prisma = new PrismaClient();

// Get notifications for the logged-in user
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { limit, unreadOnly } = req.query;

    console.log('[Notifications] Fetching for userId:', userId);

    const notifications = await notificationService.getByUser(userId, {
      limit: limit ? parseInt(limit as string) : 50,
      unreadOnly: unreadOnly === 'true',
    });

    console.log('[Notifications] Found:', notifications.length, 'notifications');

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
      console.log('[Notifications] Creating task_assigned notification for recipientId:', assigneeUser.id, 'from senderId:', senderId);
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
      console.log('[Notifications] Created notification:', notification?.id);
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
    } else if (type === 'task_comment') {
      // Find task creator to notify about new comment
      console.log('[Notifications] Looking for task creator with name:', assigneeName);

      // Try to find by firstName first, then by full name
      let creatorUser = await prisma.user.findFirst({
        where: {
          firstName: {
            equals: assigneeName,
            mode: 'insensitive',
          },
        },
      });

      // If not found by firstName, try searching in firstName + lastName
      if (!creatorUser) {
        const users = await prisma.user.findMany({
          select: { id: true, firstName: true, lastName: true }
        });
        creatorUser = users.find(u =>
          `${u.firstName} ${u.lastName}`.toLowerCase().trim() === assigneeName.toLowerCase().trim() ||
          u.firstName?.toLowerCase().trim() === assigneeName.toLowerCase().trim()
        ) as typeof creatorUser;
        console.log('[Notifications] Searched all users, found:', creatorUser?.id || 'none');
      }

      if (creatorUser && creatorUser.id !== senderId) {
        console.log('[Notifications] Creating task_comment notification for recipientId:', creatorUser.id, 'from senderId:', senderId);
        notification = await notificationService.create({
          type: 'task_comment',
          title: 'Nuevo comentario en tarea',
          message: `${senderName} comentó en la tarea: "${taskTitle}"`,
          recipientId: creatorUser.id,
          senderId,
          link: '/tareas',
          resourceId: taskId,
          resourceType: 'task',
        });
        console.log('[Notifications] Created task_comment notification:', notification?.id);
      } else {
        console.log('[Notifications] Creator not found or is the sender. creatorUser:', creatorUser?.id, 'senderId:', senderId);
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
