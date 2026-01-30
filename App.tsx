import React, { useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation';
import { useAuth } from './src/hooks/useAuth';
import { theme } from './src/config/theme';

export default function App() {
  const { 
    user, 
    isLoading, 
    isAuthenticated, 
    confirmOTP, 
    signOut 
  } = useAuth();

  const handleLogin = useCallback(async (phoneNumber: string, otp: string) => {
    // For MVP demo, accept any 6-digit OTP
    if (otp === '123456' || otp.length === 6) {
      await confirmOTP(phoneNumber, otp);
    } else {
      throw new Error('Invalid OTP');
    }
  }, [confirmOTP]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="light" />
      <AppNavigator
        isAuthenticated={isAuthenticated}
        user={user}
        onLogin={handleLogin}
        onSignOut={signOut}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
