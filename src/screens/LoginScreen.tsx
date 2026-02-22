import React, { useState } from 'react';
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
import { theme } from '../config/theme';
import { Input, Button } from '../components';

// DEV MODE: In development, this screen is bypassed entirely
// The AuthContext automatically logs in with a mock user
// This screen is only shown in production builds

type AuthMode = 'email-signin' | 'email-signup';

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
  const [authMode, setAuthMode] = useState<AuthMode>('email-signin');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccessMessage('');
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
      console.error('[LoginScreen] Sign in error:', err.code, err.message);
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
      console.error('[LoginScreen] Sign up error:', err.code, err.message);
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
      console.error('[LoginScreen] Reset password error:', err.code, err.message);
      setError(err.message || 'Помилка скидання пароля');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (mode: AuthMode) => {
    resetForm();
    setAuthMode(mode);
  };

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
              {authMode === 'email-signin' && 'Увійдіть за допомогою пошти'}
              {authMode === 'email-signup' && 'Створіть новий акаунт'}
            </Text>
          </View>

          <View style={styles.form}>
            {authMode === 'email-signin' && renderEmailSignIn()}
            {authMode === 'email-signup' && renderEmailSignUp()}
          </View>

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
  form: {
    gap: theme.spacing.md,
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
