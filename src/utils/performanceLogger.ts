type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface FirestoreReadEstimate {
  collection: string;
  operation: 'get' | 'query' | 'list';
  estimatedReads: number;
  filters: number;
  limit?: number;
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

class PerformanceLogger {
  private metrics: PerformanceMetric[] = [];
  private timers: Map<string, number> = new Map();
  private enabled: boolean = !IS_PRODUCTION;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  startTimer(name: string): void {
    if (!this.enabled) return;
    this.timers.set(name, Date.now());
  }

  endTimer(name: string, metadata?: Record<string, any>): number {
    if (!this.enabled) return 0;
    
    const startTime = this.timers.get(name);
    if (!startTime) return 0;
    
    const duration = Date.now() - startTime;
    this.timers.delete(name);
    
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: new Date(),
      metadata,
    };
    
    this.metrics.push(metric);
    
    if (this.metrics.length > 100) {
      this.metrics.shift();
    }
    
    return duration;
  }

  log(level: LogLevel, message: string, data?: Record<string, any>): void {
    if (IS_PRODUCTION && level === 'debug') return;
    
    const timestamp = new Date().toISOString();
    const logData = { timestamp, level, message, ...data };
    
    switch (level) {
      case 'debug':
      case 'info':
        break;
      case 'warn':
        break;
      case 'error':
        break;
    }
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  clearMetrics(): void {
    this.metrics = [];
  }

  getAverageTime(name: string): number {
    const relevantMetrics = this.metrics.filter(m => m.name === name);
    if (relevantMetrics.length === 0) return 0;
    
    const total = relevantMetrics.reduce((sum, m) => sum + m.duration, 0);
    return total / relevantMetrics.length;
  }
}

export const performanceLogger = new PerformanceLogger();

export const estimateFirestoreReads = (estimate: FirestoreReadEstimate): number => {
  let reads = estimate.estimatedReads;
  
  if (estimate.operation === 'query') {
    reads = Math.max(1, estimate.estimatedReads);
  } else if (estimate.operation === 'list') {
    reads = estimate.limit || estimate.estimatedReads;
  }
  
  return reads;
};

export const formatReadCost = (reads: number): string => {
  const costPer100k = 0.06;
  const cost = (reads / 100000) * costPer100k;
  
  if (cost < 0.01) {
    return `~${reads} reads (< $0.01)`;
  }
  
  return `~${reads} reads (~$${cost.toFixed(4)})`;
};

export const withPerformanceTracking = async <T>(
  name: string,
  operation: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> => {
  performanceLogger.startTimer(name);
  try {
    const result = await operation();
    performanceLogger.endTimer(name, { ...metadata, success: true });
    return result;
  } catch (error) {
    performanceLogger.endTimer(name, { ...metadata, success: false, error: String(error) });
    throw error;
  }
};

export const logFirestoreOperation = (
  operation: string,
  collection: string,
  documentCount: number,
  duration: number
): void => {
  performanceLogger.log('info', `Firestore ${operation}`, {
    collection,
    documentCount,
    duration,
    estimatedCost: formatReadCost(documentCount),
  });
};
