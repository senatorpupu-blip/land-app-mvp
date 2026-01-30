import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, AuthState } from '../types';
import { sendOTP, verifyOTP, signOut as authSignOut } from '../services/auth';

const USER_STORAGE_KEY = '@land_plots_user';

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userJson = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (userJson) {
        const user = JSON.parse(userJson);
        setState({
          user,
          isLoading: false,
          isAuthenticated: true,
        });
      } else {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    } catch (error) {
      console.error('Error loading user:', error);
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  };

  const requestOTP = useCallback(async (phoneNumber: string): Promise<boolean> => {
    try {
      return await sendOTP(phoneNumber);
    } catch (error) {
      console.error('Error requesting OTP:', error);
      throw error;
    }
  }, []);

  const confirmOTP = useCallback(async (phoneNumber: string, otp: string): Promise<User | null> => {
    try {
      const user = await verifyOTP(phoneNumber, otp);
      
      if (user) {
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        setState({
          user,
          isLoading: false,
          isAuthenticated: true,
        });
      }
      
      return user;
    } catch (error) {
      console.error('Error confirming OTP:', error);
      throw error;
    }
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
      console.error('Error signing out:', error);
      throw error;
    }
  }, []);

  return {
    ...state,
    requestOTP,
    confirmOTP,
    signOut,
  };
};
