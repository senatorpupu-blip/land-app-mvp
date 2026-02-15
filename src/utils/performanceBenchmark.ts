/**
 * Performance benchmarking utilities for testing with large datasets
 * Used to validate system performance at scale (10k+ listings)
 */

import { LandPlot, LandCategory } from '../types';

/**
 * Generate mock plot data for performance testing
 * Creates realistic Ukrainian land plot data
 */
export const generateMockPlot = (index: number): LandPlot => {
  const oblasts = [
    'Київська', 'Львівська', 'Одеська', 'Харківська', 'Дніпропетровська',
    'Запорізька', 'Вінницька', 'Полтавська', 'Черкаська', 'Житомирська'
  ];
  const categories: LandCategory[] = ['agricultural', 'residential', 'commercial', 'industrial', 'recreational'];
  const zones = ['A', 'B', 'C'] as const;
  
  // Generate coordinates within Ukraine bounds
  const latitude = 44.3 + Math.random() * 8; // 44.3 to 52.3
  const longitude = 22.1 + Math.random() * 18; // 22.1 to 40.1
  
  const area = Math.floor(10 + Math.random() * 990); // 10-1000 sotkas
  const pricePerSotka = Math.floor(1000 + Math.random() * 49000); // 1000-50000 UAH
  
  return {
    id: `mock-plot-${index}`,
    title: `Земельна ділянка ${index}`,
    description: `Тестова ділянка для перевірки продуктивності #${index}`,
    area,
    pricePerSotka,
    totalPrice: area * pricePerSotka,
    zone: zones[index % 3],
    region: `Район ${index % 25}`,
    oblast: oblasts[index % oblasts.length],
    category: categories[index % categories.length],
    location: {
      latitude,
      longitude,
      address: `вул. Тестова, ${index}`,
    },
    cadastralNumber: `${String(index).padStart(10, '0')}:01:001:${String(index % 10000).padStart(4, '0')}`,
    cadastralVerified: index % 2 === 0,
    photos: [],
    ownerId: `owner-${index % 100}`,
    ownerPhone: `+38050${String(index).padStart(7, '0')}`,
    isInvestmentPlot: index % 5 === 0,
    isCreditAvailable: index % 3 === 0,
    status: 'approved',
    createdAt: new Date(Date.now() - index * 60000),
    updatedAt: new Date(Date.now() - index * 30000),
  };
};

/**
 * Generate a batch of mock plots for testing
 */
export const generateMockPlots = (count: number): LandPlot[] => {
  const plots: LandPlot[] = [];
  for (let i = 0; i < count; i++) {
    plots.push(generateMockPlot(i));
  }
  return plots;
};

/**
 * Benchmark function execution time
 */
export const benchmark = async <T>(
  name: string,
  fn: () => Promise<T> | T
): Promise<{ result: T; durationMs: number }> => {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  return { result, durationMs };
};

/**
 * Run multiple iterations and return average time
 */
export const benchmarkAverage = async <T>(
  name: string,
  fn: () => Promise<T> | T,
  iterations: number = 5
): Promise<{ avgMs: number; minMs: number; maxMs: number }> => {
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const { durationMs } = await benchmark(name, fn);
    times.push(durationMs);
  }
  
  return {
    avgMs: times.reduce((a, b) => a + b, 0) / times.length,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
  };
};

/**
 * Bounding box filter performance test
 * Tests filtering 10k plots by bounding box
 */
export const testBoundingBoxFilter = (
  plots: LandPlot[],
  boundingBox: { north: number; south: number; east: number; west: number }
): LandPlot[] => {
  return plots.filter(plot => {
    const { latitude, longitude } = plot.location;
    return (
      latitude >= boundingBox.south &&
      latitude <= boundingBox.north &&
      longitude >= boundingBox.west &&
      longitude <= boundingBox.east
    );
  });
};

/**
 * Price range filter performance test
 */
export const testPriceRangeFilter = (
  plots: LandPlot[],
  minPrice: number,
  maxPrice: number
): LandPlot[] => {
  return plots.filter(plot => 
    plot.totalPrice >= minPrice && plot.totalPrice <= maxPrice
  );
};

/**
 * Combined filter performance test
 */
export const testCombinedFilters = (
  plots: LandPlot[],
  filters: {
    boundingBox?: { north: number; south: number; east: number; west: number };
    minPrice?: number;
    maxPrice?: number;
    oblast?: string;
    category?: LandCategory;
  }
): LandPlot[] => {
  let result = plots;
  
  if (filters.boundingBox) {
    const { north, south, east, west } = filters.boundingBox;
    result = result.filter(plot => {
      const { latitude, longitude } = plot.location;
      return latitude >= south && latitude <= north && longitude >= west && longitude <= east;
    });
  }
  
  if (filters.minPrice !== undefined) {
    result = result.filter(plot => plot.totalPrice >= filters.minPrice!);
  }
  
  if (filters.maxPrice !== undefined) {
    result = result.filter(plot => plot.totalPrice <= filters.maxPrice!);
  }
  
  if (filters.oblast) {
    result = result.filter(plot => plot.oblast === filters.oblast);
  }
  
  if (filters.category) {
    result = result.filter(plot => plot.category === filters.category);
  }
  
  return result;
};

/**
 * Memory usage estimation for plot array
 */
export const estimateMemoryUsage = (plots: LandPlot[]): number => {
  // Rough estimate: ~500 bytes per plot object
  return plots.length * 500;
};

/**
 * Performance thresholds for acceptable response times
 */
export const PERFORMANCE_THRESHOLDS = {
  FILTER_10K_PLOTS_MS: 50, // Should filter 10k plots in under 50ms
  BOUNDING_BOX_FILTER_MS: 30, // Bounding box filter under 30ms
  COMBINED_FILTER_MS: 100, // Combined filters under 100ms
  MEMORY_LIMIT_MB: 50, // Max memory for 10k plots
};
