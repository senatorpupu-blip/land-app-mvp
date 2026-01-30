import { 
  signInWithPhoneNumber, 
  PhoneAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  ConfirmationResult
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User } from '../types';

let confirmationResult: ConfirmationResult | null = null;

export const sendOTP = async (phoneNumber: string): Promise<boolean> => {
  try {
    // Note: In production, you need to set up reCAPTCHA verifier
    // For Expo, you might need to use expo-auth-session or a custom solution
    // This is a simplified version for MVP
    
    // Store phone number for verification step
    // In real implementation, this would trigger SMS via Firebase
    console.log('Sending OTP to:', phoneNumber);
    
    // For MVP demo purposes, we'll simulate OTP sending
    // In production, use Firebase Phone Auth with proper setup
    return true;
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw error;
  }
};

export const verifyOTP = async (phoneNumber: string, otp: string): Promise<User | null> => {
  try {
    // For MVP, we'll create/get user directly
    // In production, verify OTP with Firebase Phone Auth
    
    // Simulate verification
    if (otp.length !== 6) {
      throw new Error('Invalid OTP format');
    }
    
    // Create or get user in Firestore
    const userId = phoneNumber.replace(/\D/g, '');
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      // Create new user
      const newUser: User = {
        id: userId,
        phoneNumber: phoneNumber,
        createdAt: new Date(),
      };
      
      await setDoc(userRef, {
        ...newUser,
        createdAt: serverTimestamp(),
      });
      
      return newUser;
    }
    
    const userData = userDoc.data();
    return {
      id: userDoc.id,
      phoneNumber: userData.phoneNumber,
      displayName: userData.displayName,
      createdAt: userData.createdAt?.toDate() || new Date(),
    };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw error;
  }
};

export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
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
