import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { User, AuthState } from '../types';
import { 
  signOut as authSignOut,
  getUserById,
} from '../services/auth';
import { auth } from '../config/firebase';

const USER_STORAGE_KEY = '@land_plots_user';

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    // Subscribe to Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          // Get user data from Firestore
          const user = await getUserById(firebaseUser.uid);
          if (user) {
            await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
            setState({
              user,
              isLoading: false,
              isAuthenticated: true,
            });
          } else {
            // User exists in Firebase Auth but not in Firestore
            setState({
              user: null,
              isLoading: false,
              isAuthenticated: false,
            });
          }
        } catch (error) {
          setState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
          });
        }
      } else {
        // User is signed out
        await AsyncStorage.removeItem(USER_STORAGE_KEY);
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authSignOut();
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    } catch (error) {
      throw error;
    }
  }, []);

  return {
    ...state,
    signOut,
  };
};
