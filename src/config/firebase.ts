import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Firebase configuration
// Values can be overridden via EXPO_PUBLIC_FIREBASE_* environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAPPH-wHzdgaSwoN5D0XIFvFcO6ueaPEyE',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'land-plots-app.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'land-plots-app',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'land-plots-app.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '697898943941',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:697898943941:web:5148e4909d5fd8e0f3b7ac',
};

// Runtime guard: ensure Firebase config is valid
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('YOUR_')) {
  throw new Error(
    'Firebase API key is missing or invalid. ' +
    'Please set EXPO_PUBLIC_FIREBASE_API_KEY in your .env file or check firebase.ts config.'
  );
}

if (!firebaseConfig.projectId || firebaseConfig.projectId.startsWith('YOUR_')) {
  throw new Error(
    'Firebase project ID is missing or invalid. ' +
    'Please set EXPO_PUBLIC_FIREBASE_PROJECT_ID in your .env file or check firebase.ts config.'
  );
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export default app;
