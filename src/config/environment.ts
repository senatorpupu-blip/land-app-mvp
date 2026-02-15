/**
 * Environment Configuration
 * 
 * This module provides environment-based configuration for separating
 * development and production environments.
 * 
 * Environment is determined by:
 * 1. EXPO_PUBLIC_ENV environment variable (dev/staging/prod)
 * 2. __DEV__ flag from React Native (fallback)
 */

export type Environment = 'development' | 'staging' | 'production';

// Determine current environment
const getEnvironment = (): Environment => {
  const envVar = process.env.EXPO_PUBLIC_ENV;
  
  if (envVar === 'prod' || envVar === 'production') {
    return 'production';
  }
  if (envVar === 'staging') {
    return 'staging';
  }
  if (envVar === 'dev' || envVar === 'development') {
    return 'development';
  }
  
  // Fallback to __DEV__ flag
  // @ts-ignore - __DEV__ is a React Native global
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return 'development';
  }
  
  return 'production';
};

export const CURRENT_ENV: Environment = getEnvironment();

// Environment-specific configuration
interface EnvironmentConfig {
  environment: Environment;
  isDevelopment: boolean;
  isStaging: boolean;
  isProduction: boolean;
  enableDebugLogs: boolean;
  enableAnalytics: boolean;
  enableCrashReporting: boolean;
  apiTimeout: number;
  maxRetries: number;
  cacheTimeout: number;
}

const developmentConfig: EnvironmentConfig = {
  environment: 'development',
  isDevelopment: true,
  isStaging: false,
  isProduction: false,
  enableDebugLogs: true,
  enableAnalytics: false,
  enableCrashReporting: false,
  apiTimeout: 30000,
  maxRetries: 1,
  cacheTimeout: 60000, // 1 minute
};

const stagingConfig: EnvironmentConfig = {
  environment: 'staging',
  isDevelopment: false,
  isStaging: true,
  isProduction: false,
  enableDebugLogs: true,
  enableAnalytics: true,
  enableCrashReporting: true,
  apiTimeout: 20000,
  maxRetries: 2,
  cacheTimeout: 300000, // 5 minutes
};

const productionConfig: EnvironmentConfig = {
  environment: 'production',
  isDevelopment: false,
  isStaging: false,
  isProduction: true,
  enableDebugLogs: false,
  enableAnalytics: true,
  enableCrashReporting: true,
  apiTimeout: 15000,
  maxRetries: 3,
  cacheTimeout: 300000, // 5 minutes
};

const configs: Record<Environment, EnvironmentConfig> = {
  development: developmentConfig,
  staging: stagingConfig,
  production: productionConfig,
};

export const ENV_CONFIG: EnvironmentConfig = configs[CURRENT_ENV];

// Firebase project IDs for each environment
export const FIREBASE_PROJECTS = {
  development: 'land-app-dev',
  staging: 'land-app-staging',
  production: 'land-app-prod',
} as const;

// Get current Firebase project ID
export const getCurrentFirebaseProject = (): string => {
  return process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || FIREBASE_PROJECTS[CURRENT_ENV];
};

// Environment validation - prevents accidental production writes from dev
export const validateEnvironment = (): void => {
  const projectId = getCurrentFirebaseProject();
  
  if (ENV_CONFIG.isDevelopment && projectId.includes('prod')) {
    console.error(
      '[ENVIRONMENT WARNING] Development environment is configured to use production Firebase project!',
      'This may cause accidental production writes.',
      'Please check your EXPO_PUBLIC_FIREBASE_PROJECT_ID environment variable.'
    );
  }
  
  if (ENV_CONFIG.isProduction && projectId.includes('dev')) {
    console.error(
      '[ENVIRONMENT WARNING] Production environment is configured to use development Firebase project!',
      'Please check your EXPO_PUBLIC_FIREBASE_PROJECT_ID environment variable.'
    );
  }
};

// Safe logging that respects environment settings
export const envLog = {
  debug: (...args: unknown[]): void => {
    if (ENV_CONFIG.enableDebugLogs) {
      console.log('[DEBUG]', ...args);
    }
  },
  info: (...args: unknown[]): void => {
    console.log('[INFO]', ...args);
  },
  warn: (...args: unknown[]): void => {
    console.warn('[WARN]', ...args);
  },
  error: (...args: unknown[]): void => {
    console.error('[ERROR]', ...args);
  },
};

// Export environment check utilities
export const isDevEnvironment = (): boolean => ENV_CONFIG.isDevelopment;
export const isStagingEnvironment = (): boolean => ENV_CONFIG.isStaging;
export const isProdEnvironment = (): boolean => ENV_CONFIG.isProduction;
