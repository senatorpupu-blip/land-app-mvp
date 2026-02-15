import { 
  collection, 
  doc, 
  getDocs, 
  updateDoc, 
  query, 
  orderBy,
  where,
  limit as firestoreLimit,
  startAfter,
  serverTimestamp,
} from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { User, PaginatedResult, PaginationOptions } from '../types';

const USERS_COLLECTION = 'users';
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const docToUser = (doc: QueryDocumentSnapshot<DocumentData>): User => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    isBlocked: data.isBlocked || false,
    createdAt: data.createdAt?.toDate() || new Date(),
  } as User;
};

export const getUsersPaginated = async (
  options?: PaginationOptions & { isBlocked?: boolean }
): Promise<PaginatedResult<User>> => {
  try {
    const pageSize = Math.min(options?.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    
    let constraints: any[] = [
      orderBy('createdAt', 'desc'),
      firestoreLimit(pageSize + 1),
    ];
    
    // Add isBlocked filter if specified
    if (options?.isBlocked !== undefined) {
      constraints = [
        where('isBlocked', '==', options.isBlocked),
        orderBy('createdAt', 'desc'),
        firestoreLimit(pageSize + 1),
      ];
    }
    
    // Add cursor for pagination
    if (options?.cursor) {
      constraints.push(startAfter(options.cursor));
    }
    
    const q = query(collection(db, USERS_COLLECTION), ...constraints);
    const querySnapshot = await getDocs(q);
    
    let users = querySnapshot.docs.map(docToUser);
    
    const hasMore = users.length > pageSize;
    if (hasMore) {
      users = users.slice(0, pageSize);
    }
    
    const lastDoc = users.length > 0 ? querySnapshot.docs[users.length - 1] : null;
    
    return {
      data: users,
      lastDoc,
      hasMore,
    };
  } catch (error) {
    console.error('Error getting paginated users:', error);
    throw error;
  }
};

// Legacy function for backward compatibility
export const getAllUsers = async (): Promise<User[]> => {
  try {
    const result = await getUsersPaginated({ limit: MAX_PAGE_SIZE });
    return result.data;
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
