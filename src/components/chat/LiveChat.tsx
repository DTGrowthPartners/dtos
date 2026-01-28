import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, X, Users, Minimize2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import {
  sendMessage,
  subscribeToMessages,
  subscribeToPresence,
  subscribeToUnreadCount,
  setupPresenceListeners,
  initializeGeneralRoom,
  markMessagesAsRead,
} from '@/lib/chatService';
import type { ChatMessage, UserPresence } from '@/types/chatTypes';

interface TeamUser {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  photoUrl?: string;
}

const GENERAL_ROOM_ID = 'general';

// Request notification permission
const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
};

// Show browser notification
const showNotification = (title: string, body: string, icon?: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: icon || '/img/logo.png' });
  }
};

export default function LiveChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [presence, setPresence] = useState<Record<string, UserPresence>>({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [showUsers, setShowUsers] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const { user } = useAuthStore();

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Initialize chat and subscriptions
  useEffect(() => {
    if (!user) return;

    // Initialize general room
    initializeGeneralRoom();

    // Fetch team users
    const fetchTeamUsers = async () => {
      try {
        const data = await apiClient.get<TeamUser[]>('/api/team');
        setTeamUsers(data);
      } catch (error) {
        console.error('Error fetching team users:', error);
      }
    };
    fetchTeamUsers();

    // Setup presence
    const cleanupPresence = setupPresenceListeners(user.id);

    // Subscribe to messages
    const unsubMessages = subscribeToMessages(GENERAL_ROOM_ID, (msgs) => {
      // Check for new messages to show notifications
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        if (
          lastMessageIdRef.current &&
          lastMessageIdRef.current !== lastMsg.id &&
          lastMsg.senderId !== user.id &&
          (!isOpen || isMinimized)
        ) {
          // Show browser notification
          showNotification(
            `Nuevo mensaje de ${lastMsg.senderName}`,
            lastMsg.text.length > 50 ? lastMsg.text.substring(0, 50) + '...' : lastMsg.text,
            lastMsg.senderPhoto
          );
        }
        lastMessageIdRef.current = lastMsg.id;
      }
      setMessages(msgs);
    });

    // Subscribe to presence
    const unsubPresence = subscribeToPresence((p) => {
      setPresence(p);
    });

    // Subscribe to unread count
    const unsubUnread = subscribeToUnreadCount(GENERAL_ROOM_ID, user.id, (count) => {
      setUnreadCount(count);
    });

    return () => {
      cleanupPresence();
      unsubMessages();
      unsubPresence();
      unsubUnread();
    };
  }, [user, isOpen, isMinimized]);

  // Mark messages as read when opening chat
  useEffect(() => {
    if (isOpen && !isMinimized && user && messages.length > 0) {
      const unreadIds = messages
        .filter((m) => !m.readBy?.includes(user.id) && m.senderId !== user.id)
        .map((m) => m.id);

      if (unreadIds.length > 0) {
        markMessagesAsRead(unreadIds, user.id);
      }
    }
  }, [isOpen, isMinimized, messages, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || isLoading) return;

    setIsLoading(true);
    try {
      const currentUser = teamUsers.find((u) => u.id === user.id);
      await sendMessage(
        GENERAL_ROOM_ID,
        newMessage.trim(),
        user.id,
        currentUser?.firstName || user.email?.split('@')[0] || 'Usuario',
        currentUser?.photoUrl
      );
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('es-CO', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getColorFromName = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  const onlineUsers = teamUsers.filter(
    (u) => presence[u.id]?.status === 'online' || presence[u.id]?.status === 'away'
  );

  if (!user) return null;

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center"
        >
          <MessageCircle className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed bottom-4 right-4 z-50 bg-background border border-border rounded-xl shadow-2xl overflow-hidden transition-all ${
            isMinimized ? 'w-72 h-12' : 'w-80 sm:w-96 h-[500px]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <span className="font-semibold">Chat del Equipo</span>
              {onlineUsers.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {onlineUsers.length} online
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setShowUsers(!showUsers)}
              >
                <Users className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Users Panel */}
              {showUsers && (
                <div className="border-b p-3 bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-2">Usuarios en linea</p>
                  <div className="flex flex-wrap gap-2">
                    {teamUsers.map((u) => {
                      const userPresence = presence[u.id];
                      const isOnline = userPresence?.status === 'online';
                      const isAway = userPresence?.status === 'away';

                      return (
                        <div
                          key={u.id}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-background text-xs"
                        >
                          <div className="relative">
                            {u.photoUrl ? (
                              <img
                                src={u.photoUrl}
                                alt={u.firstName}
                                className="h-5 w-5 rounded-full object-cover"
                              />
                            ) : (
                              <div
                                className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${getColorFromName(
                                  u.firstName
                                )}`}
                              >
                                {getInitials(u.firstName)}
                              </div>
                            )}
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background ${
                                isOnline
                                  ? 'bg-green-500'
                                  : isAway
                                  ? 'bg-yellow-500'
                                  : 'bg-gray-400'
                              }`}
                            />
                          </div>
                          <span className={isOnline || isAway ? '' : 'text-muted-foreground'}>
                            {u.firstName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Messages */}
              <ScrollArea className="flex-1 h-[calc(100%-120px)]">
                <div className="p-3 space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No hay mensajes aun</p>
                      <p className="text-xs">Se el primero en escribir!</p>
                    </div>
                  ) : (
                    messages.map((message, idx) => {
                      const isMe = message.senderId === user.id;
                      const showAvatar =
                        idx === 0 || messages[idx - 1].senderId !== message.senderId;

                      return (
                        <div
                          key={message.id}
                          className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}
                        >
                          {showAvatar ? (
                            message.senderPhoto ? (
                              <img
                                src={message.senderPhoto}
                                alt={message.senderName}
                                className="h-7 w-7 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div
                                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${getColorFromName(
                                  message.senderName
                                )}`}
                              >
                                {getInitials(message.senderName)}
                              </div>
                            )
                          ) : (
                            <div className="w-7 flex-shrink-0" />
                          )}
                          <div className={`flex flex-col ${isMe ? 'items-end' : ''} max-w-[75%]`}>
                            {showAvatar && (
                              <span className="text-xs text-muted-foreground mb-0.5">
                                {isMe ? 'Tú' : message.senderName}
                              </span>
                            )}
                            <div
                              className={`px-3 py-2 rounded-2xl text-sm ${
                                isMe
                                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                  : 'bg-muted rounded-tl-sm'
                              }`}
                            >
                              {message.text}
                            </div>
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                              {formatTime(message.createdAt)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <form onSubmit={handleSendMessage} className="p-3 border-t flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button type="submit" size="sm" disabled={!newMessage.trim() || isLoading}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
