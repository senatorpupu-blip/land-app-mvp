import { 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
  RecaptchaVerifier,
  ConfirmationResult,
  ApplicationVerifier,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../config/firebase';
import { User, UserRole } from '../types';

const USERS_COLLECTION = 'users';

// Store confirmation result for phone auth verification
let phoneAuthConfirmationResult: ConfirmationResult | null = null;

/**
 * Initialize reCAPTCHA verifier for phone authentication
 * This is required by Firebase Phone Auth
 */
export const initRecaptchaVerifier = (containerId: string): RecaptchaVerifier => {
  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved - will proceed with phone auth
    },
    'expired-callback': () => {
      // Reset reCAPTCHA if expired
    },
  });
  return verifier;
};

/**
 * Send verification code to phone number using Firebase Phone Auth
 * Returns true if SMS was sent successfully
 */
export const sendPhoneVerificationCode = async (
  phoneNumber: string,
  recaptchaVerifier: ApplicationVerifier
): Promise<boolean> => {
  try {
    // Format phone number to E.164 format if needed
    const formattedPhone = formatPhoneToE164(phoneNumber);
    
    // Send verification code via Firebase
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier);
    
    // Store confirmation result for later verification
    phoneAuthConfirmationResult = confirmationResult;
    
    return true;
  } catch (error: any) {
    // Handle specific Firebase Phone Auth errors
    if (error.code === 'auth/invalid-phone-number') {
      throw new Error('Невірний формат номера телефону');
    }
    if (error.code === 'auth/too-many-requests') {
      throw new Error('Забагато спроб. Спробуйте пізніше');
    }
    if (error.code === 'auth/quota-exceeded') {
      throw new Error('Перевищено ліміт SMS. Спробуйте пізніше');
    }
    if (error.code === 'auth/captcha-check-failed') {
      throw new Error('Помилка перевірки reCAPTCHA. Спробуйте ще раз');
    }
    throw error;
  }
};

/**
 * Verify the SMS code entered by user
 * Returns the authenticated user on success
 */
export const verifyPhoneCode = async (verificationCode: string): Promise<User | null> => {
  try {
    if (!phoneAuthConfirmationResult) {
      throw new Error('Спочатку потрібно надіслати код підтвердження');
    }
    
    if (verificationCode.length !== 6) {
      throw new Error('Код повинен містити 6 цифр');
    }
    
    // Verify the code with Firebase
    const userCredential = await phoneAuthConfirmationResult.confirm(verificationCode);
    const firebaseUser = userCredential.user;
    
    // Clear the confirmation result
    phoneAuthConfirmationResult = null;
    
    // Create or update user in Firestore
    const user = await getOrCreateUser(firebaseUser.uid, { 
      phoneNumber: firebaseUser.phoneNumber || undefined 
    });
    
    // Log the login event
    await logLoginEvent();
    
    return user;
  } catch (error: any) {
    // Handle specific Firebase verification errors
    if (error.code === 'auth/invalid-verification-code') {
      throw new Error('Невірний код підтвердження');
    }
    if (error.code === 'auth/code-expired') {
      throw new Error('Код підтвердження закінчився. Надішліть новий код');
    }
    if (error.code === 'auth/session-expired') {
      throw new Error('Сесія закінчилась. Надішліть новий код');
    }
    throw error;
  }
};

/**
 * Format phone number to E.164 format (+380XXXXXXXXX)
 */
const formatPhoneToE164 = (phoneNumber: string): string => {
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');
  
  // If starts with 0, assume Ukrainian number and add +38
  if (digits.startsWith('0')) {
    return '+38' + digits;
  }
  
  // If starts with 38, add +
  if (digits.startsWith('38')) {
    return '+' + digits;
  }
  
  // If already has country code, just add +
  if (digits.length >= 10) {
    return '+' + digits;
  }
  
  // Default: assume Ukrainian number
  return '+380' + digits;
};

/**
 * Log login event to Cloud Function
 */
const logLoginEvent = async (): Promise<void> => {
  try {
    const logLogin = httpsCallable(functions, 'logLoginEvent');
    await logLogin({});
  } catch (error) {
    // Don't throw - login logging failure shouldn't block auth
  }
};

/**
 * Clear phone auth state (useful for resending code)
 */
export const clearPhoneAuthState = (): void => {
  phoneAuthConfirmationResult = null;
};

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
    const newUser = {
      id: userId,
      phoneNumber: data.phoneNumber,
      email: data.email,
      role: 'seller' as UserRole,
      isBlocked: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
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
