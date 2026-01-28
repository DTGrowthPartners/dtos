export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  createdAt: number;
  readBy: string[];
}

export interface ChatRoom {
  id: string;
  name: string;
  type: 'general' | 'direct';
  participants: string[];
  lastMessage?: {
    text: string;
    senderName: string;
    createdAt: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface UserPresence {
  userId: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: number;
}

export interface ChatUser {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  photoUrl?: string;
  presence?: UserPresence;
}
