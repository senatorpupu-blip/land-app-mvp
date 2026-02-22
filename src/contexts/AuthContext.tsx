import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

// DEV MODE: Check if we're in development mode
const IS_DEV_MODE = __DEV__;

// Mock user for development - skips all Firebase Auth
const DEV_MOCK_USER: User = {
  id: 'dev-user',
  email: 'dev@local.test',
  phoneNumber: '+380000000000',
  displayName: 'Dev User',
  role: 'seller',
  isBlocked: false,
  createdAt: new Date(),
};

// Only import Firebase Auth in production mode
let auth: any = null;
let onAuthStateChanged: any = null;
let signUpWithEmail: any = null;
let signInWithEmail: any = null;
let resetPassword: any = null;
let authSignOut: any = null;
let getUserById: any = null;

if (!IS_DEV_MODE) {
  // Production: Import Firebase Auth
  const firebaseAuth = require('firebase/auth');
  const firebaseConfig = require('../config/firebase');
  const authService = require('../services/auth');
  
  auth = firebaseConfig.auth;
  onAuthStateChanged = firebaseAuth.onAuthStateChanged;
  signUpWithEmail = authService.signUpWithEmail;
  signInWithEmail = authService.signInWithEmail;
  resetPassword = authService.resetPassword;
  authSignOut = authService.signOut;
  getUserById = authService.getUserById;
}

const USER_STORAGE_KEY = '@land_plots_user';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSeller: boolean;
  signUpEmail: (email: string, password: string) => Promise<User | null>;
  signInEmail: (email: string, password: string) => Promise<User | null>;
  resetPasswordEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Helper functions for role checks
const checkIsAdmin = (user: User | null): boolean => user?.role === 'admin';
const checkIsSeller = (user: User | null): boolean => user?.role === 'seller' || user?.role === 'admin';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // DEV MODE: Automatically log in with mock user, skip Firebase Auth entirely
    if (IS_DEV_MODE) {
      console.log('[AuthContext] DEV MODE: Using mock user, skipping Firebase Auth');
      setUser(DEV_MOCK_USER);
      setIsLoading(false);
      return;
    }

    // PRODUCTION: Subscribe to Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: any) => {
      if (firebaseUser) {
        try {
          // Get user data from Firestore
          const freshUser = await getUserById(firebaseUser.uid);
          if (freshUser && !freshUser.isBlocked) {
            setUser(freshUser);
            await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(freshUser));
          } else {
            await AsyncStorage.removeItem(USER_STORAGE_KEY);
            setUser(null);
          }
        } catch (error) {
          setUser(null);
        }
      } else {
        // User is signed out
        await AsyncStorage.removeItem(USER_STORAGE_KEY);
        setUser(null);
      }
      setIsLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const refreshUser = useCallback(async () => {
    // DEV MODE: No-op
    if (IS_DEV_MODE) {
      console.log('[AuthContext] DEV MODE: refreshUser no-op');
      return;
    }

    if (user?.id) {
      const freshUser = await getUserById(user.id);
      if (freshUser && !freshUser.isBlocked) {
        setUser(freshUser);
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(freshUser));
      }
    }
  }, [user?.id]);

  const signUpEmailFn = useCallback(async (email: string, password: string): Promise<User | null> => {
    // DEV MODE: Return mock user
    if (IS_DEV_MODE) {
      console.log('[AuthContext] DEV MODE: signUpEmail returning mock user');
      setUser(DEV_MOCK_USER);
      return DEV_MOCK_USER;
    }

    const loggedInUser = await signUpWithEmail(email, password);
    
    if (loggedInUser) {
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(loggedInUser));
      setUser(loggedInUser);
    }
    
    return loggedInUser;
  }, []);

  const signInEmailFn = useCallback(async (email: string, password: string): Promise<User | null> => {
    // DEV MODE: Return mock user
    if (IS_DEV_MODE) {
      console.log('[AuthContext] DEV MODE: signInEmail returning mock user');
      setUser(DEV_MOCK_USER);
      return DEV_MOCK_USER;
    }

    const loggedInUser = await signInWithEmail(email, password);
    
    if (loggedInUser) {
      if (loggedInUser.isBlocked) {
        throw new Error('Ваш акаунт заблоковано');
      }
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(loggedInUser));
      setUser(loggedInUser);
    }
    
    return loggedInUser;
  }, []);

  const resetPasswordEmailFn = useCallback(async (email: string): Promise<void> => {
    // DEV MODE: No-op
    if (IS_DEV_MODE) {
      console.log('[AuthContext] DEV MODE: resetPasswordEmail no-op');
      return;
    }

    await resetPassword(email);
  }, []);

  const signOutFn = useCallback(async () => {
    // DEV MODE: Just clear user state
    if (IS_DEV_MODE) {
      console.log('[AuthContext] DEV MODE: signOut clearing mock user');
      setUser(null);
      return;
    }

    await authSignOut();
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: checkIsAdmin(user),
    isSeller: checkIsSeller(user),
    signUpEmail: signUpEmailFn,
    signInEmail: signInEmailFn,
    resetPasswordEmail: resetPasswordEmailFn,
    signOut: signOutFn,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
