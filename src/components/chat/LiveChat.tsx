import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, X, Users, Minimize2, Maximize2, ArrowLeft, UserCircle } from 'lucide-react';
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
  getOrCreateDirectRoom,
  subscribeToUserRooms,
  getDirectRoomId,
} from '@/lib/chatService';
import type { ChatMessage, UserPresence, ChatRoom } from '@/types/chatTypes';

interface TeamUser {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  photoUrl?: string;
}

type ChatView = 'list' | 'chat';

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
  const [view, setView] = useState<ChatView>('list');
  const [activeRoomId, setActiveRoomId] = useState<string>(GENERAL_ROOM_ID);
  const [activeRoomName, setActiveRoomName] = useState<string>('Chat General');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [presence, setPresence] = useState<Record<string, UserPresence>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [directRooms, setDirectRooms] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const { user } = useAuthStore();

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized && view === 'chat') {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized, view]);

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
        const data = await apiClient.get<TeamUser[]>('/api/users/team');
        setTeamUsers(data);
      } catch (error) {
        console.error('Error fetching team users:', error);
      }
    };
    fetchTeamUsers();

    // Setup presence
    const cleanupPresence = setupPresenceListeners(user.id);

    // Subscribe to presence
    const unsubPresence = subscribeToPresence((p) => {
      setPresence(p);
    });

    // Subscribe to general room unread count
    const unsubGeneralUnread = subscribeToUnreadCount(GENERAL_ROOM_ID, user.id, (count) => {
      setUnreadCounts((prev) => ({ ...prev, [GENERAL_ROOM_ID]: count }));
    });

    // Subscribe to user's direct rooms
    const unsubRooms = subscribeToUserRooms(user.id, (rooms) => {
      setDirectRooms(rooms);
      // Subscribe to unread counts for each direct room
      rooms.forEach((room) => {
        subscribeToUnreadCount(room.id, user.id, (count) => {
          setUnreadCounts((prev) => ({ ...prev, [room.id]: count }));
        });
      });
    });

    return () => {
      cleanupPresence();
      unsubPresence();
      unsubGeneralUnread();
      unsubRooms();
    };
  }, [user]);

  // Subscribe to messages when active room changes
  useEffect(() => {
    if (!user || !activeRoomId) return;

    const unsubMessages = subscribeToMessages(activeRoomId, (msgs) => {
      // Check for new messages to show notifications
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        if (
          lastMessageIdRef.current &&
          lastMessageIdRef.current !== lastMsg.id &&
          lastMsg.senderId !== user.id &&
          (!isOpen || isMinimized || view !== 'chat' || activeRoomId !== lastMsg.roomId)
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

    return () => {
      unsubMessages();
    };
  }, [user, activeRoomId, isOpen, isMinimized, view]);

  // Mark messages as read when viewing chat
  useEffect(() => {
    if (isOpen && !isMinimized && view === 'chat' && user && messages.length > 0) {
      const unreadIds = messages
        .filter((m) => !m.readBy?.includes(user.id) && m.senderId !== user.id)
        .map((m) => m.id);

      if (unreadIds.length > 0) {
        markMessagesAsRead(unreadIds, user.id);
      }
    }
  }, [isOpen, isMinimized, view, messages, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || isLoading) return;

    setIsLoading(true);
    try {
      const currentUser = teamUsers.find((u) => u.id === user.id);
      await sendMessage(
        activeRoomId,
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

  const openGeneralChat = () => {
    setActiveRoomId(GENERAL_ROOM_ID);
    setActiveRoomName('Chat General');
    setView('chat');
  };

  const openDirectChat = async (targetUser: TeamUser) => {
    if (!user) return;
    const currentUser = teamUsers.find((u) => u.id === user.id);
    const roomId = await getOrCreateDirectRoom(
      user.id,
      currentUser?.firstName || 'Usuario',
      targetUser.id,
      targetUser.firstName
    );
    setActiveRoomId(roomId);
    setActiveRoomName(targetUser.firstName);
    setView('chat');
  };

  const openExistingDirectChat = (room: ChatRoom) => {
    if (!user) return;
    const otherUserId = room.participants.find((p) => p !== user.id);
    const otherUserName = otherUserId && room.participantNames
      ? room.participantNames[otherUserId]
      : 'Chat';
    setActiveRoomId(room.id);
    setActiveRoomName(otherUserName || 'Chat');
    setView('chat');
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

  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  const onlineUsers = teamUsers.filter(
    (u) => presence[u.id]?.status === 'online' || presence[u.id]?.status === 'away'
  );

  // Get other users for starting new direct chats (exclude current user)
  const otherUsers = teamUsers.filter((u) => u.id !== user?.id);

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
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {totalUnread > 9 ? '9+' : totalUnread}
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
              {view === 'chat' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={() => setView('list')}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <MessageCircle className="h-5 w-5" />
              <span className="font-semibold">
                {view === 'list' ? 'Chat' : activeRoomName}
              </span>
              {view === 'list' && onlineUsers.length > 0 && (
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
              {view === 'list' ? (
                /* Conversation List */
                <ScrollArea className="h-[calc(100%-56px)]">
                  <div className="p-2">
                    {/* General Chat */}
                    <button
                      onClick={openGeneralChat}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <div className="relative">
                        <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                          <Users className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Chat General</span>
                          {unreadCounts[GENERAL_ROOM_ID] > 0 && (
                            <Badge variant="destructive" className="text-xs h-5 min-w-[20px] flex items-center justify-center">
                              {unreadCounts[GENERAL_ROOM_ID]}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          Chat grupal del equipo
                        </p>
                      </div>
                    </button>

                    {/* Divider */}
                    <div className="my-2 px-3">
                      <p className="text-xs text-muted-foreground font-medium">Mensajes directos</p>
                    </div>

                    {/* Direct Rooms */}
                    {directRooms.map((room) => {
                      const otherUserId = room.participants.find((p) => p !== user.id);
                      const otherUser = teamUsers.find((u) => u.id === otherUserId);
                      const otherUserName = room.participantNames?.[otherUserId || ''] || 'Usuario';
                      const isOnline = otherUserId ? presence[otherUserId]?.status === 'online' : false;
                      const isAway = otherUserId ? presence[otherUserId]?.status === 'away' : false;

                      return (
                        <button
                          key={room.id}
                          onClick={() => openExistingDirectChat(room)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                        >
                          <div className="relative">
                            {otherUser?.photoUrl ? (
                              <img
                                src={otherUser.photoUrl}
                                alt={otherUserName}
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <div
                                className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${getColorFromName(
                                  otherUserName
                                )}`}
                              >
                                {getInitials(otherUserName)}
                              </div>
                            )}
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                                isOnline ? 'bg-green-500' : isAway ? 'bg-yellow-500' : 'bg-gray-400'
                              }`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{otherUserName}</span>
                              {unreadCounts[room.id] > 0 && (
                                <Badge variant="destructive" className="text-xs h-5 min-w-[20px] flex items-center justify-center">
                                  {unreadCounts[room.id]}
                                </Badge>
                              )}
                            </div>
                            {room.lastMessage && (
                              <p className="text-xs text-muted-foreground truncate">
                                {room.lastMessage.text}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}

                    {/* Divider for new chats */}
                    <div className="my-2 px-3">
                      <p className="text-xs text-muted-foreground font-medium">Iniciar conversacion</p>
                    </div>

                    {/* Other users to start new chats */}
                    {otherUsers
                      .filter((u) => !directRooms.some((r) => r.participants.includes(u.id)))
                      .map((u) => {
                        const isOnline = presence[u.id]?.status === 'online';
                        const isAway = presence[u.id]?.status === 'away';

                        return (
                          <button
                            key={u.id}
                            onClick={() => openDirectChat(u)}
                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                          >
                            <div className="relative">
                              {u.photoUrl ? (
                                <img
                                  src={u.photoUrl}
                                  alt={u.firstName}
                                  className="h-10 w-10 rounded-full object-cover"
                                />
                              ) : (
                                <div
                                  className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${getColorFromName(
                                    u.firstName
                                  )}`}
                                >
                                  {getInitials(u.firstName)}
                                </div>
                              )}
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                                  isOnline ? 'bg-green-500' : isAway ? 'bg-yellow-500' : 'bg-gray-400'
                                }`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium">{u.firstName}</span>
                              <p className="text-xs text-muted-foreground">
                                {isOnline ? 'En linea' : isAway ? 'Ausente' : 'Desconectado'}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </ScrollArea>
              ) : (
                /* Chat View */
                <>
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
                                {showAvatar && activeRoomId === GENERAL_ROOM_ID && (
                                  <span className="text-xs text-muted-foreground mb-0.5">
                                    {isMe ? 'Tu' : message.senderName}
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
            </>
          )}
        </div>
      )}
    </>
  );
}
