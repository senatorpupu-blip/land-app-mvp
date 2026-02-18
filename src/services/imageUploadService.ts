import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGES_PER_LISTING = 10;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface ImageUploadResult {
  url: string;
  path: string;
}

export interface ImagePickerResult {
  uri: string;
  width: number;
  height: number;
  type?: string;
  fileSize?: number;
}

export const requestCameraPermission = async (): Promise<boolean> => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
};

export const requestMediaLibraryPermission = async (): Promise<boolean> => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
};

export const pickImageFromGallery = async (
  allowMultiple = false
): Promise<ImagePickerResult[]> => {
  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) {
    throw new Error('Потрібен дозвіл на доступ до галереї');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: !allowMultiple,
    allowsMultipleSelection: allowMultiple,
    selectionLimit: MAX_IMAGES_PER_LISTING,
    quality: 0.7, // Compression: 70% quality
    exif: false,
  });

  if (result.canceled || !result.assets) {
    return [];
  }

  return result.assets.map(asset => ({
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    type: asset.mimeType,
    fileSize: asset.fileSize,
  }));
};

export const takePhoto = async (): Promise<ImagePickerResult | null> => {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) {
    throw new Error('Потрібен дозвіл на доступ до камери');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.7, // Compression: 70% quality
    exif: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    type: asset.mimeType,
    fileSize: asset.fileSize,
  };
};

export const validateImage = (image: ImagePickerResult): void => {
  if (image.fileSize && image.fileSize > MAX_IMAGE_SIZE) {
    throw new Error('Розмір зображення перевищує 5MB');
  }

  if (image.type && !ALLOWED_TYPES.includes(image.type)) {
    throw new Error('Дозволені формати: JPG, PNG, WebP');
  }
};

export const uploadListingImage = async (
  uri: string,
  listingId: string,
  index: number
): Promise<ImageUploadResult> => {
  const response = await fetch(uri);
  const blob = await response.blob();

  if (blob.size > MAX_IMAGE_SIZE) {
    throw new Error('Розмір зображення перевищує 5MB');
  }

  const extension = blob.type.split('/')[1] || 'jpg';
  const timestamp = Date.now();
  const path = `listings/${listingId}/photo_${index}_${timestamp}.${extension}`;

  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob);

  const url = await getDownloadURL(storageRef);

  return { url, path };
};

export const uploadMultipleListingImages = async (
  images: ImagePickerResult[],
  listingId: string,
  onProgress?: (uploaded: number, total: number) => void
): Promise<ImageUploadResult[]> => {
  const results: ImageUploadResult[] = [];
  const total = images.length;

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    validateImage(image);
    
    const result = await uploadListingImage(image.uri, listingId, i);
    results.push(result);
    
    if (onProgress) {
      onProgress(i + 1, total);
    }
  }

  return results;
};

export const uploadUserAvatar = async (
  uri: string,
  userId: string
): Promise<ImageUploadResult> => {
  const response = await fetch(uri);
  const blob = await response.blob();

  if (blob.size > MAX_IMAGE_SIZE) {
    throw new Error('Розмір зображення перевищує 5MB');
  }

  const path = `users/${userId}/avatar.jpg`;

  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob);

  const url = await getDownloadURL(storageRef);

  return { url, path };
};

export const getImageDimensions = (
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } => {
  const aspectRatio = width / height;

  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspectRatio;
  }

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  return { width: Math.round(width), height: Math.round(height) };
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
