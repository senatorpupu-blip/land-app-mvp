/**
 * Data Backup & Recovery
 * 
 * This module provides utilities for data backup, recovery,
 * and soft-delete validation for production readiness.
 */

import { envLog } from '../config/environment';

// Soft-delete configuration
export const SOFT_DELETE_CONFIG = {
  RETENTION_DAYS: 30, // Days to keep soft-deleted items
  AUTO_PURGE_ENABLED: true,
  GRACE_PERIOD_HOURS: 24, // Hours before soft-delete becomes permanent
} as const;

// Backup configuration
export const BACKUP_CONFIG = {
  COLLECTIONS_TO_BACKUP: [
    'landPlots',
    'users',
    'chats',
    'messages',
    'news',
    'pricingRules',
    'oblastCenters',
  ],
  BACKUP_FREQUENCY_HOURS: 24,
  MAX_BACKUPS_TO_KEEP: 7,
  BACKUP_STORAGE_PATH: 'backups',
} as const;

// Soft-delete status
export interface SoftDeleteStatus {
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: string | null;
  canRecover: boolean;
  hoursUntilPermanent: number | null;
  daysUntilPurge: number | null;
}

// Check if a document is soft-deleted and can be recovered
export const getSoftDeleteStatus = (
  deletedAt: Date | null | undefined,
  deletedBy?: string | null
): SoftDeleteStatus => {
  if (!deletedAt) {
    return {
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      canRecover: false,
      hoursUntilPermanent: null,
      daysUntilPurge: null,
    };
  }

  const now = new Date();
  const deletedTime = new Date(deletedAt);
  const hoursSinceDelete = (now.getTime() - deletedTime.getTime()) / (1000 * 60 * 60);
  const daysSinceDelete = hoursSinceDelete / 24;

  const canRecover = hoursSinceDelete < SOFT_DELETE_CONFIG.GRACE_PERIOD_HOURS;
  const hoursUntilPermanent = canRecover
    ? Math.max(0, SOFT_DELETE_CONFIG.GRACE_PERIOD_HOURS - hoursSinceDelete)
    : null;
  const daysUntilPurge = daysSinceDelete < SOFT_DELETE_CONFIG.RETENTION_DAYS
    ? Math.max(0, SOFT_DELETE_CONFIG.RETENTION_DAYS - daysSinceDelete)
    : 0;

  return {
    isDeleted: true,
    deletedAt: deletedTime,
    deletedBy: deletedBy || null,
    canRecover,
    hoursUntilPermanent: hoursUntilPermanent !== null ? Math.round(hoursUntilPermanent * 10) / 10 : null,
    daysUntilPurge: Math.round(daysUntilPurge * 10) / 10,
  };
};

// Validate soft-delete before permanent deletion
export const validateSoftDeleteForPurge = (
  deletedAt: Date | null | undefined
): { canPurge: boolean; reason: string } => {
  if (!deletedAt) {
    return { canPurge: false, reason: 'Document is not soft-deleted' };
  }

  const status = getSoftDeleteStatus(deletedAt);

  if (status.canRecover) {
    return {
      canPurge: false,
      reason: `Document is within grace period. ${status.hoursUntilPermanent} hours remaining.`,
    };
  }

  if (status.daysUntilPurge && status.daysUntilPurge > 0) {
    return {
      canPurge: false,
      reason: `Document is within retention period. ${status.daysUntilPurge} days remaining.`,
    };
  }

  return { canPurge: true, reason: 'Document can be permanently deleted' };
};

// Backup metadata
export interface BackupMetadata {
  id: string;
  timestamp: Date;
  collections: string[];
  documentCounts: Record<string, number>;
  totalDocuments: number;
  sizeBytes: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
}

// Generate backup ID
export const generateBackupId = (): string => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
  return `backup_${dateStr}_${timeStr}`;
};

// Create backup metadata
export const createBackupMetadata = (
  collections: string[] = [...BACKUP_CONFIG.COLLECTIONS_TO_BACKUP]
): BackupMetadata => {
  return {
    id: generateBackupId(),
    timestamp: new Date(),
    collections,
    documentCounts: {},
    totalDocuments: 0,
    sizeBytes: 0,
    status: 'pending',
  };
};

// Update backup progress
export const updateBackupProgress = (
  metadata: BackupMetadata,
  collection: string,
  documentCount: number,
  sizeBytes: number
): BackupMetadata => {
  return {
    ...metadata,
    documentCounts: {
      ...metadata.documentCounts,
      [collection]: documentCount,
    },
    totalDocuments: metadata.totalDocuments + documentCount,
    sizeBytes: metadata.sizeBytes + sizeBytes,
    status: 'in_progress',
  };
};

// Complete backup
export const completeBackup = (
  metadata: BackupMetadata,
  success: boolean,
  error?: string
): BackupMetadata => {
  return {
    ...metadata,
    status: success ? 'completed' : 'failed',
    error,
  };
};

// Recovery options
export interface RecoveryOptions {
  targetTimestamp?: Date;
  collections?: string[];
  documentIds?: string[];
  dryRun?: boolean;
}

// Recovery result
export interface RecoveryResult {
  success: boolean;
  recoveredDocuments: number;
  failedDocuments: number;
  errors: string[];
  dryRun: boolean;
}

// Validate recovery options
export const validateRecoveryOptions = (
  options: RecoveryOptions
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (options.targetTimestamp) {
    const now = new Date();
    if (options.targetTimestamp > now) {
      errors.push('Target timestamp cannot be in the future');
    }

    const maxAge = BACKUP_CONFIG.MAX_BACKUPS_TO_KEEP * BACKUP_CONFIG.BACKUP_FREQUENCY_HOURS;
    const hoursAgo = (now.getTime() - options.targetTimestamp.getTime()) / (1000 * 60 * 60);
    if (hoursAgo > maxAge) {
      errors.push(`Target timestamp is older than available backups (max ${maxAge} hours)`);
    }
  }

  if (options.collections) {
    const validCollections = BACKUP_CONFIG.COLLECTIONS_TO_BACKUP as readonly string[];
    const invalidCollections = options.collections.filter(
      c => !validCollections.includes(c)
    );
    if (invalidCollections.length > 0) {
      errors.push(`Invalid collections: ${invalidCollections.join(', ')}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Simulate recovery (for dry run)
export const simulateRecovery = (
  options: RecoveryOptions
): RecoveryResult => {
  const validation = validateRecoveryOptions(options);

  if (!validation.isValid) {
    return {
      success: false,
      recoveredDocuments: 0,
      failedDocuments: 0,
      errors: validation.errors,
      dryRun: true,
    };
  }

  // Simulate successful recovery
  const estimatedDocuments = options.documentIds?.length || 100;

  envLog.info('Recovery simulation completed', {
    options,
    estimatedDocuments,
  });

  return {
    success: true,
    recoveredDocuments: estimatedDocuments,
    failedDocuments: 0,
    errors: [],
    dryRun: true,
  };
};

// Data integrity check
export interface IntegrityCheckResult {
  collection: string;
  totalDocuments: number;
  validDocuments: number;
  invalidDocuments: number;
  issues: Array<{
    documentId: string;
    issue: string;
  }>;
}

// Validate document structure
export const validateDocumentStructure = (
  collection: string,
  documentId: string,
  data: Record<string, unknown>,
  requiredFields: string[]
): { isValid: boolean; missingFields: string[] } => {
  const missingFields = requiredFields.filter(field => {
    const value = data[field];
    return value === undefined || value === null;
  });

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
};

// Collection required fields
export const COLLECTION_REQUIRED_FIELDS: Record<string, string[]> = {
  landPlots: ['title', 'area', 'pricePerSotka', 'location', 'ownerId', 'status'],
  users: ['email', 'role', 'createdAt'],
  news: ['title', 'content', 'authorId', 'status'],
  chats: ['plotId', 'ownerId', 'clientId'],
  messages: ['chatId', 'senderId', 'content'],
};

// Get required fields for collection
export const getRequiredFields = (collection: string): string[] => {
  return COLLECTION_REQUIRED_FIELDS[collection] || [];
};

// Backup schedule status
export interface BackupScheduleStatus {
  lastBackup: Date | null;
  nextBackup: Date;
  isOverdue: boolean;
  hoursUntilNext: number;
}

// Get backup schedule status
export const getBackupScheduleStatus = (
  lastBackupTime: Date | null
): BackupScheduleStatus => {
  const now = new Date();
  const frequencyMs = BACKUP_CONFIG.BACKUP_FREQUENCY_HOURS * 60 * 60 * 1000;

  let nextBackup: Date;
  let isOverdue = false;

  if (lastBackupTime) {
    nextBackup = new Date(lastBackupTime.getTime() + frequencyMs);
    isOverdue = now > nextBackup;
  } else {
    nextBackup = now;
    isOverdue = true;
  }

  const hoursUntilNext = Math.max(0, (nextBackup.getTime() - now.getTime()) / (1000 * 60 * 60));

  return {
    lastBackup: lastBackupTime,
    nextBackup,
    isOverdue,
    hoursUntilNext: Math.round(hoursUntilNext * 10) / 10,
  };
};
