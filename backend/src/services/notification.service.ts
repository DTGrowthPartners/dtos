import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateNotificationDto {
  type: string;
  title: string;
  message: string;
  recipientId: string;
  senderId?: string;
  link?: string;
  resourceId?: string;
  resourceType?: string;
}

export const notificationService = {
  // Create a notification
  async create(data: CreateNotificationDto) {
    return prisma.notification.create({
      data,
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
          },
        },
      },
    });
  },

  // Create multiple notifications (e.g., for team assignments)
  async createMany(notifications: CreateNotificationDto[]) {
    return prisma.notification.createMany({
      data: notifications,
    });
  },

  // Get notifications for a user
  async getByUser(userId: string, options?: { limit?: number; unreadOnly?: boolean }) {
    const { limit = 50, unreadOnly = false } = options || {};

    return prisma.notification.findMany({
      where: {
        recipientId: userId,
        ...(unreadOnly && { isRead: false }),
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  // Get unread count for a user
  async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: {
        recipientId: userId,
        isRead: false,
      },
    });
  },

  // Mark notification as read
  async markAsRead(notificationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: {
        id: notificationId,
        recipientId: userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  },

  // Mark all notifications as read for a user
  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: {
        recipientId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  },

  // Delete a notification
  async delete(notificationId: string, userId: string) {
    return prisma.notification.deleteMany({
      where: {
        id: notificationId,
        recipientId: userId,
      },
    });
  },

  // Delete old notifications (cleanup)
  async deleteOldNotifications(daysOld: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true,
      },
    });
  },

  // ==================== HELPER FUNCTIONS FOR SPECIFIC NOTIFICATIONS ====================

  // Notify when a task is assigned
  async notifyTaskAssigned(params: {
    taskTitle: string;
    taskId: string;
    assigneeUserId: string;
    assignerUserId: string;
    assignerName: string;
  }) {
    const { taskTitle, taskId, assigneeUserId, assignerUserId, assignerName } = params;

    // Don't notify if user assigns to themselves
    if (assigneeUserId === assignerUserId) return null;

    return this.create({
      type: 'task_assigned',
      title: 'Nueva tarea asignada',
      message: `${assignerName} te asignó la tarea: "${taskTitle}"`,
      recipientId: assigneeUserId,
      senderId: assignerUserId,
      link: '/tareas',
      resourceId: taskId,
      resourceType: 'task',
    });
  },

  // Notify when a task is completed
  async notifyTaskCompleted(params: {
    taskTitle: string;
    taskId: string;
    completedByUserId: string;
    completedByName: string;
    taskCreatorUserId: string;
  }) {
    const { taskTitle, taskId, completedByUserId, completedByName, taskCreatorUserId } = params;

    // Don't notify if user completes their own task
    if (completedByUserId === taskCreatorUserId) return null;

    return this.create({
      type: 'task_completed',
      title: 'Tarea completada',
      message: `${completedByName} completó la tarea: "${taskTitle}"`,
      recipientId: taskCreatorUserId,
      senderId: completedByUserId,
      link: '/tareas',
      resourceId: taskId,
      resourceType: 'task',
    });
  },

  // Notify when a deal is assigned
  async notifyDealAssigned(params: {
    dealName: string;
    dealId: string;
    assigneeUserId: string;
    assignerUserId: string;
    assignerName: string;
  }) {
    const { dealName, dealId, assigneeUserId, assignerUserId, assignerName } = params;

    if (assigneeUserId === assignerUserId) return null;

    return this.create({
      type: 'deal_assigned',
      title: 'Deal asignado',
      message: `${assignerName} te asignó el deal: "${dealName}"`,
      recipientId: assigneeUserId,
      senderId: assignerUserId,
      link: '/crm',
      resourceId: dealId,
      resourceType: 'deal',
    });
  },

  // Notify about a reminder
  async notifyReminder(params: {
    reminderTitle: string;
    reminderId: string;
    dealName: string;
    assigneeUserId: string;
  }) {
    const { reminderTitle, reminderId, dealName, assigneeUserId } = params;

    return this.create({
      type: 'reminder',
      title: 'Recordatorio',
      message: `Tienes un recordatorio: "${reminderTitle}" para ${dealName}`,
      recipientId: assigneeUserId,
      link: '/crm',
      resourceId: reminderId,
      resourceType: 'reminder',
    });
  },

  // System notification
  async notifySystem(params: {
    title: string;
    message: string;
    recipientId: string;
    link?: string;
  }) {
    return this.create({
      type: 'system',
      ...params,
    });
  },
};

export default notificationService;
