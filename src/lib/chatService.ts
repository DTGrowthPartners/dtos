import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDoc,
  setDoc,
  arrayUnion,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';
import type { ChatMessage, ChatRoom, UserPresence } from '@/types/chatTypes';

const MESSAGES_COLLECTION = 'chat_messages';
const ROOMS_COLLECTION = 'chat_rooms';
const PRESENCE_COLLECTION = 'user_presence';
const GENERAL_ROOM_ID = 'general';

// Generate a deterministic room ID for direct messages
export const getDirectRoomId = (userId1: string, userId2: string): string => {
  const sorted = [userId1, userId2].sort();
  return `dm_${sorted[0]}_${sorted[1]}`;
};

// Initialize the general chat room if it doesn't exist
export const initializeGeneralRoom = async () => {
  const roomRef = doc(db, ROOMS_COLLECTION, GENERAL_ROOM_ID);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    await setDoc(roomRef, {
      id: GENERAL_ROOM_ID,
      name: 'Chat General',
      type: 'general',
      participants: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
};

// Get or create AI chat room for a user
export const getOrCreateAIRoom = async (userId: string, userName: string): Promise<string> => {
  const roomId = `ai_room_${userId}`;
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    await setDoc(roomRef, {
      id: roomId,
      name: 'Chat con IA',
      type: 'ai',
      participants: [userId, 'ai_assistant'],
      participantNames: {
        [userId]: userName,
        'ai_assistant': 'Kimi AI',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  return roomId;
};

// Send a message to a room
export const sendMessage = async (
  roomId: string,
  text: string,
  senderId: string,
  senderName: string,
  senderPhoto?: string
): Promise<string> => {
  const messageData = {
    text,
    senderId,
    senderName,
    senderPhoto: senderPhoto || null,
    createdAt: Date.now(),
    readBy: [senderId],
    roomId,
  };

  const docRef = await addDoc(collection(db, MESSAGES_COLLECTION), messageData);

  // Update room's last message
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  await updateDoc(roomRef, {
    lastMessage: {
      text: text.length > 50 ? text.substring(0, 50) + '...' : text,
      senderName,
      createdAt: Date.now(),
    },
    updatedAt: Date.now(),
  });

  return docRef.id;
};

// Subscribe to messages in a room
export const subscribeToMessages = (
  roomId: string,
  callback: (messages: ChatMessage[]) => void,
  messageLimit: number = 100
) => {
  const q = query(
    collection(db, MESSAGES_COLLECTION),
    where('roomId', '==', roomId),
    orderBy('createdAt', 'desc'),
    limit(messageLimit)
  );

  return onSnapshot(q, (snapshot) => {
    const messages: ChatMessage[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ChatMessage[];

    // Reverse to show oldest first
    callback(messages.reverse());
  });
};

// Mark messages as read
export const markMessagesAsRead = async (messageIds: string[], userId: string) => {
  for (const id of messageIds) {
    const messageRef = doc(db, MESSAGES_COLLECTION, id);
    await updateDoc(messageRef, {
      readBy: arrayUnion(userId),
    });
  }
};

// Update user presence
export const updatePresence = async (
  userId: string,
  status: 'online' | 'offline' | 'away'
) => {
  const presenceRef = doc(db, PRESENCE_COLLECTION, userId);
  await setDoc(presenceRef, {
    userId,
    status,
    lastSeen: Date.now(),
  }, { merge: true });
};

// Subscribe to all users' presence
export const subscribeToPresence = (
  callback: (presence: Record<string, UserPresence>) => void
) => {
  return onSnapshot(collection(db, PRESENCE_COLLECTION), (snapshot) => {
    const presence: Record<string, UserPresence> = {};
    snapshot.docs.forEach((doc) => {
      const data = doc.data() as UserPresence;
      presence[doc.id] = data;
    });
    callback(presence);
  });
};

// Get unread messages count for a user in a room
export const subscribeToUnreadCount = (
  roomId: string,
  userId: string,
  callback: (count: number) => void
) => {
  const q = query(
    collection(db, MESSAGES_COLLECTION),
    where('roomId', '==', roomId)
  );

  return onSnapshot(q, (snapshot) => {
    let count = 0;
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (!data.readBy?.includes(userId) && data.senderId !== userId) {
        count++;
      }
    });
    callback(count);
  });
};

// Delete a message (only sender can delete)
export const deleteMessage = async (messageId: string) => {
  await deleteDoc(doc(db, MESSAGES_COLLECTION, messageId));
};

// Create or get a direct message room
export const getOrCreateDirectRoom = async (
  currentUserId: string,
  currentUserName: string,
  otherUserId: string,
  otherUserName: string
): Promise<string> => {
  const roomId = getDirectRoomId(currentUserId, otherUserId);
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    await setDoc(roomRef, {
      id: roomId,
      name: `${currentUserName} & ${otherUserName}`,
      type: 'direct',
      participants: [currentUserId, otherUserId],
      participantNames: {
        [currentUserId]: currentUserName,
        [otherUserId]: otherUserName,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  return roomId;
};

// Subscribe to user's direct message rooms
export const subscribeToUserRooms = (
  userId: string,
  callback: (rooms: ChatRoom[]) => void
) => {
  const q = query(
    collection(db, ROOMS_COLLECTION),
    where('participants', 'array-contains', userId),
    where('type', '==', 'direct')
  );

  return onSnapshot(q, (snapshot) => {
    const rooms: ChatRoom[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ChatRoom[];

    // Sort by last message time
    rooms.sort((a, b) => (b.lastMessage?.createdAt || b.updatedAt) - (a.lastMessage?.createdAt || a.updatedAt));
    callback(rooms);
  });
};

// Get unread count for a specific room
export const getUnreadCountForRoom = async (
  roomId: string,
  userId: string
): Promise<number> => {
  const q = query(
    collection(db, MESSAGES_COLLECTION),
    where('roomId', '==', roomId)
  );

  const snapshot = await getDocs(q);
  let count = 0;
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (!data.readBy?.includes(userId) && data.senderId !== userId) {
      count++;
    }
  });
  return count;
};

// Setup presence on page visibility change
export const setupPresenceListeners = (userId: string) => {
  // Set online on load
  updatePresence(userId, 'online');

  // Handle visibility change
  const handleVisibility = () => {
    if (document.hidden) {
      updatePresence(userId, 'away');
    } else {
      updatePresence(userId, 'online');
    }
  };

  // Handle before unload
  const handleUnload = () => {
    updatePresence(userId, 'offline');
  };

  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('beforeunload', handleUnload);

  // Return cleanup function
  return () => {
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('beforeunload', handleUnload);
    updatePresence(userId, 'offline');
  };
};
