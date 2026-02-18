import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { theme } from '../config/theme';
import { Input, Button } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { uk } from '../localization/uk';

interface ProfileCompletionScreenProps {
  navigation: any;
  onComplete?: () => void;
}

const USER_TYPES = [
  { value: 'buyer', label: 'Покупець' },
  { value: 'seller', label: 'Продавець' },
  { value: 'investor', label: 'Інвестор' },
  { value: 'agent', label: 'Агент' },
];

const AGE_RANGES = [
  { value: '18-25', label: '18-25' },
  { value: '26-35', label: '26-35' },
  { value: '36-45', label: '36-45' },
  { value: '46-55', label: '46-55' },
  { value: '56+', label: '56+' },
];

export const ProfileCompletionScreen: React.FC<ProfileCompletionScreenProps> = ({
  navigation,
  onComplete,
}) => {
  const { user } = useAuth();
  
  const [ageRange, setAgeRange] = useState<string>('');
  const [city, setCity] = useState('');
  const [userType, setUserType] = useState<string>('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!user?.uid) {
      Alert.alert('Помилка', 'Ви повинні увійти в систему');
      return;
    }

    setLoading(true);

    try {
      const updates: Record<string, unknown> = {
        profileCompleted: true,
        updatedAt: new Date(),
      };

      if (ageRange) updates.ageRange = ageRange;
      if (city.trim()) updates.city = city.trim();
      if (userType) updates.userType = userType;
      if (bio.trim()) updates.bio = bio.trim();

      await updateDoc(doc(db, 'users', user.uid), updates);

      Alert.alert('Успіх', 'Профіль оновлено', [
        {
          text: 'OK',
          onPress: () => {
            if (onComplete) {
              onComplete();
            } else {
              navigation.goBack();
            }
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося оновити профіль');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (onComplete) {
      onComplete();
    } else {
      navigation.goBack();
    }
  };

  const renderAgeRangePicker = () => (
    <View style={styles.pickerContainer}>
      <Text style={styles.label}>Вікова група</Text>
      <View style={styles.optionsRow}>
        {AGE_RANGES.map((range) => (
          <TouchableOpacity
            key={range.value}
            style={[
              styles.optionButton,
              ageRange === range.value && styles.optionButtonActive,
            ]}
            onPress={() => setAgeRange(range.value)}
          >
            <Text
              style={[
                styles.optionText,
                ageRange === range.value && styles.optionTextActive,
              ]}
            >
              {range.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderUserTypePicker = () => (
    <View style={styles.pickerContainer}>
      <Text style={styles.label}>Тип користувача</Text>
      <View style={styles.optionsRow}>
        {USER_TYPES.map((type) => (
          <TouchableOpacity
            key={type.value}
            style={[
              styles.optionButton,
              userType === type.value && styles.optionButtonActive,
            ]}
            onPress={() => setUserType(type.value)}
          >
            <Text
              style={[
                styles.optionText,
                userType === type.value && styles.optionTextActive,
              ]}
            >
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
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
          <Text style={styles.title}>Завершіть профіль</Text>
          <Text style={styles.subtitle}>
            Ця інформація допоможе нам покращити ваш досвід
          </Text>

          <View style={styles.form}>
            {renderUserTypePicker()}
            
            {renderAgeRangePicker()}

            <Input
              label="Місто"
              placeholder="Наприклад: Київ"
              value={city}
              onChangeText={setCity}
            />

            <Input
              label="Про себе"
              placeholder="Розкажіть трохи про себе..."
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
            />

            <View style={styles.actions}>
              <Button
                title="Зберегти"
                onPress={handleSave}
                loading={loading}
                disabled={loading}
              />
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
                disabled={loading}
              >
                <Text style={styles.skipButtonText}>Пропустити</Text>
              </TouchableOpacity>
            </View>
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
    padding: theme.spacing.lg,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    marginBottom: theme.spacing.lg,
  },
  form: {
    gap: theme.spacing.md,
  },
  pickerContainer: {
    marginBottom: theme.spacing.sm,
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
    marginBottom: theme.spacing.xs,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  optionButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  optionButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  optionText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  optionTextActive: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  actions: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  skipButtonText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
  },
});

export default ProfileCompletionScreen;
