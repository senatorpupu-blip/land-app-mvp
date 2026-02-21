import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { theme } from '../config/theme';
import { Input, Button } from '../components';
import app, { auth } from '../config/firebase';
import { 
  verifyPhoneCode,
  clearPhoneAuthState,
  getOrCreateUser
} from '../services/auth';

type AuthMode = 'phone' | 'email-signin' | 'email-signup';
type PhoneStep = 'phone' | 'otp';

interface LoginScreenProps {
  onEmailSignIn: (email: string, password: string) => Promise<void>;
  onEmailSignUp: (email: string, password: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ 
  onEmailSignIn, 
  onEmailSignUp,
  onResetPassword,
}) => {
  const [authMode, setAuthMode] = useState<AuthMode>('phone');
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('phone');
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // reCAPTCHA verifier reference for native phone auth
  const recaptchaVerifierRef = useRef<FirebaseRecaptchaVerifierModal | null>(null);
  
  // Verification ID for phone auth
  const [verificationId, setVerificationId] = useState<string | null>(null);

  const resetForm = () => {
    setPhoneNumber('');
    setVerificationCode('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccessMessage('');
    setPhoneStep('phone');
    clearPhoneAuthState();
  };

  const handleSendVerificationCode = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      setError('Введіть коректний номер телефону');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Format phone number to E.164 format
      const formattedPhone = formatPhoneToE164(phoneNumber);
      
      // Debug logging as requested
      console.log('Phone auth - phoneNumber:', formattedPhone, 'type:', typeof formattedPhone);
      
      if (!recaptchaVerifierRef.current) {
        throw new Error('Помилка ініціалізації reCAPTCHA');
      }
      
      // Use PhoneAuthProvider for native Expo builds
      const phoneProvider = new PhoneAuthProvider(auth);
      const verId = await phoneProvider.verifyPhoneNumber(
        formattedPhone,
        recaptchaVerifierRef.current
      );
      
      setVerificationId(verId);
      setPhoneStep('otp');
      setSuccessMessage('Код підтвердження надіслано на ваш телефон');
    } catch (err: any) {
      console.error('Phone auth error:', err.code, err.message);
      
      // Handle specific Firebase Phone Auth errors
      if (err.code === 'auth/invalid-phone-number') {
        setError('Невірний формат номера телефону');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Забагато спроб. Спробуйте пізніше');
      } else if (err.code === 'auth/quota-exceeded') {
        setError('Перевищено ліміт SMS. Спробуйте пізніше');
      } else if (err.code === 'auth/argument-error') {
        setError('Помилка аргументів. Перевірте номер телефону та reCAPTCHA');
      } else {
        setError(err.message || 'Не вдалося надіслати код. Спробуйте ще раз.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Format phone number to E.164 format (+380XXXXXXXXX)
  const formatPhoneToE164 = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    
    if (digits.startsWith('0')) {
      return '+38' + digits;
    }
    if (digits.startsWith('38')) {
      return '+' + digits;
    }
    if (digits.length >= 10 && !digits.startsWith('+')) {
      return '+' + digits;
    }
    return phone.startsWith('+') ? phone : '+380' + digits;
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Введіть 6-значний код');
      return;
    }
    
    if (!verificationId) {
      setError('Спочатку отримайте код підтвердження');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create credential with verification ID and code
      const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
      
      // Sign in with the credential
      const userCredential = await signInWithCredential(auth, credential);
      
      // Create or update user document in Firestore
      await getOrCreateUser(userCredential.user.uid, { 
        phoneNumber: userCredential.user.phoneNumber || undefined 
      });
      
      // Auth state change will be handled by AuthContext
    } catch (err: any) {
      console.error('Verify code error:', err.code, err.message);
      
      if (err.code === 'auth/invalid-verification-code') {
        setError('Невірний код підтвердження');
      } else if (err.code === 'auth/code-expired') {
        setError('Код підтвердження закінчився. Отримайте новий код');
      } else {
        setError(err.message || 'Невірний код. Спробуйте ще раз.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      setError('Заповніть всі поля');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onEmailSignIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Помилка входу');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      setError('Заповніть всі поля');
      return;
    }

    if (password !== confirmPassword) {
      setError('Паролі не співпадають');
      return;
    }

    if (password.length < 6) {
      setError('Пароль повинен містити щонайменше 6 символів');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onEmailSignUp(email, password);
    } catch (err: any) {
      setError(err.message || 'Помилка реєстрації');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Введіть електронну пошту');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      await onResetPassword(email);
      setSuccessMessage('Лист для скидання пароля надіслано на вашу пошту');
    } catch (err: any) {
      setError(err.message || 'Помилка скидання пароля');
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (text: string) => {
    // Clean input to digits only
    const digits = text.replace(/\D/g, '');
    
    // Auto-add +380 prefix for Ukrainian numbers
    // If user enters digits starting with 0 (local format), convert to +380
    // If user enters 380..., add + prefix
    // Otherwise just store the digits and format for display
    let formatted = digits;
    
    if (digits.startsWith('0') && digits.length > 1) {
      // Local format: 0XX XXX XXXX -> +380 XX XXX XXXX
      formatted = '+38' + digits;
    } else if (digits.startsWith('380')) {
      // Already has country code without +
      formatted = '+' + digits;
    } else if (digits.length > 0 && !digits.startsWith('380')) {
      // Assume Ukrainian number, add +380 prefix
      formatted = '+380' + digits;
    }
    
    setPhoneNumber(formatted);
  };

  const switchMode = (mode: AuthMode) => {
    resetForm();
    setAuthMode(mode);
  };

  const renderPhoneAuth = () => (
    <>
      {phoneStep === 'phone' ? (
        <>
          <Input
            label="Номер телефону"
            placeholder="+380 XX XXX XXXX"
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={formatPhoneNumber}
            error={error}
            autoFocus
          />
          {successMessage ? (
            <Text style={styles.successMessage}>{successMessage}</Text>
          ) : null}
          <Button
            title="Надіслати код"
            onPress={handleSendVerificationCode}
            loading={loading}
            disabled={!phoneNumber}
          />
          {Platform.OS === 'web' && (
            <View nativeID="recaptcha-container" />
          )}
        </>
      ) : (
        <>
          <Input
            label="Код підтвердження"
            placeholder="Введіть 6-значний код з SMS"
            keyboardType="number-pad"
            maxLength={6}
            value={verificationCode}
            onChangeText={setVerificationCode}
            error={error}
            autoFocus
          />
          {successMessage ? (
            <Text style={styles.successMessage}>{successMessage}</Text>
          ) : null}
          <Button
            title="Підтвердити"
            onPress={handleVerifyCode}
            loading={loading}
            disabled={verificationCode.length !== 6}
          />
          <Button
            title="Змінити номер"
            variant="outline"
            onPress={() => {
              setPhoneStep('phone');
              setVerificationCode('');
              setError('');
              setSuccessMessage('');
              clearPhoneAuthState();
            }}
            style={styles.secondaryButton}
          />
        </>
      )}
    </>
  );

  const renderEmailSignIn = () => (
    <>
      <Input
        label="Електронна пошта"
        placeholder="email@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <Input
        label="Пароль"
        placeholder="Введіть пароль"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        error={error}
      />
      {successMessage ? (
        <Text style={styles.successMessage}>{successMessage}</Text>
      ) : null}
      <Button
        title="Увійти"
        onPress={handleEmailSignIn}
        loading={loading}
        disabled={!email || !password}
      />
      <TouchableOpacity onPress={handleResetPassword} style={styles.forgotPassword}>
        <Text style={styles.forgotPasswordText}>Забули пароль?</Text>
      </TouchableOpacity>
    </>
  );

  const renderEmailSignUp = () => (
    <>
      <Input
        label="Електронна пошта"
        placeholder="email@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <Input
        label="Пароль"
        placeholder="Мінімум 6 символів"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Input
        label="Підтвердіть пароль"
        placeholder="Повторіть пароль"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        error={error}
      />
      <Button
        title="Зареєструватися"
        onPress={handleEmailSignUp}
        loading={loading}
        disabled={!email || !password || !confirmPassword}
      />
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Firebase reCAPTCHA Verifier Modal for phone auth */}
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifierRef}
        firebaseConfig={app.options}
        attemptInvisibleVerification={true}
      />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Земельні ділянки</Text>
            <Text style={styles.subtitle}>
              {authMode === 'phone' && phoneStep === 'phone' && 'Введіть номер телефону для входу'}
              {authMode === 'phone' && phoneStep === 'otp' && 'Введіть код з SMS'}
              {authMode === 'email-signin' && 'Увійдіть за допомогою пошти'}
              {authMode === 'email-signup' && 'Створіть новий акаунт'}
            </Text>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity 
              style={[styles.tab, authMode === 'phone' && styles.tabActive]}
              onPress={() => switchMode('phone')}
            >
              <Text style={[styles.tabText, authMode === 'phone' && styles.tabTextActive]}>
                Телефон
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, (authMode === 'email-signin' || authMode === 'email-signup') && styles.tabActive]}
              onPress={() => switchMode('email-signin')}
            >
              <Text style={[styles.tabText, (authMode === 'email-signin' || authMode === 'email-signup') && styles.tabTextActive]}>
                Пошта
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            {authMode === 'phone' && renderPhoneAuth()}
            {authMode === 'email-signin' && renderEmailSignIn()}
            {authMode === 'email-signup' && renderEmailSignUp()}
          </View>

          {(authMode === 'email-signin' || authMode === 'email-signup') && (
            <View style={styles.switchAuth}>
              {authMode === 'email-signin' ? (
                <TouchableOpacity onPress={() => switchMode('email-signup')}>
                  <Text style={styles.switchAuthText}>
                    Немає акаунту? <Text style={styles.switchAuthLink}>Зареєструватися</Text>
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => switchMode('email-signin')}>
                  <Text style={styles.switchAuthText}>
                    Вже є акаунт? <Text style={styles.switchAuthLink}>Увійти</Text>
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
  tabs: {
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  tabActive: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    fontWeight: '500',
  },
  tabTextActive: {
    color: theme.colors.text,
  },
  form: {
    gap: theme.spacing.md,
  },
  secondaryButton: {
    marginTop: theme.spacing.sm,
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  forgotPasswordText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
  },
  successMessage: {
    color: theme.colors.success,
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  switchAuth: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  switchAuthText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  switchAuthLink: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
