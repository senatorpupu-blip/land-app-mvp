import React, { useState, useCallback } from 'react';
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
  Image,
  ActivityIndicator,
} from 'react-native';
import { theme } from '../config/theme';
import { Input, Button } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { LandCategory } from '../types';
import { createPlot, CreatePlotRequest } from '../services/plots';
import { validateCadastralFormat } from '../utils/cadastral';
import { formatPriceUAH, formatArea, sotkasToHectares } from '../utils/currency';
import {
  pickImageFromGallery,
  takePhoto,
  uploadMultipleListingImages,
  ImagePickerResult,
  formatFileSize,
} from '../services/imageUploadService';
import { uk } from '../localization/uk';

interface AddPlotScreenProps {
  navigation: any;
}

const CATEGORIES: { value: LandCategory; label: string }[] = [
  { value: 'agricultural', label: 'Сільськогосподарська' },
  { value: 'residential', label: 'Житлова забудова' },
  { value: 'commercial', label: 'Комерційна' },
  { value: 'industrial', label: 'Промислова' },
  { value: 'recreational', label: 'Рекреаційна' },
];

const ZONES: { value: 'A' | 'B' | 'C'; label: string }[] = [
  { value: 'A', label: 'Зона A (преміум)' },
  { value: 'B', label: 'Зона B (стандарт)' },
  { value: 'C', label: 'Зона C (економ)' },
];

export const AddPlotScreen: React.FC<AddPlotScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [areaSotkas, setAreaSotkas] = useState('');
  const [pricePerSotka, setPricePerSotka] = useState('');
  const [category, setCategory] = useState<LandCategory>('agricultural');
  const [zone, setZone] = useState<'A' | 'B' | 'C'>('B');
  const [region, setRegion] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [cadastralNumber, setCadastralNumber] = useState('');
  const [photos, setPhotos] = useState<ImagePickerResult[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ uploaded: 0, total: 0 });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const areaInHectares = areaSotkas ? sotkasToHectares(parseFloat(areaSotkas)) : 0;
  const totalPrice = areaSotkas && pricePerSotka 
    ? parseFloat(areaSotkas) * parseFloat(pricePerSotka) 
    : 0;

  const handlePickPhotos = async () => {
    try {
      const selectedPhotos = await pickImageFromGallery(true);
      if (selectedPhotos.length > 0) {
        const newPhotos = [...photos, ...selectedPhotos].slice(0, 10);
        setPhotos(newPhotos);
      }
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося вибрати фото');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const photo = await takePhoto();
      if (photo && photos.length < 10) {
        setPhotos([...photos, photo]);
      }
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося зробити фото');
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

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

    if (!region.trim()) {
      newErrors.region = 'Введіть область/регіон';
    }

    if (!latitude || !longitude) {
      newErrors.coordinates = 'Введіть координати ділянки';
    } else {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        newErrors.coordinates = 'Невірна широта (від -90 до 90)';
      } else if (isNaN(lng) || lng < -180 || lng > 180) {
        newErrors.coordinates = 'Невірна довгота (від -180 до 180)';
      }
    }

    if (cadastralNumber && !validateCadastralFormat(cadastralNumber)) {
      newErrors.cadastral = 'Невірний формат кадастрового номера (XXXXXXXXXX:XX:XXX:XXXX)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, areaSotkas, pricePerSotka, region, latitude, longitude, cadastralNumber]);

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    if (!user) {
      Alert.alert('Помилка', 'Ви повинні увійти в систему');
      return;
    }

    setLoading(true);

    try {
      let photoUrls: string[] = [];
      
      if (photos.length > 0) {
        setUploadingPhotos(true);
        const tempListingId = `temp_${Date.now()}`;
        const uploadResults = await uploadMultipleListingImages(
          photos,
          tempListingId,
          (uploaded, total) => setUploadProgress({ uploaded, total })
        );
        photoUrls = uploadResults.map(r => r.url);
        setUploadingPhotos(false);
      }

      const plotData: CreatePlotRequest = {
        title: title.trim(),
        description: description.trim(),
        area: parseFloat(areaSotkas),
        pricePerSotka: parseFloat(pricePerSotka),
        zone,
        region: region.trim(),
        location: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          address: address.trim(),
        },
        cadastralNumber: cadastralNumber.trim(),
        photos: photoUrls,
        isInvestmentPlot: false,
        isCreditAvailable: false,
        category,
      };

      await createPlot(plotData);
      
      Alert.alert(
        'Успіх',
        'Ділянку створено! Вона з\'явиться на карті після модерації.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('MyListings'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося створити ділянку');
    } finally {
      setLoading(false);
      setUploadingPhotos(false);
    }
  };

  const renderPhotoPicker = () => (
    <View style={styles.photoSection}>
      <Text style={styles.label}>Фото ділянки (до 10)</Text>
      
      <View style={styles.photoGrid}>
        {photos.map((photo, index) => (
          <View key={index} style={styles.photoContainer}>
            <Image source={{ uri: photo.uri }} style={styles.photoThumbnail} />
            <TouchableOpacity
              style={styles.removePhotoButton}
              onPress={() => handleRemovePhoto(index)}
            >
              <Text style={styles.removePhotoText}>×</Text>
            </TouchableOpacity>
            {photo.fileSize && (
              <Text style={styles.photoSize}>{formatFileSize(photo.fileSize)}</Text>
            )}
          </View>
        ))}
        
        {photos.length < 10 && (
          <View style={styles.addPhotoButtons}>
            <TouchableOpacity
              style={styles.addPhotoButton}
              onPress={handlePickPhotos}
            >
              <Text style={styles.addPhotoIcon}>🖼️</Text>
              <Text style={styles.addPhotoText}>Галерея</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addPhotoButton}
              onPress={handleTakePhoto}
            >
              <Text style={styles.addPhotoIcon}>📷</Text>
              <Text style={styles.addPhotoText}>Камера</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      {uploadingPhotos && (
        <View style={styles.uploadProgress}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.uploadProgressText}>
            Завантаження {uploadProgress.uploaded}/{uploadProgress.total}...
          </Text>
        </View>
      )}
    </View>
  );

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

  const renderZonePicker = () => (
    <View style={styles.pickerContainer}>
      <Text style={styles.label}>Цінова зона</Text>
      <View style={styles.optionsRowHorizontal}>
        {ZONES.map((z) => (
          <TouchableOpacity
            key={z.value}
            style={[
              styles.zoneButton,
              zone === z.value && styles.zoneButtonActive,
            ]}
            onPress={() => setZone(z.value)}
          >
            <Text
              style={[
                styles.zoneText,
                zone === z.value && styles.zoneTextActive,
              ]}
            >
              {z.label}
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
          <Text style={styles.title}>Додати ділянку</Text>
          <Text style={styles.subtitle}>
            Заповніть інформацію про земельну ділянку
          </Text>

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

            {renderZonePicker()}

            <Input
              label="Область/Регіон *"
              placeholder="Київська область"
              value={region}
              onChangeText={setRegion}
              error={errors.region}
            />

            <Input
              label="Адреса"
              placeholder="с. Петрівка, вул. Центральна"
              value={address}
              onChangeText={setAddress}
            />

            <Text style={styles.sectionTitle}>Координати *</Text>
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Input
                  label="Широта"
                  placeholder="50.4501"
                  keyboardType="numeric"
                  value={latitude}
                  onChangeText={setLatitude}
                />
              </View>
              <View style={styles.halfInput}>
                <Input
                  label="Довгота"
                  placeholder="30.5234"
                  keyboardType="numeric"
                  value={longitude}
                  onChangeText={setLongitude}
                />
              </View>
            </View>
            {errors.coordinates && (
              <Text style={styles.errorText}>{errors.coordinates}</Text>
            )}

            <Input
              label="Кадастровий номер"
              placeholder="XXXXXXXXXX:XX:XXX:XXXX"
              value={cadastralNumber}
              onChangeText={setCadastralNumber}
              error={errors.cadastral}
              autoCapitalize="characters"
            />

            {renderPhotoPicker()}

            <View style={styles.submitContainer}>
              <Button
                title="Створити оголошення"
                onPress={handleSubmit}
                loading={loading}
                disabled={loading}
              />
              <Text style={styles.noteText}>
                * Обов'язкові поля. Оголошення буде опубліковано після модерації.
              </Text>
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
  label: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
    marginBottom: theme.spacing.xs,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    marginTop: theme.spacing.sm,
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
  optionsRowHorizontal: {
    flexDirection: 'row',
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
  zoneButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  zoneButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  zoneText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  zoneTextActive: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.fontSize.sm,
    marginTop: -theme.spacing.sm,
  },
  submitContainer: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  noteText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
  },
  photoSection: {
    marginTop: theme.spacing.md,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  photoContainer: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.sm,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  photoSize: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    fontSize: 8,
    textAlign: 'center',
    borderBottomLeftRadius: theme.borderRadius.sm,
    borderBottomRightRadius: theme.borderRadius.sm,
    paddingVertical: 2,
  },
  addPhotoButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  addPhotoText: {
    color: theme.colors.textMuted,
    fontSize: 10,
  },
  uploadProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  uploadProgressText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
});
