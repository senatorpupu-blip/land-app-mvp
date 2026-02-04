import { 
  collection, 
  doc, 
  getDocs, 
  updateDoc, 
  query, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { User } from '../types';

const USERS_COLLECTION = 'users';

export const getAllUsers = async (): Promise<User[]> => {
  try {
    const q = query(collection(db, USERS_COLLECTION), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        isBlocked: data.isBlocked || false,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as User;
    });
  } catch (error) {
    console.error('Error getting users:', error);
    throw error;
  }
};

export const blockUser = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      isBlocked: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error blocking user:', error);
    throw error;
  }
};

export const unblockUser = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      isBlocked: false,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error unblocking user:', error);
    throw error;
  }
};
