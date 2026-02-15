import {
  generateMockPlot,
  generateMockPlots,
  benchmark,
  benchmarkAverage,
  testBoundingBoxFilter,
  testPriceRangeFilter,
  testCombinedFilters,
  estimateMemoryUsage,
  PERFORMANCE_THRESHOLDS,
} from '../../src/utils/performanceBenchmark';

describe('performanceBenchmark', () => {
  describe('generateMockPlot', () => {
    it('should generate a valid plot object', () => {
      const plot = generateMockPlot(0);
      
      expect(plot.id).toBe('mock-plot-0');
      expect(plot.title).toContain('Земельна ділянка');
      expect(plot.area).toBeGreaterThanOrEqual(10);
      expect(plot.area).toBeLessThanOrEqual(1000);
      expect(plot.pricePerSotka).toBeGreaterThanOrEqual(1000);
      expect(plot.totalPrice).toBe(plot.area * plot.pricePerSotka);
      expect(plot.location.latitude).toBeGreaterThanOrEqual(44.3);
      expect(plot.location.latitude).toBeLessThanOrEqual(52.3);
      expect(plot.location.longitude).toBeGreaterThanOrEqual(22.1);
      expect(plot.location.longitude).toBeLessThanOrEqual(40.1);
    });

    it('should generate unique plots for different indices', () => {
      const plot1 = generateMockPlot(0);
      const plot2 = generateMockPlot(1);
      
      expect(plot1.id).not.toBe(plot2.id);
      expect(plot1.cadastralNumber).not.toBe(plot2.cadastralNumber);
    });
  });

  describe('generateMockPlots', () => {
    it('should generate the requested number of plots', () => {
      const plots = generateMockPlots(100);
      expect(plots).toHaveLength(100);
    });

    it('should generate 10k plots efficiently', () => {
      const start = performance.now();
      const plots = generateMockPlots(10000);
      const duration = performance.now() - start;
      
      expect(plots).toHaveLength(10000);
      expect(duration).toBeLessThan(1000); // Should generate 10k plots in under 1 second
    });
  });

  describe('benchmark', () => {
    it('should measure function execution time', async () => {
      const { result, durationMs } = await benchmark('test', () => {
        let sum = 0;
        for (let i = 0; i < 1000; i++) sum += i;
        return sum;
      });
      
      expect(result).toBe(499500);
      expect(durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle async functions', async () => {
      const { result, durationMs } = await benchmark('async-test', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'done';
      });
      
      expect(result).toBe('done');
      // Allow slight timing variance (setTimeout is not perfectly precise)
      expect(durationMs).toBeGreaterThanOrEqual(8);
    });
  });

  describe('benchmarkAverage', () => {
    it('should calculate average execution time', async () => {
      const stats = await benchmarkAverage('test', () => {
        let sum = 0;
        for (let i = 0; i < 100; i++) sum += i;
        return sum;
      }, 3);
      
      expect(stats.avgMs).toBeGreaterThanOrEqual(0);
      expect(stats.minMs).toBeLessThanOrEqual(stats.avgMs);
      expect(stats.maxMs).toBeGreaterThanOrEqual(stats.avgMs);
    });
  });

  describe('Performance with 10k listings', () => {
    let plots: ReturnType<typeof generateMockPlots>;

    beforeAll(() => {
      plots = generateMockPlots(10000);
    });

    describe('testBoundingBoxFilter', () => {
      it('should filter 10k plots by bounding box within threshold', () => {
        const boundingBox = {
          north: 50.5,
          south: 48.5,
          east: 32.0,
          west: 30.0,
        };
        
        const start = performance.now();
        const filtered = testBoundingBoxFilter(plots, boundingBox);
        const duration = performance.now() - start;
        
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BOUNDING_BOX_FILTER_MS);
        expect(filtered.length).toBeLessThan(plots.length);
      });

      it('should return all plots for full Ukraine bounding box', () => {
        const boundingBox = {
          north: 53.0,
          south: 44.0,
          east: 41.0,
          west: 22.0,
        };
        
        const filtered = testBoundingBoxFilter(plots, boundingBox);
        expect(filtered.length).toBe(plots.length);
      });
    });

    describe('testPriceRangeFilter', () => {
      it('should filter 10k plots by price range within threshold', () => {
        const start = performance.now();
        const filtered = testPriceRangeFilter(plots, 1000000, 5000000);
        const duration = performance.now() - start;
        
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FILTER_10K_PLOTS_MS);
        expect(filtered.every(p => p.totalPrice >= 1000000 && p.totalPrice <= 5000000)).toBe(true);
      });
    });

    describe('testCombinedFilters', () => {
      it('should apply combined filters within threshold', () => {
        const start = performance.now();
        const filtered = testCombinedFilters(plots, {
          boundingBox: { north: 51.0, south: 49.0, east: 33.0, west: 29.0 },
          minPrice: 500000,
          maxPrice: 10000000,
          oblast: 'Київська',
        });
        const duration = performance.now() - start;
        
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.COMBINED_FILTER_MS);
      });

      it('should filter by category', () => {
        const filtered = testCombinedFilters(plots, {
          category: 'agricultural',
        });
        
        expect(filtered.every(p => p.category === 'agricultural')).toBe(true);
        expect(filtered.length).toBeGreaterThan(0);
      });
    });

    describe('estimateMemoryUsage', () => {
      it('should estimate memory usage for 10k plots', () => {
        const memoryBytes = estimateMemoryUsage(plots);
        const memoryMB = memoryBytes / (1024 * 1024);
        
        expect(memoryMB).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_LIMIT_MB);
      });
    });
  });
});
