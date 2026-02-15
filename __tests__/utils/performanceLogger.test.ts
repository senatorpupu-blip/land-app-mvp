import {
  performanceLogger,
  estimateFirestoreReads,
  formatReadCost,
  withPerformanceTracking,
} from '../../src/utils/performanceLogger';

describe('Performance Logger', () => {
  beforeEach(() => {
    performanceLogger.clearMetrics();
    performanceLogger.setEnabled(true);
  });

  describe('timer operations', () => {
    it('should track timer duration', async () => {
      performanceLogger.startTimer('test-operation');
      await new Promise(resolve => setTimeout(resolve, 50));
      const duration = performanceLogger.endTimer('test-operation');
      
      expect(duration).toBeGreaterThanOrEqual(45);
      expect(duration).toBeLessThan(150);
    });

    it('should return 0 for non-existent timer', () => {
      const duration = performanceLogger.endTimer('non-existent');
      expect(duration).toBe(0);
    });

    it('should store metrics', () => {
      performanceLogger.startTimer('test1');
      performanceLogger.endTimer('test1', { key: 'value' });
      
      const metrics = performanceLogger.getMetrics();
      expect(metrics.length).toBe(1);
      expect(metrics[0].name).toBe('test1');
      expect(metrics[0].metadata).toEqual({ key: 'value' });
    });
  });

  describe('getAverageTime', () => {
    it('should calculate average time for operations', () => {
      performanceLogger.startTimer('op1');
      performanceLogger.endTimer('op1');
      performanceLogger.startTimer('op1');
      performanceLogger.endTimer('op1');
      
      const avg = performanceLogger.getAverageTime('op1');
      expect(avg).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for unknown operation', () => {
      const avg = performanceLogger.getAverageTime('unknown');
      expect(avg).toBe(0);
    });
  });

  describe('clearMetrics', () => {
    it('should clear all metrics', () => {
      performanceLogger.startTimer('test');
      performanceLogger.endTimer('test');
      
      expect(performanceLogger.getMetrics().length).toBe(1);
      
      performanceLogger.clearMetrics();
      
      expect(performanceLogger.getMetrics().length).toBe(0);
    });
  });
});

describe('Firestore Read Estimator', () => {
  describe('estimateFirestoreReads', () => {
    it('should estimate reads for get operation', () => {
      const reads = estimateFirestoreReads({
        collection: 'plots',
        operation: 'get',
        estimatedReads: 1,
        filters: 0,
      });
      
      expect(reads).toBe(1);
    });

    it('should estimate reads for query operation', () => {
      const reads = estimateFirestoreReads({
        collection: 'plots',
        operation: 'query',
        estimatedReads: 100,
        filters: 2,
      });
      
      expect(reads).toBe(100);
    });

    it('should use limit for list operation', () => {
      const reads = estimateFirestoreReads({
        collection: 'plots',
        operation: 'list',
        estimatedReads: 1000,
        filters: 0,
        limit: 50,
      });
      
      expect(reads).toBe(50);
    });
  });

  describe('formatReadCost', () => {
    it('should format small read counts', () => {
      const formatted = formatReadCost(100);
      expect(formatted).toContain('100 reads');
      expect(formatted).toContain('< $0.01');
    });

    it('should format large read counts with cost', () => {
      const formatted = formatReadCost(1000000);
      expect(formatted).toContain('1000000 reads');
      expect(formatted).toContain('$');
    });
  });
});

describe('withPerformanceTracking', () => {
  beforeEach(() => {
    performanceLogger.clearMetrics();
    performanceLogger.setEnabled(true);
  });

  it('should track successful operations', async () => {
    const result = await withPerformanceTracking(
      'async-op',
      async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'success';
      }
    );
    
    expect(result).toBe('success');
    
    const metrics = performanceLogger.getMetrics();
    expect(metrics.length).toBe(1);
    expect(metrics[0].metadata?.success).toBe(true);
  });

  it('should track failed operations', async () => {
    await expect(
      withPerformanceTracking(
        'failing-op',
        async () => {
          throw new Error('Test error');
        }
      )
    ).rejects.toThrow('Test error');
    
    const metrics = performanceLogger.getMetrics();
    expect(metrics.length).toBe(1);
    expect(metrics[0].metadata?.success).toBe(false);
  });
});
