import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, X, Users, Minimize2, Maximize2, ArrowLeft, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
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
      console.log('Direct rooms updated:', rooms);
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
          (!isOpen || isMinimized || view !== 'chat')
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

  const startDirectChat = async (targetUser: TeamUser) => {
    if (!user) return;
    setShowNewChatDialog(false);

    const currentUser = teamUsers.find((u) => u.id === user.id);
    const currentUserName = currentUser?.firstName || 'Usuario';

    try {
      const roomId = await getOrCreateDirectRoom(
        user.id,
        currentUserName,
        targetUser.id,
        targetUser.firstName
      );

      // Add room to directRooms if not already there
      const existingRoom = directRooms.find(r => r.id === roomId);
      if (!existingRoom) {
        const newRoom: ChatRoom = {
          id: roomId,
          name: `${currentUserName} & ${targetUser.firstName}`,
          type: 'direct',
          participants: [user.id, targetUser.id],
          participantNames: {
            [user.id]: currentUserName,
            [targetUser.id]: targetUser.firstName,
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setDirectRooms(prev => [newRoom, ...prev]);
      }

      setActiveRoomId(roomId);
      setActiveRoomName(targetUser.firstName);
      setView('chat');
    } catch (error) {
      console.error('Error creating direct room:', error);
    }
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
    return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateSeparator = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoy';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    } else {
      return date.toLocaleDateString('es-CO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    }
  };

  const shouldShowDateSeparator = (currentMsg: ChatMessage, prevMsg?: ChatMessage) => {
    if (!prevMsg) return true;
    const currentDate = new Date(currentMsg.createdAt).toDateString();
    const prevDate = new Date(prevMsg.createdAt).toDateString();
    return currentDate !== prevDate;
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

  // Filter users by search query
  const filteredUsers = otherUsers.filter((u) =>
    u.firstName.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
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
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </button>
      )}

      {/* Minimized Chat Bar */}
      {isOpen && isMinimized && (
        <button
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Chat</span>
          {totalUnread > 0 && (
            <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
          <X
            className="h-4 w-4 ml-1 hover:opacity-70"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && !isMinimized && (
        <div className="fixed bottom-4 right-4 z-50 w-80 sm:w-96 h-[520px] bg-background border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {view === 'chat' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-primary-foreground hover:bg-primary-foreground/20 flex-shrink-0"
                  onClick={() => setView('list')}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <MessageCircle className="h-5 w-5 flex-shrink-0" />
              <span className="font-semibold truncate">
                {view === 'list' ? 'Chat' : activeRoomName}
              </span>
              {view === 'list' && onlineUsers.length > 0 && (
                <Badge variant="secondary" className="text-xs flex-shrink-0">
                  {onlineUsers.length} online
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {view === 'list' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={() => setShowNewChatDialog(true)}
                  title="Nuevo chat"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setIsMinimized(true)}
              >
                <Minimize2 className="h-4 w-4" />
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

          {view === 'list' ? (
            /* Conversation List */
            <ScrollArea className="flex-1">
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

                {/* Direct Rooms */}
                {directRooms.length > 0 && (
                  <>
                    <div className="my-2 px-3">
                      <p className="text-xs text-muted-foreground font-medium">Mensajes directos</p>
                    </div>

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
                  </>
                )}

                {/* Empty state for direct rooms */}
                {directRooms.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay chats directos</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setShowNewChatDialog(true)}
                      className="text-primary"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Iniciar un chat
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : (
            /* Chat View */
            <>
              {/* Messages */}
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  {messages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No hay mensajes aun</p>
                      <p className="text-xs">Se el primero en escribir!</p>
                    </div>
                  ) : (
                    messages.map((message, idx) => {
                      const isMe = message.senderId === user.id;
                      const prevMessage = messages[idx - 1];
                      const showDateSeparator = shouldShowDateSeparator(message, prevMessage);
                      const showAvatar = idx === 0 || messages[idx - 1].senderId !== message.senderId || showDateSeparator;

                      return (
                        <div key={message.id}>
                          {/* Date Separator */}
                          {showDateSeparator && (
                            <div className="flex items-center justify-center my-3">
                              <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                                {formatDateSeparator(message.createdAt)}
                              </span>
                            </div>
                          )}

                          {/* Message */}
                          <div className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
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
                                <div className={`flex items-center gap-2 mb-0.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {isMe ? 'Tu' : message.senderName}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground/70">
                                    {formatTime(message.createdAt)}
                                  </span>
                                </div>
                              )}
                              <div
                                className={`px-3 py-2 rounded-2xl text-sm ${
                                  isMe
                                    ? 'bg-primary text-primary-foreground rounded-tr-md'
                                    : 'bg-muted rounded-tl-md'
                                }`}
                              >
                                {message.text}
                              </div>
                              {!showAvatar && (
                                <span className="text-[10px] text-muted-foreground/70 mt-0.5">
                                  {formatTime(message.createdAt)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <form onSubmit={handleSendMessage} className="p-3 border-t flex gap-2 flex-shrink-0 bg-background">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button type="submit" size="icon" disabled={!newMessage.trim() || isLoading}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      )}

      {/* New Chat Dialog */}
      <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Nuevo chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuario..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-[300px]">
              <div className="space-y-1">
                {filteredUsers.map((u) => {
                  const isOnline = presence[u.id]?.status === 'online';
                  const isAway = presence[u.id]?.status === 'away';
                  const hasExistingChat = directRooms.some(r => r.participants.includes(u.id));

                  return (
                    <button
                      key={u.id}
                      onClick={() => startDirectChat(u)}
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
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{u.firstName}</span>
                          {hasExistingChat && (
                            <Badge variant="secondary" className="text-xs">
                              Chat existente
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {isOnline ? 'En linea' : isAway ? 'Ausente' : 'Desconectado'}
                        </p>
                      </div>
                    </button>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No se encontraron usuarios</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
