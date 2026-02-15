/**
 * Firestore Cost & Safety Audit
 * 
 * This module provides cost estimation, query efficiency analysis,
 * and hard limits for Firestore operations.
 */

import { envLog } from '../config/environment';

// Firestore pricing (as of 2024, prices may vary by region)
export const FIRESTORE_PRICING = {
  // Per 100,000 operations
  DOCUMENT_READS: 0.06,    // $0.06 per 100k reads
  DOCUMENT_WRITES: 0.18,   // $0.18 per 100k writes
  DOCUMENT_DELETES: 0.02,  // $0.02 per 100k deletes
  // Storage
  STORAGE_PER_GB: 0.18,    // $0.18 per GB per month
  // Network
  NETWORK_EGRESS_PER_GB: 0.12, // $0.12 per GB (varies by region)
} as const;

// Hard limits to prevent runaway costs
export const FIRESTORE_LIMITS = {
  MAX_READS_PER_QUERY: 1000,
  MAX_WRITES_PER_BATCH: 500,
  MAX_DOCUMENT_SIZE_BYTES: 1048576, // 1 MB
  MAX_FIELD_VALUE_SIZE_BYTES: 1048487, // ~1 MB minus overhead
  MAX_SUBCOLLECTION_DEPTH: 100,
  MAX_COMPOSITE_INDEX_FIELDS: 200,
  MAX_ARRAY_ELEMENTS: 40000,
  DAILY_READ_BUDGET: 50000,  // Soft limit for cost control
  DAILY_WRITE_BUDGET: 20000, // Soft limit for cost control
} as const;

// Operation tracking
interface OperationStats {
  reads: number;
  writes: number;
  deletes: number;
  lastReset: Date;
}

let dailyStats: OperationStats = {
  reads: 0,
  writes: 0,
  deletes: 0,
  lastReset: new Date(),
};

// Reset daily stats if it's a new day
const checkAndResetDailyStats = (): void => {
  const now = new Date();
  const lastReset = dailyStats.lastReset;
  
  if (
    now.getDate() !== lastReset.getDate() ||
    now.getMonth() !== lastReset.getMonth() ||
    now.getFullYear() !== lastReset.getFullYear()
  ) {
    dailyStats = {
      reads: 0,
      writes: 0,
      deletes: 0,
      lastReset: now,
    };
    envLog.debug('Daily Firestore stats reset');
  }
};

// Track read operation
export const trackRead = (count: number = 1): void => {
  checkAndResetDailyStats();
  dailyStats.reads += count;
  
  if (dailyStats.reads > FIRESTORE_LIMITS.DAILY_READ_BUDGET) {
    envLog.warn('Daily read budget exceeded', {
      current: dailyStats.reads,
      budget: FIRESTORE_LIMITS.DAILY_READ_BUDGET,
    });
  }
};

// Track write operation
export const trackWrite = (count: number = 1): void => {
  checkAndResetDailyStats();
  dailyStats.writes += count;
  
  if (dailyStats.writes > FIRESTORE_LIMITS.DAILY_WRITE_BUDGET) {
    envLog.warn('Daily write budget exceeded', {
      current: dailyStats.writes,
      budget: FIRESTORE_LIMITS.DAILY_WRITE_BUDGET,
    });
  }
};

// Track delete operation
export const trackDelete = (count: number = 1): void => {
  checkAndResetDailyStats();
  dailyStats.deletes += count;
};

// Get current daily stats
export const getDailyStats = (): OperationStats => {
  checkAndResetDailyStats();
  return { ...dailyStats };
};

// Estimate daily cost based on current usage
export const estimateDailyCost = (): number => {
  const stats = getDailyStats();
  
  const readCost = (stats.reads / 100000) * FIRESTORE_PRICING.DOCUMENT_READS;
  const writeCost = (stats.writes / 100000) * FIRESTORE_PRICING.DOCUMENT_WRITES;
  const deleteCost = (stats.deletes / 100000) * FIRESTORE_PRICING.DOCUMENT_DELETES;
  
  return readCost + writeCost + deleteCost;
};

// Estimate monthly cost based on projected usage
export interface MonthlyCostEstimate {
  reads: number;
  writes: number;
  deletes: number;
  storage: number;
  total: number;
  breakdown: {
    readCost: number;
    writeCost: number;
    deleteCost: number;
    storageCost: number;
  };
}

export const estimateMonthlyCost = (
  dailyReads: number,
  dailyWrites: number,
  dailyDeletes: number,
  storageGB: number
): MonthlyCostEstimate => {
  const monthlyReads = dailyReads * 30;
  const monthlyWrites = dailyWrites * 30;
  const monthlyDeletes = dailyDeletes * 30;
  
  const readCost = (monthlyReads / 100000) * FIRESTORE_PRICING.DOCUMENT_READS;
  const writeCost = (monthlyWrites / 100000) * FIRESTORE_PRICING.DOCUMENT_WRITES;
  const deleteCost = (monthlyDeletes / 100000) * FIRESTORE_PRICING.DOCUMENT_DELETES;
  const storageCost = storageGB * FIRESTORE_PRICING.STORAGE_PER_GB;
  
  return {
    reads: monthlyReads,
    writes: monthlyWrites,
    deletes: monthlyDeletes,
    storage: storageGB,
    total: readCost + writeCost + deleteCost + storageCost,
    breakdown: {
      readCost,
      writeCost,
      deleteCost,
      storageCost,
    },
  };
};

// Query efficiency analysis
export interface QueryEfficiencyResult {
  isEfficient: boolean;
  score: number; // 0-100
  issues: string[];
  recommendations: string[];
}

export const analyzeQueryEfficiency = (
  queryDescription: string,
  options: {
    hasIndex?: boolean;
    usesLimit?: boolean;
    limitValue?: number;
    usesWhere?: boolean;
    whereFieldsCount?: number;
    usesOrderBy?: boolean;
    usesStartAfter?: boolean;
    estimatedDocuments?: number;
  }
): QueryEfficiencyResult => {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;
  
  // Check for index usage
  if (options.hasIndex === false) {
    issues.push('Query may not use an index');
    recommendations.push('Add a composite index for this query');
    score -= 30;
  }
  
  // Check for limit
  if (!options.usesLimit) {
    issues.push('Query does not use limit()');
    recommendations.push('Add limit() to prevent loading too many documents');
    score -= 20;
  } else if (options.limitValue && options.limitValue > FIRESTORE_LIMITS.MAX_READS_PER_QUERY) {
    issues.push(`Limit (${options.limitValue}) exceeds recommended maximum (${FIRESTORE_LIMITS.MAX_READS_PER_QUERY})`);
    recommendations.push(`Reduce limit to ${FIRESTORE_LIMITS.MAX_READS_PER_QUERY} or less`);
    score -= 15;
  }
  
  // Check for pagination
  if (!options.usesStartAfter && options.estimatedDocuments && options.estimatedDocuments > 100) {
    issues.push('Large collection without pagination');
    recommendations.push('Implement cursor-based pagination with startAfter()');
    score -= 15;
  }
  
  // Check for where clause
  if (!options.usesWhere) {
    issues.push('Query does not filter with where()');
    recommendations.push('Add where() clauses to reduce documents read');
    score -= 10;
  }
  
  // Check for too many where fields
  if (options.whereFieldsCount && options.whereFieldsCount > 3) {
    issues.push(`Query uses ${options.whereFieldsCount} where clauses`);
    recommendations.push('Consider denormalizing data to reduce query complexity');
    score -= 5;
  }
  
  // Estimated document count warning
  if (options.estimatedDocuments && options.estimatedDocuments > 10000) {
    issues.push(`Query may read up to ${options.estimatedDocuments} documents`);
    recommendations.push('Consider using subcollections or sharding');
    score -= 10;
  }
  
  return {
    isEfficient: score >= 70,
    score: Math.max(0, score),
    issues,
    recommendations,
  };
};

// Validate document size before write
export const validateDocumentSize = (
  data: Record<string, unknown>
): { isValid: boolean; sizeBytes: number; issues: string[] } => {
  const jsonString = JSON.stringify(data);
  const sizeBytes = new TextEncoder().encode(jsonString).length;
  const issues: string[] = [];
  
  if (sizeBytes > FIRESTORE_LIMITS.MAX_DOCUMENT_SIZE_BYTES) {
    issues.push(`Document size (${sizeBytes} bytes) exceeds maximum (${FIRESTORE_LIMITS.MAX_DOCUMENT_SIZE_BYTES} bytes)`);
  }
  
  // Check for large arrays
  const checkArrays = (obj: Record<string, unknown>, path: string = ''): void => {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (Array.isArray(value)) {
        if (value.length > FIRESTORE_LIMITS.MAX_ARRAY_ELEMENTS) {
          issues.push(`Array at ${currentPath} has ${value.length} elements (max: ${FIRESTORE_LIMITS.MAX_ARRAY_ELEMENTS})`);
        }
      } else if (value && typeof value === 'object') {
        checkArrays(value as Record<string, unknown>, currentPath);
      }
    }
  };
  
  checkArrays(data);
  
  return {
    isValid: issues.length === 0,
    sizeBytes,
    issues,
  };
};

// Cost audit report
export interface CostAuditReport {
  timestamp: Date;
  dailyStats: OperationStats;
  estimatedDailyCost: number;
  estimatedMonthlyCost: MonthlyCostEstimate;
  budgetStatus: {
    readsWithinBudget: boolean;
    writesWithinBudget: boolean;
    readUtilization: number;
    writeUtilization: number;
  };
  recommendations: string[];
}

export const generateCostAuditReport = (storageGB: number = 1): CostAuditReport => {
  const stats = getDailyStats();
  const dailyCost = estimateDailyCost();
  const monthlyCost = estimateMonthlyCost(stats.reads, stats.writes, stats.deletes, storageGB);
  
  const readUtilization = (stats.reads / FIRESTORE_LIMITS.DAILY_READ_BUDGET) * 100;
  const writeUtilization = (stats.writes / FIRESTORE_LIMITS.DAILY_WRITE_BUDGET) * 100;
  
  const recommendations: string[] = [];
  
  if (readUtilization > 80) {
    recommendations.push('Read utilization is high. Consider implementing caching.');
  }
  if (writeUtilization > 80) {
    recommendations.push('Write utilization is high. Consider batching writes.');
  }
  if (monthlyCost.total > 50) {
    recommendations.push('Monthly cost exceeds $50. Review query efficiency.');
  }
  
  return {
    timestamp: new Date(),
    dailyStats: stats,
    estimatedDailyCost: dailyCost,
    estimatedMonthlyCost: monthlyCost,
    budgetStatus: {
      readsWithinBudget: stats.reads <= FIRESTORE_LIMITS.DAILY_READ_BUDGET,
      writesWithinBudget: stats.writes <= FIRESTORE_LIMITS.DAILY_WRITE_BUDGET,
      readUtilization,
      writeUtilization,
    },
    recommendations,
  };
};
