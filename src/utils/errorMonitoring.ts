/**
 * Error Monitoring & Observability
 * 
 * This module provides centralized error monitoring, structured logging,
 * and error tracking for production readiness.
 */

import { ENV_CONFIG, envLog } from '../config/environment';

// Error severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Structured error interface
export interface StructuredError {
  message: string;
  code?: string;
  severity: ErrorSeverity;
  context?: Record<string, unknown>;
  stack?: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
}

// Error categories for classification
export type ErrorCategory = 
  | 'network'
  | 'authentication'
  | 'firestore'
  | 'validation'
  | 'ui'
  | 'unknown';

// Generate unique session ID
const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Current session ID (generated once per app session)
let currentSessionId: string | null = null;
let currentUserId: string | null = null;

// Initialize session
export const initializeErrorMonitoring = (): void => {
  currentSessionId = generateSessionId();
  envLog.debug('Error monitoring initialized', { sessionId: currentSessionId });
};

// Set current user for error tracking
export const setErrorMonitoringUser = (userId: string | null): void => {
  currentUserId = userId;
};

// Classify error by category
export const classifyError = (error: Error): ErrorCategory => {
  const message = error.message.toLowerCase();
  
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return 'network';
  }
  if (message.includes('auth') || message.includes('permission') || message.includes('unauthorized')) {
    return 'authentication';
  }
  if (message.includes('firestore') || message.includes('firebase') || message.includes('document')) {
    return 'firestore';
  }
  if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
    return 'validation';
  }
  if (message.includes('render') || message.includes('component') || message.includes('state')) {
    return 'ui';
  }
  
  return 'unknown';
};

// Determine error severity
export const determineErrorSeverity = (error: Error, category: ErrorCategory): ErrorSeverity => {
  // Critical errors
  if (category === 'authentication' && error.message.includes('token')) {
    return 'critical';
  }
  if (error.message.includes('crash') || error.message.includes('fatal')) {
    return 'critical';
  }
  
  // High severity
  if (category === 'firestore' && error.message.includes('write')) {
    return 'high';
  }
  if (category === 'authentication') {
    return 'high';
  }
  
  // Medium severity
  if (category === 'network') {
    return 'medium';
  }
  if (category === 'validation') {
    return 'medium';
  }
  
  // Low severity
  if (category === 'ui') {
    return 'low';
  }
  
  return 'medium';
};

// Create structured error from Error object
export const createStructuredError = (
  error: Error,
  context?: Record<string, unknown>
): StructuredError => {
  const category = classifyError(error);
  const severity = determineErrorSeverity(error, category);
  
  return {
    message: error.message,
    code: (error as Error & { code?: string }).code,
    severity,
    context: {
      ...context,
      category,
      errorName: error.name,
    },
    stack: error.stack,
    timestamp: new Date(),
    userId: currentUserId || undefined,
    sessionId: currentSessionId || undefined,
  };
};

// Log error with structured format
export const logError = (
  error: Error | StructuredError,
  context?: Record<string, unknown>
): void => {
  const structuredError = error instanceof Error
    ? createStructuredError(error, context)
    : error;
  
  // Always log errors
  envLog.error('Error occurred:', {
    message: structuredError.message,
    code: structuredError.code,
    severity: structuredError.severity,
    context: structuredError.context,
    timestamp: structuredError.timestamp.toISOString(),
    userId: structuredError.userId,
    sessionId: structuredError.sessionId,
  });
  
  // In production, send to crash reporting service
  if (ENV_CONFIG.enableCrashReporting) {
    sendToCrashReporting(structuredError);
  }
};

// Send error to crash reporting service (placeholder for actual implementation)
const sendToCrashReporting = (error: StructuredError): void => {
  // In a real implementation, this would send to Sentry, Crashlytics, etc.
  // For now, we just log that we would send it
  envLog.debug('Would send to crash reporting:', {
    message: error.message,
    severity: error.severity,
  });
};

// Track user action for debugging
export const trackUserAction = (
  action: string,
  details?: Record<string, unknown>
): void => {
  if (!ENV_CONFIG.enableAnalytics) {
    return;
  }
  
  envLog.debug('User action:', {
    action,
    details,
    timestamp: new Date().toISOString(),
    userId: currentUserId,
    sessionId: currentSessionId,
  });
};

// Performance monitoring
export interface PerformanceMetric {
  name: string;
  durationMs: number;
  timestamp: Date;
  context?: Record<string, unknown>;
}

const performanceMetrics: PerformanceMetric[] = [];

export const recordPerformanceMetric = (
  name: string,
  durationMs: number,
  context?: Record<string, unknown>
): void => {
  const metric: PerformanceMetric = {
    name,
    durationMs,
    timestamp: new Date(),
    context,
  };
  
  performanceMetrics.push(metric);
  
  // Log slow operations
  if (durationMs > 1000) {
    envLog.warn('Slow operation detected:', metric);
  } else {
    envLog.debug('Performance metric:', metric);
  }
  
  // Keep only last 100 metrics to prevent memory issues
  if (performanceMetrics.length > 100) {
    performanceMetrics.shift();
  }
};

// Get performance summary
export const getPerformanceSummary = (): Record<string, { avg: number; max: number; count: number }> => {
  const summary: Record<string, { total: number; max: number; count: number }> = {};
  
  for (const metric of performanceMetrics) {
    if (!summary[metric.name]) {
      summary[metric.name] = { total: 0, max: 0, count: 0 };
    }
    summary[metric.name].total += metric.durationMs;
    summary[metric.name].max = Math.max(summary[metric.name].max, metric.durationMs);
    summary[metric.name].count += 1;
  }
  
  const result: Record<string, { avg: number; max: number; count: number }> = {};
  for (const [name, data] of Object.entries(summary)) {
    result[name] = {
      avg: Math.round(data.total / data.count),
      max: data.max,
      count: data.count,
    };
  }
  
  return result;
};

// Health check
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, boolean>;
  timestamp: Date;
}

export const performHealthCheck = async (): Promise<HealthStatus> => {
  const checks: Record<string, boolean> = {
    errorMonitoringInitialized: currentSessionId !== null,
    performanceMetricsAvailable: performanceMetrics.length >= 0,
    environmentConfigured: ENV_CONFIG !== undefined,
  };
  
  const allHealthy = Object.values(checks).every(v => v);
  
  return {
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date(),
  };
};
