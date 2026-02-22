import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Firebase Web SDK configuration
// These are the correct values for land-plots-app Firebase project
const firebaseConfig = {
  apiKey: "AIzaSyAPPH-whZdqaSwoN5D0XIFVfcQ6ueaPEyE",
  authDomain: "land-plots-app.firebaseapp.com",
  projectId: "land-plots-app",
  storageBucket: "land-plots-app.firebasestorage.app",
  messagingSenderId: "697898943941",
  appId: "1:697898943941:web:5148e4909d5fd8e0f3b7ac"
};

// Initialize Firebase - SINGLE initialization point for entire app
const app = initializeApp(firebaseConfig);

// Initialize services - all services use the same app instance
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Export the app instance and config for components that need it (e.g., FirebaseRecaptchaVerifierModal)
export const getFirebaseConfig = () => firebaseConfig;
export default app;
