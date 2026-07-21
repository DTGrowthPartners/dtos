export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  images?: string[] | null; // imágenes adjuntas (data URLs) — chat con María
  // PDFs adjuntos — chat con María. Solo se guarda el nombre: un PDF en base64
  // revienta el límite de 1MB por documento de Firestore. El contenido va al
  // backend en el request y no se persiste.
  docs?: { name: string }[] | null;
  createdAt: number;
  readBy: string[];
}

export interface ChatRoom {
  id: string;
  name: string;
  type: 'general' | 'direct' | 'ai';
  participants: string[];
  participantNames?: Record<string, string>;
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
