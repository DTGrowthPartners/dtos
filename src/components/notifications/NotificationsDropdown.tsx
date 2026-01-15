import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, User, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';

interface NotificationSender {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl?: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  resourceId?: string;
  resourceType?: string;
  isRead: boolean;
  readAt?: string;
  sender?: NotificationSender;
  createdAt: string;
}

interface NotificationsDropdownProps {
  className?: string;
  isMisTareasView?: boolean;
}

export function NotificationsDropdown({ className, isMisTareasView }: NotificationsDropdownProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const [notifs, countData] = await Promise.all([
        apiClient.get<Notification[]>('/api/notifications?limit=20'),
        apiClient.get<{ count: number }>('/api/notifications/unread-count'),
      ]);
      setNotifications(notifs);
      setUnreadCount(countData.count);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch notifications on mount and when dropdown opens
  useEffect(() => {
    fetchNotifications();

    // Polling for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Refetch when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  const handleMarkAsRead = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.post(`/api/notifications/${notificationId}/read`, {});
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiClient.post('/api/notifications/mark-all-read', {});
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleDelete = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.delete(`/api/notifications/${notificationId}`);
      const deletedNotif = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (deletedNotif && !deletedNotif.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read when clicking
    if (!notification.isRead) {
      apiClient.post(`/api/notifications/${notification.id}/read`, {}).catch(console.error);
      setNotifications(prev =>
        prev.map(n => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    // Navigate to the linked page
    if (notification.link) {
      navigate(notification.link);
      setIsOpen(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return 'bg-blue-500';
      case 'task_completed':
        return 'bg-green-500';
      case 'deal_assigned':
        return 'bg-purple-500';
      case 'reminder':
        return 'bg-yellow-500';
      case 'system':
        return 'bg-gray-500';
      default:
        return 'bg-primary';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative",
            isMisTareasView ? "text-slate-400 hover:text-slate-200" : "text-muted-foreground hover:text-foreground",
            className
          )}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="font-semibold p-0">Notificaciones</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleMarkAllAsRead}
            >
              <CheckCheck className="h-3 w-3" />
              Marcar todo leído
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />

        {isLoading && notifications.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Cargando...
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No tienes notificaciones</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "flex items-start gap-3 px-3 py-3 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0",
                  !notification.isRead && "bg-primary/5"
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                {/* Sender avatar or icon */}
                <div className="flex-shrink-0 relative">
                  {notification.sender?.photoUrl ? (
                    <img
                      src={notification.sender.photoUrl}
                      alt={notification.sender.firstName}
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                      getNotificationIcon(notification.type)
                    )}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm line-clamp-2",
                    !notification.isRead && "font-medium"
                  )}>
                    {notification.message}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!notification.isRead && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                      onClick={(e) => handleMarkAsRead(notification.id, e)}
                      title="Marcar como leída"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={(e) => handleDelete(notification.id, e)}
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
