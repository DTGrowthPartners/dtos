import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, X, Users, Minimize2, Maximize2, ArrowLeft, Plus, Search, Sparkles, Trash2, ImagePlus } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
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
  getOrCreateAIRoom,
  createAIConversation,
  subscribeToAIRooms,
  renameRoom,
  deleteRoomCompletely,
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

// Renderiza **negrita** dentro de una línea de texto.
const renderInline = (text: string): React.ReactNode => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p) ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>
  );
};

// Formatea el texto del asistente (María): respeta saltos de línea, negritas y
// listas con viñetas, en vez de mostrar un párrafo plano con asteriscos.
function FormattedMessage({ text }: { text: string }) {
  const lines = (text || '').split('\n');
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = (key: string) => {
    if (!bullets.length) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={key} className="my-1 space-y-1">
        {items.map((b, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="mt-[3px] h-1 w-1 rounded-full bg-current opacity-60 flex-shrink-0" />
            <span className="flex-1 leading-snug">{renderInline(b)}</span>
          </li>
        ))}
      </ul>
    );
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const bulletMatch = line.match(/^\s*[-*•]\s+(.*)$/);
    if (bulletMatch) {
      bullets.push(bulletMatch[1]);
      return;
    }
    flushBullets(`ul-${idx}`);
    if (line.trim() === '') {
      blocks.push(<div key={`sp-${idx}`} className="h-2" />);
    } else {
      blocks.push(
        <p key={`p-${idx}`} className="leading-snug break-words">
          {renderInline(line)}
        </p>
      );
    }
  });
  flushBullets('ul-end');

  return <div className="space-y-0.5">{blocks}</div>;
}

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
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { user, token } = useAuthStore();
  const { toast } = useToast();
  const [aiRoomId, setAiRoomId] = useState<string | null>(null);
  const [aiRooms, setAiRooms] = useState<ChatRoom[]>([]);
  // Imágenes adjuntas (data URLs) para enviar a María (visión)
  const [attachedImages, setAttachedImages] = useState<string[]>([]);

  // Reduce una imagen (máx 1600px, JPEG 0.85) para enviar un payload liviano y
  // acelerar la visión, manteniendo el texto legible para OCR.
  const downscaleToDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new window.Image();
        img.onload = () => {
          const MAX = 1000;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            const s = Math.min(MAX / width, MAX / height);
            width = Math.round(width * s);
            height = Math.round(height * s);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(reader.result as string);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Lee archivos de imagen y los agrega a los adjuntos (reducidos).
  const addImageFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!arr.length) return;
    for (const file of arr.slice(0, 5)) {
      try {
        const url = await downscaleToDataURL(file);
        setAttachedImages((prev) => (prev.length >= 5 ? prev : [...prev, url]));
      } catch {
        toast({ title: 'Error', description: `No se pudo procesar ${file.name}`, variant: 'destructive' });
      }
    }
  };

  // Pegar imágenes desde el portapapeles (pantallazos, fotos copiadas).
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const it of Array.from(items)) {
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      addImageFiles(files);
    }
  };

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

    // Initialize AI room
    const initAIRoom = async () => {
      const currentUser = teamUsers.find((u) => u.id === user.id);
      const userName = currentUser?.firstName || 'Usuario';
      const roomId = await getOrCreateAIRoom(user.id, userName);
      setAiRoomId(roomId);

      // Subscribe to AI room unread count
      subscribeToUnreadCount(roomId, user.id, (count) => {
        setUnreadCounts((prev) => ({ ...prev, [roomId]: count }));
      });
    };
    initAIRoom();

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

    // Subscribe to AI conversations (múltiples chats con María)
    const unsubAIRooms = subscribeToAIRooms(user.id, (rooms) => {
      setAiRooms(rooms);
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
      unsubAIRooms();
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
    if ((!newMessage.trim() && attachedImages.length === 0) || !user || isLoading) return;

    setIsLoading(true);
    try {
      const currentUser = teamUsers.find((u) => u.id === user.id);
      const userName = currentUser?.firstName || user.email?.split('@')[0] || 'Usuario';

      // Detect if it's AI room (cualquier conversación con María)
      const isAIRoom = activeRoomId.startsWith('ai_');

      if (isAIRoom) {
        const imgs = attachedImages;
        const messageText = newMessage.trim();
        // Se guardan el texto y las imágenes (se ven en el historial del chat).
        await sendMessage(activeRoomId, messageText || '', user.id, userName, currentUser?.photoUrl, imgs);
        // Auto-título: si la conversación aún no tiene nombre propio, usa el primer mensaje.
        const room = aiRooms.find((r) => r.id === activeRoomId);
        if (messageText && room && (room.name === 'Nuevo chat' || room.name === 'Chat con IA' || !room.name)) {
          const title = messageText.slice(0, 40) + (messageText.length > 40 ? '…' : '');
          renameRoom(activeRoomId, title).catch(() => {});
          setActiveRoomName(title);
        }
        setNewMessage('');
        setAttachedImages([]);

        // Build conversation history (last 20 messages for context)
        const conversationHistory = messages.slice(-20).map((m) => ({
          role: m.senderId === user.id ? 'user' : 'assistant',
          content: m.text,
        }));

        // Call AI endpoint with tools (incluye imágenes si las hay)
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const response = await fetch(`${API_URL}/api/chat/ai`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: messageText,
            conversationHistory,
            images: imgs,
          }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Error al procesar el mensaje');
        }

        // Save AI response
        await sendMessage(
          activeRoomId,
          data.response,
          'ai_assistant',
          'María',
          undefined
        );
      } else {
        // Regular team chat
        const messageText = newMessage.trim();
        await sendMessage(
          activeRoomId,
          messageText,
          user.id,
          userName,
          currentUser?.photoUrl
        );
        setNewMessage('');
        // Push (PWA) a los participantes que no estén activos en la app.
        apiClient
          .post('/api/chat/notify', { roomId: activeRoomId, senderName: userName, text: messageText })
          .catch(() => {});
      }

      // Refocus input after sending for continuous typing
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: error.message || 'Error al enviar el mensaje',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openGeneralChat = () => {
    setActiveRoomId(GENERAL_ROOM_ID);
    setActiveRoomName('Chat General');
    setView('chat');
  };

  const openAIChat = (roomId?: string, name?: string) => {
    const target = roomId || aiRoomId;
    if (!target) return;
    setActiveRoomId(target);
    setActiveRoomName(name || aiRooms.find((r) => r.id === target)?.name || 'María');
    setView('chat');
    // Mark messages as read will be handled by the useEffect when messages load
  };

  // Crea una NUEVA conversación con María y la abre.
  const handleNewAIChat = async () => {
    if (!user) return;
    const currentUser = teamUsers.find((u) => u.id === user.id);
    const userName = currentUser?.firstName || 'Usuario';
    try {
      const roomId = await createAIConversation(user.id, userName);
      setMessages([]);
      lastMessageIdRef.current = null;
      openAIChat(roomId, 'Nuevo chat');
    } catch (error) {
      console.error('Error creating AI chat:', error);
      toast({ title: 'Error', description: 'No se pudo crear la conversación', variant: 'destructive' });
    }
  };

  // Borra la conversación de IA actual por completo y vuelve a la lista.
  const handleDeleteAIChat = async (roomId?: string) => {
    const target = roomId || activeRoomId;
    if (!target || !target.startsWith('ai_')) return;
    if (!confirm('¿Borrar esta conversación con María? No se puede deshacer.')) return;
    try {
      await deleteRoomCompletely(target);
      if (target === activeRoomId) {
        setMessages([]);
        lastMessageIdRef.current = null;
        setView('list');
      }
      toast({ title: 'Conversación eliminada' });
    } catch (error) {
      console.error('Error deleting AI chat:', error);
      toast({ title: 'Error', description: 'No se pudo eliminar la conversación', variant: 'destructive' });
    }
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
          style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          className="fixed right-4 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center"
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
          style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          className="fixed right-4 z-50 flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all"
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

      {/* Chat Sidebar (panel lateral derecho de altura completa) */}
      {isOpen && !isMinimized && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[400px] bg-background border-l border-border shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="relative z-10 flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {view === 'chat' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 text-primary-foreground hover:bg-primary-foreground/20 flex-shrink-0"
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
                  className="h-9 w-9 p-0 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={() => setShowNewChatDialog(true)}
                  title="Nuevo chat"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              {view === 'chat' && activeRoomId.startsWith('ai_') && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-primary-foreground hover:bg-primary-foreground/20"
                    onClick={handleNewAIChat}
                    title="Nueva conversación"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-primary-foreground hover:bg-primary-foreground/20"
                    onClick={() => handleDeleteAIChat()}
                    title="Borrar esta conversación"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setIsMinimized(true)}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {view === 'list' ? (
            /* Conversation List */
            <div className="flex-1 min-h-0 overflow-y-auto">
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

                {/* AI Chats (María) — múltiples conversaciones */}
                <div className="mt-2">
                  <div className="flex items-center justify-between px-3 py-1">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-purple-500" /> María (IA)
                    </span>
                    <button
                      onClick={handleNewAIChat}
                      className="text-xs flex items-center gap-1 text-primary hover:underline"
                      title="Nueva conversación"
                    >
                      <Plus className="h-3 w-3" /> Nuevo
                    </button>
                  </div>
                  {aiRooms.length === 0 && aiRoomId && (
                    <button
                      onClick={() => openAIChat()}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">María</span>
                        <p className="text-xs text-muted-foreground truncate">Asistente IA</p>
                      </div>
                    </button>
                  )}
                  {aiRooms.map((room) => (
                    <div
                      key={room.id}
                      className={`group w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        activeRoomId === room.id && view === 'chat'
                          ? 'bg-primary/10 border border-primary/20'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <button onClick={() => openAIChat(room.id, room.name)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white flex-shrink-0">
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate">{room.name || 'María'}</span>
                            {unreadCounts[room.id] > 0 && (
                              <Badge variant="destructive" className="text-xs h-5 min-w-[20px] flex-shrink-0">
                                {unreadCounts[room.id]}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {room.lastMessage?.text || 'Asistente IA'}
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={() => handleDeleteAIChat(room.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive flex-shrink-0"
                        title="Borrar conversación"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

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
            </div>
          ) : (
            /* Chat View */
            <>
              {/* Messages */}
              <div className="flex-1 min-h-0 overflow-y-auto">
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
                                {message.images && message.images.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                                    {message.images.map((src, i) => (
                                      <a key={i} href={src} target="_blank" rel="noopener noreferrer">
                                        <img
                                          src={src}
                                          alt="adjunto"
                                          className="h-24 w-24 object-cover rounded-md border border-border/50"
                                        />
                                      </a>
                                    ))}
                                  </div>
                                )}
                                {message.text && (
                                  message.senderId === 'ai_assistant' ? (
                                    <FormattedMessage text={message.text} />
                                  ) : (
                                    <span className="whitespace-pre-wrap break-words">{message.text}</span>
                                  )
                                )}
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
              </div>

              {/* Miniaturas de imágenes adjuntas (solo chat de María) */}
              {activeRoomId.startsWith('ai_') && attachedImages.length > 0 && (
                <div className="px-3 pt-2 flex gap-2 flex-wrap border-t">
                  {attachedImages.map((src, i) => (
                    <div key={i} className="relative">
                      <img src={src} alt="adjunto" className="h-14 w-14 object-cover rounded-md border border-border" />
                      <button
                        type="button"
                        onClick={() => setAttachedImages((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted"
                        title="Quitar"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input */}
              <form onSubmit={handleSendMessage} style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }} className={`p-3 flex gap-2 flex-shrink-0 bg-background ${activeRoomId.startsWith('ai_') && attachedImages.length > 0 ? '' : 'border-t'}`}>
                {activeRoomId.startsWith('ai_') && (
                  <>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => { if (e.target.files) addImageFiles(e.target.files); e.target.value = ''; }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isLoading || attachedImages.length >= 5}
                      title="Adjuntar imagen (o pega con Ctrl+V)"
                    >
                      <ImagePlus className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Input
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onPaste={activeRoomId.startsWith('ai_') ? handlePaste : undefined}
                  placeholder={activeRoomId.startsWith('ai_') ? 'Escribe o pega una imagen…' : 'Escribe un mensaje...'}
                  className="flex-1"
                  disabled={isLoading}
                  autoFocus
                />
                <Button type="submit" size="icon" disabled={(!newMessage.trim() && attachedImages.length === 0) || isLoading}>
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
