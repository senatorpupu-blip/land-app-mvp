/**
 * Load Testing Simulation
 * 
 * This module provides utilities for simulating load testing scenarios
 * with 10k listings and 1k concurrent reads for production readiness.
 */

import { envLog } from '../config/environment';
import { LandPlot } from '../types';

// Load testing configuration
export const LOAD_TEST_CONFIG = {
  MAX_LISTINGS: 10000,
  MAX_CONCURRENT_READS: 1000,
  BATCH_SIZE: 100,
  TARGET_RESPONSE_TIME_MS: 200,
  MAX_RESPONSE_TIME_MS: 1000,
  MEMORY_LIMIT_MB: 100,
} as const;

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  FILTER_10K_PLOTS_MS: 50,
  BOUNDING_BOX_FILTER_MS: 30,
  COMBINED_FILTER_MS: 100,
  SORT_10K_PLOTS_MS: 50,
  PAGINATION_MS: 10,
  MEMORY_LIMIT_MB: 50,
} as const;

// Ukrainian oblasts for mock data
const OBLASTS = [
  'Київська', 'Львівська', 'Одеська', 'Харківська', 'Дніпропетровська',
  'Запорізька', 'Донецька', 'Вінницька', 'Полтавська', 'Черкаська',
  'Чернігівська', 'Житомирська', 'Сумська', 'Рівненська', 'Волинська',
  'Тернопільська', 'Івано-Франківська', 'Закарпатська', 'Хмельницька',
  'Кіровоградська', 'Миколаївська', 'Херсонська', 'Чернівецька', 'Луганська',
];

const CATEGORIES = ['agricultural', 'residential', 'commercial', 'industrial', 'recreational'];
const ZONES = ['urban_core', 'suburban_0_15', 'suburban_15_30', 'rural'];
const STATUSES = ['approved', 'pending', 'rejected'];

// Generate a single mock plot
export const generateMockPlot = (index: number): LandPlot => {
  const oblast = OBLASTS[index % OBLASTS.length];
  const category = CATEGORIES[index % CATEGORIES.length];
  const zone = ZONES[index % ZONES.length];
  const status = index % 10 === 0 ? 'pending' : 'approved'; // 10% pending

  // Generate coordinates within Ukraine bounds
  const latitude = 44.3 + Math.random() * 8; // 44.3 to 52.3
  const longitude = 22.1 + Math.random() * 18; // 22.1 to 40.1

  const area = 10 + Math.floor(Math.random() * 990); // 10-1000 sotkas
  const pricePerSotka = 1000 + Math.floor(Math.random() * 99000); // 1000-100000 UAH

  return {
    id: `mock-plot-${index}`,
    title: `Земельна ділянка ${index + 1} в ${oblast}`,
    description: `Чудова земельна ділянка площею ${area} соток у ${oblast} області.`,
    area,
    pricePerSotka,
    totalPrice: area * pricePerSotka,
    zone: zone as 'A' | 'B' | 'C',
    region: oblast,
    oblast,
    category: category as 'agricultural' | 'residential' | 'commercial' | 'industrial' | 'recreational',
    location: {
      latitude,
      longitude,
      address: `вул. Тестова ${index + 1}, ${oblast}`,
    },
    cadastralNumber: `${String(index).padStart(10, '0')}:01:001:${String(index % 10000).padStart(4, '0')}`,
    cadastralVerified: index % 3 === 0,
    photos: [`https://example.com/photo-${index}.jpg`],
    ownerId: `owner-${index % 100}`,
    ownerPhone: `+380${String(500000000 + index).slice(0, 9)}`,
    isInvestmentPlot: index % 5 === 0,
    isCreditAvailable: index % 4 === 0,
    status: status as 'approved' | 'pending' | 'rejected',
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
  };
};

// Generate multiple mock plots
export const generateMockPlots = (count: number): LandPlot[] => {
  const plots: LandPlot[] = [];
  for (let i = 0; i < count; i++) {
    plots.push(generateMockPlot(i));
  }
  return plots;
};

// Benchmark function execution
export interface BenchmarkResult {
  name: string;
  durationMs: number;
  itemsProcessed: number;
  itemsPerSecond: number;
  passed: boolean;
  threshold: number;
}

export const benchmark = async <T>(
  name: string,
  fn: () => T | Promise<T>,
  threshold: number
): Promise<{ result: T; benchmark: BenchmarkResult }> => {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;

  const itemsProcessed = Array.isArray(result) ? result.length : 1;
  const itemsPerSecond = itemsProcessed / (durationMs / 1000);

  const benchmarkResult: BenchmarkResult = {
    name,
    durationMs: Math.round(durationMs * 100) / 100,
    itemsProcessed,
    itemsPerSecond: Math.round(itemsPerSecond),
    passed: durationMs <= threshold,
    threshold,
  };

  if (!benchmarkResult.passed) {
    envLog.warn('Benchmark failed', benchmarkResult);
  } else {
    envLog.debug('Benchmark passed', benchmarkResult);
  }

  return { result, benchmark: benchmarkResult };
};

// Test bounding box filter performance
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

// Test price range filter performance
export const testPriceRangeFilter = (
  plots: LandPlot[],
  minPrice: number,
  maxPrice: number
): LandPlot[] => {
  return plots.filter(plot => 
    plot.totalPrice >= minPrice && plot.totalPrice <= maxPrice
  );
};

// Test combined filters performance
export const testCombinedFilters = (
  plots: LandPlot[],
  filters: {
    boundingBox?: { north: number; south: number; east: number; west: number };
    minPrice?: number;
    maxPrice?: number;
    oblast?: string;
    category?: string;
    status?: string;
  }
): LandPlot[] => {
  let result = plots;

  if (filters.boundingBox) {
    result = testBoundingBoxFilter(result, filters.boundingBox);
  }

  if (filters.minPrice !== undefined) {
    result = result.filter(p => p.totalPrice >= filters.minPrice!);
  }

  if (filters.maxPrice !== undefined) {
    result = result.filter(p => p.totalPrice <= filters.maxPrice!);
  }

  if (filters.oblast) {
    result = result.filter(p => p.oblast === filters.oblast);
  }

  if (filters.category) {
    result = result.filter(p => p.category === filters.category);
  }

  if (filters.status) {
    result = result.filter(p => p.status === filters.status);
  }

  return result;
};

// Test sorting performance
export const testSortingPerformance = (
  plots: LandPlot[],
  sortBy: 'price' | 'area' | 'createdAt'
): LandPlot[] => {
  const sorted = [...plots];

  switch (sortBy) {
    case 'price':
      sorted.sort((a, b) => a.totalPrice - b.totalPrice);
      break;
    case 'area':
      sorted.sort((a, b) => a.area - b.area);
      break;
    case 'createdAt':
      sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      break;
  }

  return sorted;
};

// Test pagination performance
export const testPaginationPerformance = (
  plots: LandPlot[],
  page: number,
  pageSize: number
): LandPlot[] => {
  const start = (page - 1) * pageSize;
  return plots.slice(start, start + pageSize);
};

// Estimate memory usage
export const estimateMemoryUsage = (plots: LandPlot[]): number => {
  // Rough estimate: ~2KB per plot object
  const bytesPerPlot = 2048;
  return plots.length * bytesPerPlot;
};

// Concurrent read simulation
export interface ConcurrentReadResult {
  totalReads: number;
  successfulReads: number;
  failedReads: number;
  averageResponseTimeMs: number;
  maxResponseTimeMs: number;
  minResponseTimeMs: number;
  throughputPerSecond: number;
}

export const simulateConcurrentReads = async (
  plots: LandPlot[],
  concurrentReads: number
): Promise<ConcurrentReadResult> => {
  const responseTimes: number[] = [];
  let successfulReads = 0;
  let failedReads = 0;

  const startTime = performance.now();

  // Simulate concurrent reads
  const readPromises = Array.from({ length: concurrentReads }, async (_, i) => {
    const readStart = performance.now();
    try {
      // Simulate a read operation
      const randomIndex = Math.floor(Math.random() * plots.length);
      const _plot = plots[randomIndex];
      
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
      
      const readEnd = performance.now();
      responseTimes.push(readEnd - readStart);
      successfulReads++;
    } catch {
      failedReads++;
    }
  });

  await Promise.all(readPromises);

  const totalTime = performance.now() - startTime;
  const averageResponseTimeMs = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

  return {
    totalReads: concurrentReads,
    successfulReads,
    failedReads,
    averageResponseTimeMs: Math.round(averageResponseTimeMs * 100) / 100,
    maxResponseTimeMs: Math.round(Math.max(...responseTimes) * 100) / 100,
    minResponseTimeMs: Math.round(Math.min(...responseTimes) * 100) / 100,
    throughputPerSecond: Math.round((successfulReads / totalTime) * 1000),
  };
};

// Full load test report
export interface LoadTestReport {
  timestamp: Date;
  configuration: typeof LOAD_TEST_CONFIG;
  results: {
    plotGeneration: BenchmarkResult;
    boundingBoxFilter: BenchmarkResult;
    priceRangeFilter: BenchmarkResult;
    combinedFilters: BenchmarkResult;
    sorting: BenchmarkResult;
    pagination: BenchmarkResult;
    memoryUsage: { bytes: number; mb: number; withinLimit: boolean };
    concurrentReads?: ConcurrentReadResult;
  };
  overallPassed: boolean;
  recommendations: string[];
}

export const runLoadTest = async (
  listingCount: number = LOAD_TEST_CONFIG.MAX_LISTINGS,
  concurrentReads: number = 100 // Reduced for simulation
): Promise<LoadTestReport> => {
  const recommendations: string[] = [];
  const results: LoadTestReport['results'] = {} as LoadTestReport['results'];

  // Generate plots
  const { result: plots, benchmark: genBenchmark } = await benchmark(
    'Plot Generation',
    () => generateMockPlots(listingCount),
    5000 // 5 seconds for 10k plots
  );
  results.plotGeneration = genBenchmark;

  // Bounding box filter
  const { benchmark: bbBenchmark } = await benchmark(
    'Bounding Box Filter',
    () => testBoundingBoxFilter(plots, { north: 50, south: 48, east: 32, west: 30 }),
    PERFORMANCE_THRESHOLDS.BOUNDING_BOX_FILTER_MS
  );
  results.boundingBoxFilter = bbBenchmark;

  // Price range filter
  const { benchmark: priceBenchmark } = await benchmark(
    'Price Range Filter',
    () => testPriceRangeFilter(plots, 1000000, 5000000),
    PERFORMANCE_THRESHOLDS.FILTER_10K_PLOTS_MS
  );
  results.priceRangeFilter = priceBenchmark;

  // Combined filters
  const { benchmark: combinedBenchmark } = await benchmark(
    'Combined Filters',
    () => testCombinedFilters(plots, {
      boundingBox: { north: 51, south: 49, east: 33, west: 29 },
      minPrice: 500000,
      maxPrice: 10000000,
      status: 'approved',
    }),
    PERFORMANCE_THRESHOLDS.COMBINED_FILTER_MS
  );
  results.combinedFilters = combinedBenchmark;

  // Sorting
  const { benchmark: sortBenchmark } = await benchmark(
    'Sorting',
    () => testSortingPerformance(plots, 'price'),
    PERFORMANCE_THRESHOLDS.SORT_10K_PLOTS_MS
  );
  results.sorting = sortBenchmark;

  // Pagination
  const { benchmark: pageBenchmark } = await benchmark(
    'Pagination',
    () => testPaginationPerformance(plots, 1, 20),
    PERFORMANCE_THRESHOLDS.PAGINATION_MS
  );
  results.pagination = pageBenchmark;

  // Memory usage
  const memoryBytes = estimateMemoryUsage(plots);
  const memoryMB = memoryBytes / (1024 * 1024);
  results.memoryUsage = {
    bytes: memoryBytes,
    mb: Math.round(memoryMB * 100) / 100,
    withinLimit: memoryMB <= PERFORMANCE_THRESHOLDS.MEMORY_LIMIT_MB,
  };

  // Concurrent reads (optional, can be slow)
  if (concurrentReads > 0) {
    results.concurrentReads = await simulateConcurrentReads(plots, concurrentReads);
  }

  // Generate recommendations
  if (!results.boundingBoxFilter.passed) {
    recommendations.push('Bounding box filter is slow. Consider using geohash indexing.');
  }
  if (!results.combinedFilters.passed) {
    recommendations.push('Combined filters are slow. Consider denormalizing data or adding composite indexes.');
  }
  if (!results.memoryUsage.withinLimit) {
    recommendations.push('Memory usage exceeds limit. Consider implementing pagination or lazy loading.');
  }
  if (results.concurrentReads && results.concurrentReads.failedReads > 0) {
    recommendations.push('Some concurrent reads failed. Review error handling and retry logic.');
  }

  const overallPassed = 
    results.boundingBoxFilter.passed &&
    results.priceRangeFilter.passed &&
    results.combinedFilters.passed &&
    results.sorting.passed &&
    results.pagination.passed &&
    results.memoryUsage.withinLimit;

  return {
    timestamp: new Date(),
    configuration: LOAD_TEST_CONFIG,
    results,
    overallPassed,
    recommendations,
  };
};
