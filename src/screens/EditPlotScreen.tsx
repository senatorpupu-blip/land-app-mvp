import React, { useState, useEffect, useCallback } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { theme } from '../config/theme';
import { Input, Button } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { LandPlot, LandCategory } from '../types';
import { getPlot, updatePlot } from '../services/plots';
import { validateCadastralFormat } from '../utils/cadastral';
import { formatPriceUAH, sotkasToHectares } from '../utils/currency';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

interface EditPlotScreenProps {
  navigation: any;
  route: any;
}

const CATEGORIES: { value: LandCategory; label: string }[] = [
  { value: 'agricultural', label: 'Сільськогосподарська' },
  { value: 'residential', label: 'Житлова забудова' },
  { value: 'commercial', label: 'Комерційна' },
  { value: 'industrial', label: 'Промислова' },
  { value: 'recreational', label: 'Рекреаційна' },
];

export const EditPlotScreen: React.FC<EditPlotScreenProps> = ({ navigation, route }) => {
  const { plotId } = route.params;
  const { user } = useAuth();
  
  const [plot, setPlot] = useState<LandPlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [areaSotkas, setAreaSotkas] = useState('');
  const [pricePerSotka, setPricePerSotka] = useState('');
  const [category, setCategory] = useState<LandCategory>('agricultural');
  const [cadastralNumber, setCadastralNumber] = useState('');
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const areaInHectares = areaSotkas ? sotkasToHectares(parseFloat(areaSotkas)) : 0;
  const totalPrice = areaSotkas && pricePerSotka 
    ? parseFloat(areaSotkas) * parseFloat(pricePerSotka) 
    : 0;

  useEffect(() => {
    const loadPlot = async () => {
      try {
        const fetchedPlot = await getPlot(plotId);
        if (!fetchedPlot) {
          setError('Оголошення не знайдено');
          return;
        }
        
        if (fetchedPlot.ownerId !== user?.id) {
          setError('Ви не маєте доступу до цього оголошення');
          return;
        }
        
        setPlot(fetchedPlot);
        setTitle(fetchedPlot.title);
        setDescription(fetchedPlot.description || '');
        setAreaSotkas(fetchedPlot.area.toString());
        setPricePerSotka(fetchedPlot.pricePerSotka.toString());
        setCategory(fetchedPlot.category || 'agricultural');
        setCadastralNumber(fetchedPlot.cadastralNumber || '');
      } catch (err: any) {
        setError(err.message || 'Не вдалося завантажити оголошення');
      } finally {
        setLoading(false);
      }
    };

    loadPlot();
  }, [plotId, user?.id]);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Введіть назву ділянки';
    }

    if (!areaSotkas || parseFloat(areaSotkas) <= 0) {
      newErrors.area = 'Введіть площу ділянки';
    }

    if (!pricePerSotka || parseFloat(pricePerSotka) <= 0) {
      newErrors.price = 'Введіть ціну за сотку';
    }

    if (cadastralNumber && !validateCadastralFormat(cadastralNumber)) {
      newErrors.cadastral = 'Невірний формат кадастрового номера';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, areaSotkas, pricePerSotka, cadastralNumber]);

  const handleSave = async () => {
    if (!validate() || !plot) {
      return;
    }

    setSaving(true);

    try {
      const updates: Partial<LandPlot> = {
        title: title.trim(),
        description: description.trim(),
        area: parseFloat(areaSotkas),
        pricePerSotka: parseFloat(pricePerSotka),
        category,
        cadastralNumber: cadastralNumber.trim(),
      };

      await updatePlot(plotId, updates);

      // Call Cloud Function to recompute pricing
      try {
        const recomputePricing = httpsCallable(functions, 'recomputePricingForPlot');
        await recomputePricing({ plotId });
      } catch (recomputeError) {
        // Non-critical error - pricing will be recalculated on next load
      }

      Alert.alert(
        'Успіх',
        'Оголошення оновлено! Зміни будуть перевірені модератором.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Помилка', err.message || 'Не вдалося оновити оголошення');
    } finally {
      setSaving(false);
    }
  };

  const renderCategoryPicker = () => (
    <View style={styles.pickerContainer}>
      <Text style={styles.label}>Категорія землі</Text>
      <View style={styles.optionsRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            style={[
              styles.optionButton,
              category === cat.value && styles.optionButtonActive,
            ]}
            onPress={() => setCategory(cat.value)}
          >
            <Text
              style={[
                styles.optionText,
                category === cat.value && styles.optionTextActive,
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Завантаження...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Помилка</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Повернутися</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
          <Text style={styles.title}>Редагувати оголошення</Text>

          <View style={styles.form}>
            <Input
              label="Назва ділянки *"
              placeholder="Наприклад: Ділянка біля озера"
              value={title}
              onChangeText={setTitle}
              error={errors.title}
            />

            <Input
              label="Опис"
              placeholder="Детальний опис ділянки..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />

            {renderCategoryPicker()}

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Input
                  label="Площа (соток) *"
                  placeholder="100"
                  keyboardType="numeric"
                  value={areaSotkas}
                  onChangeText={setAreaSotkas}
                  error={errors.area}
                />
                {areaInHectares > 0 && (
                  <Text style={styles.convertedValue}>
                    = {areaInHectares.toFixed(2)} га
                  </Text>
                )}
              </View>
              <View style={styles.halfInput}>
                <Input
                  label="Ціна за сотку (₴) *"
                  placeholder="5000"
                  keyboardType="numeric"
                  value={pricePerSotka}
                  onChangeText={setPricePerSotka}
                  error={errors.price}
                />
              </View>
            </View>

            {totalPrice > 0 && (
              <View style={styles.totalPriceContainer}>
                <Text style={styles.totalPriceLabel}>Загальна вартість:</Text>
                <Text style={styles.totalPriceValue}>
                  {formatPriceUAH(totalPrice)}
                </Text>
              </View>
            )}

            <Input
              label="Кадастровий номер"
              placeholder="XXXXXXXXXX:XX:XXX:XXXX"
              value={cadastralNumber}
              onChangeText={setCadastralNumber}
              error={errors.cadastral}
              autoCapitalize="characters"
            />

            <View style={styles.submitContainer}>
              <Button
                title="Зберегти зміни"
                onPress={handleSave}
                loading={saving}
                disabled={saving}
              />
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => navigation.goBack()}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Скасувати</Text>
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
    marginBottom: theme.spacing.lg,
  },
  form: {
    gap: theme.spacing.md,
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
    marginBottom: theme.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  convertedValue: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    marginTop: -theme.spacing.sm,
  },
  totalPriceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  totalPriceLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
  },
  totalPriceValue: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  pickerContainer: {
    marginBottom: theme.spacing.sm,
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
  submitContainer: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  cancelButton: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    marginTop: theme.spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.md,
  },
  errorTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  backButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  backButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
});
