import { 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User, UserRole } from '../types';

// Phone authentication has been removed for development
// APNs is not configured and reCAPTCHA blocks development
// Phone auth can be re-enabled when Apple Developer account is set up

const USERS_COLLECTION = 'users';

export const signUpWithEmail = async (email: string, password: string): Promise<User | null> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    const user = await getOrCreateUser(firebaseUser.uid, { email });
    return user;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('Ця електронна пошта вже використовується');
    }
    if (error.code === 'auth/weak-password') {
      throw new Error('Пароль повинен містити щонайменше 6 символів');
    }
    if (error.code === 'auth/invalid-email') {
      throw new Error('Невірний формат електронної пошти');
    }
    throw error;
  }
};

export const signInWithEmail = async (email: string, password: string): Promise<User | null> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    const user = await getOrCreateUser(firebaseUser.uid, { email });
    return user;
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      throw new Error('Користувача з такою поштою не знайдено');
    }
    if (error.code === 'auth/wrong-password') {
      throw new Error('Невірний пароль');
    }
    if (error.code === 'auth/invalid-email') {
      throw new Error('Невірний формат електронної пошти');
    }
    if (error.code === 'auth/invalid-credential') {
      throw new Error('Невірні облікові дані');
    }
    throw error;
  }
};

export const resetPassword = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      throw new Error('Користувача з такою поштою не знайдено');
    }
    throw error;
  }
};

export const getOrCreateUser = async (
  userId: string, 
  data: { phoneNumber?: string; email?: string }
): Promise<User> => {
  const userRef = doc(db, USERS_COLLECTION, userId);
  const userDoc = await getDoc(userRef);
  
  if (!userDoc.exists()) {
    // Build user object, excluding undefined values to prevent Firestore error
    // Firestore does not accept undefined values - use null or omit the field
    const newUser: Record<string, unknown> = {
      id: userId,
      role: 'seller' as UserRole,
      isBlocked: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    // Only add phoneNumber if defined
    if (data.phoneNumber) {
      newUser.phoneNumber = data.phoneNumber;
    }
    
    // Only add email if defined
    if (data.email) {
      newUser.email = data.email;
    }
    
    await setDoc(userRef, newUser);
    
    return {
      id: userId,
      phoneNumber: data.phoneNumber,
      email: data.email,
      role: 'seller',
      isBlocked: false,
      createdAt: new Date(),
    };
  }
  
  const userData = userDoc.data();
  return {
    id: userDoc.id,
    phoneNumber: userData.phoneNumber,
    email: userData.email,
    displayName: userData.displayName,
    role: userData.role || 'seller',
    isBlocked: userData.isBlocked || false,
    createdAt: userData.createdAt?.toDate() || new Date(),
    updatedAt: userData.updatedAt?.toDate(),
  };
};

export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return null;
    }
    
    const userData = userDoc.data();
    return {
      id: userDoc.id,
      phoneNumber: userData.phoneNumber,
      email: userData.email,
      displayName: userData.displayName,
      role: userData.role || 'seller',
      isBlocked: userData.isBlocked || false,
      createdAt: userData.createdAt?.toDate() || new Date(),
      updatedAt: userData.updatedAt?.toDate(),
    };
  } catch (error) {
    throw error;
  }
};

export const updateUserProfile = async (
  userId: string, 
  updates: Partial<Pick<User, 'displayName' | 'phoneNumber' | 'email'>>
): Promise<void> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw error;
  }
};

export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    throw error;
  }
};

export const getCurrentUser = (): FirebaseUser | null => {
  return auth.currentUser;
};

export const subscribeToAuthChanges = (
  callback: (user: FirebaseUser | null) => void
): (() => void) => {
  return onAuthStateChanged(auth, callback);
};

export const isAdmin = (user: User | null): boolean => {
  return user?.role === 'admin';
};

export const isSeller = (user: User | null): boolean => {
  return user?.role === 'seller' || user?.role === 'admin';
};

export const isBuyer = (user: User | null): boolean => {
  return user?.role === 'buyer' || user?.role === 'seller' || user?.role === 'admin';
};
