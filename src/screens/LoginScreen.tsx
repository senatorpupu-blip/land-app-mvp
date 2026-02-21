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
import { RecaptchaVerifier, ApplicationVerifier } from 'firebase/auth';
import { theme } from '../config/theme';
import { Input, Button } from '../components';
import { 
  initRecaptchaVerifier, 
  sendPhoneVerificationCode, 
  verifyPhoneCode,
  clearPhoneAuthState 
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
  
  // reCAPTCHA verifier reference
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // Initialize reCAPTCHA on web platform
  useEffect(() => {
    if (Platform.OS === 'web') {
      // reCAPTCHA will be initialized when needed
    }
    
    return () => {
      // Cleanup reCAPTCHA verifier
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

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
      // Initialize reCAPTCHA verifier if on web
      if (Platform.OS === 'web' && !recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = initRecaptchaVerifier('recaptcha-container');
      }
      
      // Send verification code via Firebase Phone Auth
      const verifier = recaptchaVerifierRef.current;
      if (!verifier && Platform.OS === 'web') {
        throw new Error('Помилка ініціалізації reCAPTCHA');
      }
      
      await sendPhoneVerificationCode(phoneNumber, verifier as ApplicationVerifier);
      setPhoneStep('otp');
      setSuccessMessage('Код підтвердження надіслано на ваш телефон');
    } catch (err: any) {
      setError(err.message || 'Не вдалося надіслати код. Спробуйте ще раз.');
      // Reset reCAPTCHA on error
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Введіть 6-значний код');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Verify the code using Firebase Phone Auth
      // This will automatically sign in the user and trigger onAuthStateChanged
      await verifyPhoneCode(verificationCode);
      // Auth state change will be handled by AuthContext
    } catch (err: any) {
      setError(err.message || 'Невірний код. Спробуйте ще раз.');
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
    // Allow + at the beginning, then only digits
    // This supports E.164 format like +380XXXXXXXXX
    let cleaned = text;
    
    // If text starts with +, preserve it and clean the rest
    if (text.startsWith('+')) {
      cleaned = '+' + text.slice(1).replace(/\D/g, '');
    } else {
      cleaned = text.replace(/\D/g, '');
    }
    
    setPhoneNumber(cleaned);
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
            keyboardType="default"
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
