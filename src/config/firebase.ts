import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Helper to get env var with fallback (handles empty strings)
const getEnvOrDefault = (envKey: string, defaultValue: string): string => {
  const envValue = process.env[envKey];
  // Return default if env is undefined, null, or empty string
  if (!envValue || envValue.trim() === '') {
    return defaultValue;
  }
  return envValue;
};

// Firebase configuration - hardcoded values with env override support
// These are the correct values for land-plots-app Firebase project
const firebaseConfig = {
  apiKey: getEnvOrDefault('EXPO_PUBLIC_FIREBASE_API_KEY', 'AIzaSyAPPH-wHzdgaSwoN5D0XIFvFcO6ueaPEyE'),
  authDomain: getEnvOrDefault('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', 'land-plots-app.firebaseapp.com'),
  projectId: getEnvOrDefault('EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'land-plots-app'),
  storageBucket: getEnvOrDefault('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', 'land-plots-app.firebasestorage.app'),
  messagingSenderId: getEnvOrDefault('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', '697898943941'),
  appId: getEnvOrDefault('EXPO_PUBLIC_FIREBASE_APP_ID', '1:697898943941:web:5148e4909d5fd8e0f3b7ac'),
};

// Runtime logging - log Firebase config on startup (without exposing full API key)
console.log('[Firebase] Initializing with config:', {
  apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'MISSING',
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId ? `${firebaseConfig.appId.substring(0, 20)}...` : 'MISSING',
});

// Runtime guard: ensure Firebase config is valid
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('YOUR_')) {
  const errorMsg = 'Firebase API key is missing or invalid. Check firebase.ts config.';
  console.error('[Firebase] ERROR:', errorMsg);
  throw new Error(errorMsg);
}

if (!firebaseConfig.projectId || firebaseConfig.projectId.startsWith('YOUR_')) {
  const errorMsg = 'Firebase project ID is missing or invalid. Check firebase.ts config.';
  console.error('[Firebase] ERROR:', errorMsg);
  throw new Error(errorMsg);
}

// Initialize Firebase - SINGLE initialization point for entire app
const app = initializeApp(firebaseConfig);
console.log('[Firebase] App initialized successfully');

// Initialize services - all services use the same app instance
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Export the app instance and config for components that need it (e.g., FirebaseRecaptchaVerifierModal)
export const getFirebaseConfig = () => firebaseConfig;
export default app;
