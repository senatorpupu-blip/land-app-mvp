/**
 * Security Hardening
 * 
 * This module provides input validation, rate limiting,
 * and computed field protection for production readiness.
 */

import { envLog } from '../config/environment';

// Rate limiting configuration
export const RATE_LIMIT_CONFIG = {
  // Requests per window
  DEFAULT_REQUESTS_PER_MINUTE: 60,
  AUTH_REQUESTS_PER_MINUTE: 10,
  WRITE_REQUESTS_PER_MINUTE: 30,
  SEARCH_REQUESTS_PER_MINUTE: 100,
  // Window duration in milliseconds
  WINDOW_DURATION_MS: 60000,
} as const;

// Rate limiter state
interface RateLimitState {
  requests: number;
  windowStart: number;
}

const rateLimitStates: Map<string, RateLimitState> = new Map();

// Check rate limit
export const checkRateLimit = (
  key: string,
  maxRequests: number = RATE_LIMIT_CONFIG.DEFAULT_REQUESTS_PER_MINUTE
): { allowed: boolean; remaining: number; resetIn: number } => {
  const now = Date.now();
  const state = rateLimitStates.get(key);

  if (!state || now - state.windowStart >= RATE_LIMIT_CONFIG.WINDOW_DURATION_MS) {
    // New window
    rateLimitStates.set(key, { requests: 1, windowStart: now });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetIn: RATE_LIMIT_CONFIG.WINDOW_DURATION_MS,
    };
  }

  if (state.requests >= maxRequests) {
    const resetIn = RATE_LIMIT_CONFIG.WINDOW_DURATION_MS - (now - state.windowStart);
    envLog.warn('Rate limit exceeded', { key, requests: state.requests, maxRequests });
    return {
      allowed: false,
      remaining: 0,
      resetIn,
    };
  }

  state.requests += 1;
  return {
    allowed: true,
    remaining: maxRequests - state.requests,
    resetIn: RATE_LIMIT_CONFIG.WINDOW_DURATION_MS - (now - state.windowStart),
  };
};

// Reset rate limit (for testing)
export const resetRateLimit = (key: string): void => {
  rateLimitStates.delete(key);
};

// Input validation patterns
export const VALIDATION_PATTERNS = {
  // Ukrainian phone: +380XXXXXXXXX
  UKRAINIAN_PHONE: /^\+380\d{9}$/,
  // Email
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  // Ukrainian cadastral number: XXXXXXXXXX:XX:XXX:XXXX
  CADASTRAL_NUMBER: /^\d{10}:\d{2}:\d{3}:\d{4}$/,
  // Slug (URL-safe)
  SLUG: /^[a-z0-9-]+$/,
  // No HTML tags
  NO_HTML: /<[^>]*>/g,
  // No script tags
  NO_SCRIPT: /<script[^>]*>[\s\S]*?<\/script>/gi,
  // No event handlers
  NO_EVENT_HANDLERS: /\s*on\w+\s*=/gi,
  // No javascript: URLs
  NO_JS_URL: /javascript:/gi,
} as const;

// Input length limits
export const INPUT_LIMITS = {
  TITLE_MAX: 200,
  DESCRIPTION_MAX: 5000,
  CONTENT_MAX: 50000,
  ADDRESS_MAX: 500,
  PHONE_MAX: 20,
  EMAIL_MAX: 254,
  CADASTRAL_MAX: 22,
  SLUG_MAX: 100,
  TAG_MAX: 50,
  TAGS_ARRAY_MAX: 20,
  PHOTOS_ARRAY_MAX: 20,
} as const;

// Sanitize text input (remove potential XSS)
export const sanitizeText = (input: string): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let sanitized = input;

  // Remove script tags
  sanitized = sanitized.replace(VALIDATION_PATTERNS.NO_SCRIPT, '');

  // Remove event handlers
  sanitized = sanitized.replace(VALIDATION_PATTERNS.NO_EVENT_HANDLERS, '');

  // Remove javascript: URLs
  sanitized = sanitized.replace(VALIDATION_PATTERNS.NO_JS_URL, '');

  // Escape HTML entities
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return sanitized.trim();
};

// Validate and sanitize input
export interface ValidationResult {
  isValid: boolean;
  sanitizedValue: string;
  errors: string[];
}

export const validateTextInput = (
  input: string,
  fieldName: string,
  maxLength: number,
  required: boolean = false
): ValidationResult => {
  const errors: string[] = [];

  if (!input || typeof input !== 'string') {
    if (required) {
      errors.push(`${fieldName} є обов'язковим`);
    }
    return { isValid: !required, sanitizedValue: '', errors };
  }

  const sanitized = sanitizeText(input);

  if (required && sanitized.length === 0) {
    errors.push(`${fieldName} є обов'язковим`);
  }

  if (sanitized.length > maxLength) {
    errors.push(`${fieldName} перевищує максимальну довжину (${maxLength} символів)`);
  }

  return {
    isValid: errors.length === 0,
    sanitizedValue: sanitized.substring(0, maxLength),
    errors,
  };
};

// Validate phone number
export const validatePhone = (phone: string): ValidationResult => {
  const errors: string[] = [];
  const sanitized = phone.replace(/\s/g, '').trim();

  if (!VALIDATION_PATTERNS.UKRAINIAN_PHONE.test(sanitized)) {
    errors.push('Невірний формат телефону. Використовуйте +380XXXXXXXXX');
  }

  return {
    isValid: errors.length === 0,
    sanitizedValue: sanitized,
    errors,
  };
};

// Validate email
export const validateEmail = (email: string): ValidationResult => {
  const errors: string[] = [];
  const sanitized = email.toLowerCase().trim();

  if (!VALIDATION_PATTERNS.EMAIL.test(sanitized)) {
    errors.push('Невірний формат електронної пошти');
  }

  if (sanitized.length > INPUT_LIMITS.EMAIL_MAX) {
    errors.push(`Email перевищує максимальну довжину (${INPUT_LIMITS.EMAIL_MAX} символів)`);
  }

  return {
    isValid: errors.length === 0,
    sanitizedValue: sanitized,
    errors,
  };
};

// Validate cadastral number
export const validateCadastralNumber = (cadastral: string): ValidationResult => {
  const errors: string[] = [];
  const sanitized = cadastral.trim();

  if (!VALIDATION_PATTERNS.CADASTRAL_NUMBER.test(sanitized)) {
    errors.push('Невірний формат кадастрового номера. Використовуйте XXXXXXXXXX:XX:XXX:XXXX');
  }

  return {
    isValid: errors.length === 0,
    sanitizedValue: sanitized,
    errors,
  };
};

// Validate numeric range
export const validateNumericRange = (
  value: number,
  fieldName: string,
  min: number,
  max: number
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (typeof value !== 'number' || isNaN(value)) {
    errors.push(`${fieldName} має бути числом`);
    return { isValid: false, errors };
  }

  if (value < min) {
    errors.push(`${fieldName} має бути не менше ${min}`);
  }

  if (value > max) {
    errors.push(`${fieldName} має бути не більше ${max}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Validate coordinates (Ukraine bounds)
export const UKRAINE_BOUNDS = {
  LAT_MIN: 44.3,
  LAT_MAX: 52.4,
  LON_MIN: 22.1,
  LON_MAX: 40.2,
} as const;

export const validateCoordinates = (
  latitude: number,
  longitude: number
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (latitude < UKRAINE_BOUNDS.LAT_MIN || latitude > UKRAINE_BOUNDS.LAT_MAX) {
    errors.push(`Широта має бути в межах України (${UKRAINE_BOUNDS.LAT_MIN}-${UKRAINE_BOUNDS.LAT_MAX})`);
  }

  if (longitude < UKRAINE_BOUNDS.LON_MIN || longitude > UKRAINE_BOUNDS.LON_MAX) {
    errors.push(`Довгота має бути в межах України (${UKRAINE_BOUNDS.LON_MIN}-${UKRAINE_BOUNDS.LON_MAX})`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Computed field protection - fields that should never be set by client
export const PROTECTED_FIELDS = [
  'id',
  'createdAt',
  'updatedAt',
  'approvedAt',
  'rejectedAt',
  'deletedAt',
  'ownerId',
  'intelligence',
  'pricing',
  'premium.premiumPurchasedAt',
  'viewCount',
  'favoriteCount',
] as const;

// Remove protected fields from input
export const removeProtectedFields = <T extends Record<string, unknown>>(
  data: T,
  additionalProtected: string[] = []
): Partial<T> => {
  const allProtected = [...PROTECTED_FIELDS, ...additionalProtected];
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (!allProtected.includes(key)) {
      result[key] = value;
    } else {
      envLog.warn('Attempted to set protected field', { field: key });
    }
  }

  return result as Partial<T>;
};

// Validate array length
export const validateArrayLength = (
  array: unknown[],
  fieldName: string,
  maxLength: number
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!Array.isArray(array)) {
    errors.push(`${fieldName} має бути масивом`);
    return { isValid: false, errors };
  }

  if (array.length > maxLength) {
    errors.push(`${fieldName} перевищує максимальну кількість елементів (${maxLength})`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Comprehensive plot validation
export interface PlotValidationResult {
  isValid: boolean;
  sanitizedData: Record<string, unknown>;
  errors: string[];
}

export const validatePlotInput = (
  data: Record<string, unknown>
): PlotValidationResult => {
  const errors: string[] = [];
  const sanitizedData: Record<string, unknown> = {};

  // Title
  if (data.title !== undefined) {
    const titleResult = validateTextInput(
      data.title as string,
      'Назва',
      INPUT_LIMITS.TITLE_MAX,
      true
    );
    if (!titleResult.isValid) errors.push(...titleResult.errors);
    sanitizedData.title = titleResult.sanitizedValue;
  }

  // Description
  if (data.description !== undefined) {
    const descResult = validateTextInput(
      data.description as string,
      'Опис',
      INPUT_LIMITS.DESCRIPTION_MAX,
      false
    );
    if (!descResult.isValid) errors.push(...descResult.errors);
    sanitizedData.description = descResult.sanitizedValue;
  }

  // Area
  if (data.area !== undefined) {
    const areaResult = validateNumericRange(data.area as number, 'Площа', 0.01, 100000);
    if (!areaResult.isValid) errors.push(...areaResult.errors);
    sanitizedData.area = data.area;
  }

  // Price per sotka
  if (data.pricePerSotka !== undefined) {
    const priceResult = validateNumericRange(
      data.pricePerSotka as number,
      'Ціна за сотку',
      1,
      1000000000
    );
    if (!priceResult.isValid) errors.push(...priceResult.errors);
    sanitizedData.pricePerSotka = data.pricePerSotka;
  }

  // Cadastral number
  if (data.cadastralNumber !== undefined && data.cadastralNumber !== '') {
    const cadastralResult = validateCadastralNumber(data.cadastralNumber as string);
    if (!cadastralResult.isValid) errors.push(...cadastralResult.errors);
    sanitizedData.cadastralNumber = cadastralResult.sanitizedValue;
  }

  // Location
  if (data.location !== undefined) {
    const location = data.location as { latitude?: number; longitude?: number; address?: string };
    if (location.latitude !== undefined && location.longitude !== undefined) {
      const coordResult = validateCoordinates(location.latitude, location.longitude);
      if (!coordResult.isValid) errors.push(...coordResult.errors);
    }
    sanitizedData.location = location;
  }

  // Photos
  if (data.photos !== undefined) {
    const photosResult = validateArrayLength(
      data.photos as unknown[],
      'Фотографії',
      INPUT_LIMITS.PHOTOS_ARRAY_MAX
    );
    if (!photosResult.isValid) errors.push(...photosResult.errors);
    sanitizedData.photos = data.photos;
  }

  // Remove protected fields
  const finalData = removeProtectedFields(sanitizedData);

  return {
    isValid: errors.length === 0,
    sanitizedData: finalData,
    errors,
  };
};
