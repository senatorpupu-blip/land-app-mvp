import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { theme } from '../config/theme';
import { Input, Button } from '../components';

interface LoginScreenProps {
  onLogin: (phoneNumber: string, otp: string) => Promise<void>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Simulate OTP sending
      await new Promise(resolve => setTimeout(resolve, 1000));
      setStep('otp');
    } catch (err) {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onLogin(phoneNumber, otp);
    } catch (err) {
      setError('Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (text: string) => {
    // Remove non-digits
    const cleaned = text.replace(/\D/g, '');
    setPhoneNumber(cleaned);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Land Plots</Text>
          <Text style={styles.subtitle}>
            {step === 'phone' 
              ? 'Enter your phone number to continue' 
              : 'Enter the OTP sent to your phone'}
          </Text>
        </View>

        <View style={styles.form}>
          {step === 'phone' ? (
            <>
              <Input
                label="Phone Number"
                placeholder="+1 234 567 8900"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={formatPhoneNumber}
                error={error}
                autoFocus
              />
              <Button
                title="Send OTP"
                onPress={handleSendOTP}
                loading={loading}
                disabled={!phoneNumber}
              />
            </>
          ) : (
            <>
              <Input
                label="OTP Code"
                placeholder="Enter 6-digit code"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
                error={error}
                autoFocus
              />
              <Button
                title="Verify OTP"
                onPress={handleVerifyOTP}
                loading={loading}
                disabled={otp.length !== 6}
              />
              <Button
                title="Change Phone Number"
                variant="outline"
                onPress={() => {
                  setStep('phone');
                  setOtp('');
                  setError('');
                }}
                style={styles.secondaryButton}
              />
            </>
          )}
        </View>

        <Text style={styles.demoNote}>
          Demo: Enter any phone number and use OTP "123456"
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
  },
  form: {
    gap: theme.spacing.md,
  },
  secondaryButton: {
    marginTop: theme.spacing.sm,
  },
  demoNote: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
});
