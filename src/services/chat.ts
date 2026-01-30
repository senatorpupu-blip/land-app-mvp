import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Chat, Message } from '../types';

const CHATS_COLLECTION = 'chats';
const MESSAGES_COLLECTION = 'messages';

export const createChat = async (
  plotId: string,
  ownerId: string,
  clientId: string
): Promise<string> => {
  try {
    // Check if chat already exists
    const existingChat = await findChat(plotId, ownerId, clientId);
    if (existingChat) {
      return existingChat.id;
    }
    
    const docRef = await addDoc(collection(db, CHATS_COLLECTION), {
      plotId,
      ownerId,
      clientId,
      createdAt: serverTimestamp(),
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating chat:', error);
    throw error;
  }
};

export const findChat = async (
  plotId: string,
  ownerId: string,
  clientId: string
): Promise<Chat | null> => {
  try {
    const q = query(
      collection(db, CHATS_COLLECTION),
      where('plotId', '==', plotId),
      where('ownerId', '==', ownerId),
      where('clientId', '==', clientId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    const data = doc.data();
    
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      lastMessageAt: data.lastMessageAt?.toDate(),
    } as Chat;
  } catch (error) {
    console.error('Error finding chat:', error);
    throw error;
  }
};

export const getChat = async (chatId: string): Promise<Chat | null> => {
  try {
    const chatDoc = await getDoc(doc(db, CHATS_COLLECTION, chatId));
    
    if (!chatDoc.exists()) {
      return null;
    }
    
    const data = chatDoc.data();
    return {
      id: chatDoc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      lastMessageAt: data.lastMessageAt?.toDate(),
    } as Chat;
  } catch (error) {
    console.error('Error getting chat:', error);
    throw error;
  }
};

export const getUserChats = async (userId: string): Promise<Chat[]> => {
  try {
    // Get chats where user is owner or client
    const ownerQuery = query(
      collection(db, CHATS_COLLECTION),
      where('ownerId', '==', userId)
    );
    
    const clientQuery = query(
      collection(db, CHATS_COLLECTION),
      where('clientId', '==', userId)
    );
    
    const [ownerSnapshot, clientSnapshot] = await Promise.all([
      getDocs(ownerQuery),
      getDocs(clientQuery)
    ]);
    
    const chats: Chat[] = [];
    const seenIds = new Set<string>();
    
    [...ownerSnapshot.docs, ...clientSnapshot.docs].forEach(doc => {
      if (!seenIds.has(doc.id)) {
        seenIds.add(doc.id);
        const data = doc.data();
        chats.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastMessageAt: data.lastMessageAt?.toDate(),
        } as Chat);
      }
    });
    
    // Sort by last message
    return chats.sort((a, b) => {
      const aTime = a.lastMessageAt?.getTime() || a.createdAt.getTime();
      const bTime = b.lastMessageAt?.getTime() || b.createdAt.getTime();
      return bTime - aTime;
    });
  } catch (error) {
    console.error('Error getting user chats:', error);
    throw error;
  }
};

export const sendMessage = async (
  chatId: string,
  senderId: string,
  text: string
): Promise<string> => {
  try {
    // Add message
    const messageRef = await addDoc(
      collection(db, CHATS_COLLECTION, chatId, MESSAGES_COLLECTION),
      {
        chatId,
        senderId,
        text,
        read: false,
        createdAt: serverTimestamp(),
      }
    );
    
    // Update chat with last message
    await updateDoc(doc(db, CHATS_COLLECTION, chatId), {
      lastMessage: text,
      lastMessageAt: serverTimestamp(),
    });
    
    return messageRef.id;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

export const getMessages = async (chatId: string): Promise<Message[]> => {
  try {
    const q = query(
      collection(db, CHATS_COLLECTION, chatId, MESSAGES_COLLECTION),
      orderBy('createdAt', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Message;
    });
  } catch (error) {
    console.error('Error getting messages:', error);
    throw error;
  }
};

export const subscribeToMessages = (
  chatId: string,
  callback: (messages: Message[]) => void
): (() => void) => {
  const q = query(
    collection(db, CHATS_COLLECTION, chatId, MESSAGES_COLLECTION),
    orderBy('createdAt', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const messages: Message[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Message;
    });
    
    callback(messages);
  });
};

export const markMessagesAsRead = async (
  chatId: string,
  userId: string
): Promise<void> => {
  try {
    const q = query(
      collection(db, CHATS_COLLECTION, chatId, MESSAGES_COLLECTION),
      where('read', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    
    const updates = querySnapshot.docs
      .filter(doc => doc.data().senderId !== userId)
      .map(doc => updateDoc(doc.ref, { read: true }));
    
    await Promise.all(updates);
  } catch (error) {
    console.error('Error marking messages as read:', error);
    throw error;
  }
};
