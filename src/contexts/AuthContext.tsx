import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import { 
  sendOTP, 
  verifyOTP, 
  signUpWithEmail, 
  signInWithEmail, 
  resetPassword,
  signOut as authSignOut,
  getUserById,
  subscribeToAuthChanges,
  isAdmin as checkIsAdmin,
  isSeller as checkIsSeller,
} from '../services/auth';

const USER_STORAGE_KEY = '@land_plots_user';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSeller: boolean;
  requestOTP: (phoneNumber: string) => Promise<boolean>;
  confirmOTP: (phoneNumber: string, otp: string) => Promise<User | null>;
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
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userJson = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (userJson) {
        const storedUser = JSON.parse(userJson);
        const freshUser = await getUserById(storedUser.id);
        if (freshUser && !freshUser.isBlocked) {
          setUser(freshUser);
          await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(freshUser));
        } else {
          await AsyncStorage.removeItem(USER_STORAGE_KEY);
          setUser(null);
        }
      }
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = useCallback(async () => {
    if (user?.id) {
      const freshUser = await getUserById(user.id);
      if (freshUser && !freshUser.isBlocked) {
        setUser(freshUser);
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(freshUser));
      }
    }
  }, [user?.id]);

  const requestOTP = useCallback(async (phoneNumber: string): Promise<boolean> => {
    return await sendOTP(phoneNumber);
  }, []);

  const confirmOTP = useCallback(async (phoneNumber: string, otp: string): Promise<User | null> => {
    const loggedInUser = await verifyOTP(phoneNumber, otp);
    
    if (loggedInUser) {
      if (loggedInUser.isBlocked) {
        throw new Error('Ваш акаунт заблоковано');
      }
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(loggedInUser));
      setUser(loggedInUser);
    }
    
    return loggedInUser;
  }, []);

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
    requestOTP,
    confirmOTP,
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
