import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { User } from '../types';
import { 
  signUpWithEmail, 
  signInWithEmail, 
  resetPassword,
  signOut as authSignOut,
  getUserById,
  isAdmin as checkIsAdmin,
  isSeller as checkIsSeller,
} from '../services/auth';
import { auth } from '../config/firebase';

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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Subscribe to Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
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
    if (user?.id) {
      const freshUser = await getUserById(user.id);
      if (freshUser && !freshUser.isBlocked) {
        setUser(freshUser);
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(freshUser));
      }
    }
  }, [user?.id]);

  const signUpEmail = useCallback(async (email: string, password: string): Promise<User | null> => {
    const loggedInUser = await signUpWithEmail(email, password);
    
    if (loggedInUser) {
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(loggedInUser));
      setUser(loggedInUser);
    }
    
    return loggedInUser;
  }, []);

  const signInEmail = useCallback(async (email: string, password: string): Promise<User | null> => {
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

  const resetPasswordEmail = useCallback(async (email: string): Promise<void> => {
    await resetPassword(email);
  }, []);

  const signOut = useCallback(async () => {
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
    signUpEmail,
    signInEmail,
    resetPasswordEmail,
    signOut,
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
