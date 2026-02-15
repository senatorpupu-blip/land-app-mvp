import {
  isValidCoordinate,
  validatePlotData,
  filterValidCoordinates,
  removeDuplicatePlots,
  calculateRegionForCoordinates,
  regionToBoundingBox,
  boundingBoxToRegion,
  isPointInBoundingBox,
  expandBoundingBox,
  calculateDistance,
  extractUniqueRegions,
  getPlotCoordinates,
  UKRAINE_CENTER,
  UKRAINE_BOUNDS,
} from '../../src/utils/mapUtils';
import { LandPlot } from '../../src/types';

const createMockPlot = (overrides: Partial<LandPlot> = {}): LandPlot => ({
  id: 'test-id',
  title: 'Test Plot',
  description: 'Test description',
  area: 10,
  pricePerSotka: 5000,
  totalPrice: 50000,
  zone: 'A',
  region: 'Kyiv Oblast',
  location: { latitude: 50.4501, longitude: 30.5234, address: 'Kyiv' },
  cadastralNumber: '3210900000:01:001:0001',
  cadastralVerified: true,
  photos: [],
  ownerId: 'user1',
  ownerPhone: '+380501234567',
  isInvestmentPlot: false,
  isCreditAvailable: false,
  status: 'approved',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('Map Utility Functions', () => {
  describe('isValidCoordinate', () => {
    it('should return true for valid coordinates', () => {
      expect(isValidCoordinate({ latitude: 50.4501, longitude: 30.5234 })).toBe(true);
      expect(isValidCoordinate({ latitude: 0, longitude: 0 })).toBe(true);
      expect(isValidCoordinate({ latitude: -90, longitude: -180 })).toBe(true);
      expect(isValidCoordinate({ latitude: 90, longitude: 180 })).toBe(true);
    });

    it('should return false for invalid coordinates', () => {
      expect(isValidCoordinate(null)).toBe(false);
      expect(isValidCoordinate(undefined)).toBe(false);
      expect(isValidCoordinate({ latitude: NaN, longitude: 30.5234 })).toBe(false);
      expect(isValidCoordinate({ latitude: 50.4501, longitude: NaN })).toBe(false);
      expect(isValidCoordinate({ latitude: 91, longitude: 30.5234 })).toBe(false);
      expect(isValidCoordinate({ latitude: -91, longitude: 30.5234 })).toBe(false);
      expect(isValidCoordinate({ latitude: 50.4501, longitude: 181 })).toBe(false);
      expect(isValidCoordinate({ latitude: 50.4501, longitude: -181 })).toBe(false);
    });
  });

  describe('validatePlotData', () => {
    it('should return true for valid plot data', () => {
      const data = {
        title: 'Test Plot',
        location: { latitude: 50.4501, longitude: 30.5234 },
        status: 'approved',
      };
      expect(validatePlotData(data)).toBe(true);
    });

    it('should return false for missing required fields', () => {
      expect(validatePlotData({})).toBe(false);
      expect(validatePlotData({ title: 'Test' })).toBe(false);
      expect(validatePlotData({ title: 'Test', location: null })).toBe(false);
    });

    it('should return false for invalid coordinates', () => {
      const data = {
        title: 'Test Plot',
        location: { latitude: NaN, longitude: 30.5234 },
        status: 'approved',
      };
      expect(validatePlotData(data)).toBe(false);
    });
  });

  describe('filterValidCoordinates', () => {
    it('should filter out plots with invalid coordinates', () => {
      const plots = [
        createMockPlot({ id: '1' }),
        createMockPlot({ id: '2', location: { latitude: NaN, longitude: 30.5234, address: '' } }),
        createMockPlot({ id: '3', location: { latitude: 50.4501, longitude: NaN, address: '' } }),
      ];
      const result = filterValidCoordinates(plots);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should handle empty array', () => {
      expect(filterValidCoordinates([])).toHaveLength(0);
    });
  });

  describe('removeDuplicatePlots', () => {
    it('should remove duplicate plots by id', () => {
      const plots = [
        createMockPlot({ id: '1' }),
        createMockPlot({ id: '2' }),
        createMockPlot({ id: '1' }),
      ];
      const result = removeDuplicatePlots(plots);
      expect(result).toHaveLength(2);
    });

    it('should preserve order', () => {
      const plots = [
        createMockPlot({ id: '1' }),
        createMockPlot({ id: '2' }),
        createMockPlot({ id: '1' }),
      ];
      const result = removeDuplicatePlots(plots);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
    });
  });

  describe('calculateRegionForCoordinates', () => {
    it('should return null for empty coordinates array', () => {
      expect(calculateRegionForCoordinates([])).toBeNull();
    });

    it('should calculate correct center for single coordinate', () => {
      const coords = [{ latitude: 50.4501, longitude: 30.5234 }];
      const result = calculateRegionForCoordinates(coords);
      expect(result).not.toBeNull();
      expect(result!.latitude).toBe(50.4501);
      expect(result!.longitude).toBe(30.5234);
    });

    it('should calculate correct center for multiple coordinates', () => {
      const coords = [
        { latitude: 50.4501, longitude: 30.5234 },
        { latitude: 49.8397, longitude: 24.0297 },
      ];
      const result = calculateRegionForCoordinates(coords);
      expect(result).not.toBeNull();
      expect(result!.latitude).toBeCloseTo(50.1449, 4);
      expect(result!.longitude).toBeCloseTo(27.27655, 4);
    });

    it('should ensure minimum delta values', () => {
      const coords = [
        { latitude: 50.4501, longitude: 30.5234 },
        { latitude: 50.4502, longitude: 30.5235 },
      ];
      const result = calculateRegionForCoordinates(coords);
      expect(result).not.toBeNull();
      expect(result!.latitudeDelta).toBeGreaterThanOrEqual(0.01);
      expect(result!.longitudeDelta).toBeGreaterThanOrEqual(0.01);
    });
  });

  describe('regionToBoundingBox', () => {
    it('should convert region to bounding box', () => {
      const region = {
        latitude: 50,
        longitude: 30,
        latitudeDelta: 2,
        longitudeDelta: 4,
      };
      const box = regionToBoundingBox(region);
      expect(box.north).toBe(51);
      expect(box.south).toBe(49);
      expect(box.east).toBe(32);
      expect(box.west).toBe(28);
    });
  });

  describe('boundingBoxToRegion', () => {
    it('should convert bounding box to region', () => {
      const box = { north: 51, south: 49, east: 32, west: 28 };
      const region = boundingBoxToRegion(box);
      expect(region.latitude).toBe(50);
      expect(region.longitude).toBe(30);
      expect(region.latitudeDelta).toBe(2);
      expect(region.longitudeDelta).toBe(4);
    });
  });

  describe('isPointInBoundingBox', () => {
    const box = { north: 51, south: 49, east: 32, west: 28 };

    it('should return true for point inside box', () => {
      expect(isPointInBoundingBox({ latitude: 50, longitude: 30 }, box)).toBe(true);
    });

    it('should return true for point on boundary', () => {
      expect(isPointInBoundingBox({ latitude: 51, longitude: 30 }, box)).toBe(true);
      expect(isPointInBoundingBox({ latitude: 50, longitude: 32 }, box)).toBe(true);
    });

    it('should return false for point outside box', () => {
      expect(isPointInBoundingBox({ latitude: 52, longitude: 30 }, box)).toBe(false);
      expect(isPointInBoundingBox({ latitude: 50, longitude: 33 }, box)).toBe(false);
    });
  });

  describe('expandBoundingBox', () => {
    it('should expand bounding box by factor', () => {
      const box = { north: 51, south: 49, east: 32, west: 28 };
      const expanded = expandBoundingBox(box, 2);
      expect(expanded.north).toBe(52);
      expect(expanded.south).toBe(48);
      expect(expanded.east).toBe(34);
      expect(expanded.west).toBe(26);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      const kyiv = { latitude: 50.4501, longitude: 30.5234 };
      const lviv = { latitude: 49.8397, longitude: 24.0297 };
      const distance = calculateDistance(kyiv, lviv);
      expect(distance).toBeGreaterThan(400);
      expect(distance).toBeLessThan(600);
    });

    it('should return 0 for same point', () => {
      const point = { latitude: 50.4501, longitude: 30.5234 };
      expect(calculateDistance(point, point)).toBe(0);
    });
  });

  describe('extractUniqueRegions', () => {
    it('should extract unique regions', () => {
      const plots = [
        createMockPlot({ region: 'Kyiv Oblast' }),
        createMockPlot({ region: 'Lviv Oblast' }),
        createMockPlot({ region: 'Kyiv Oblast' }),
      ];
      const result = extractUniqueRegions(plots);
      expect(result).toHaveLength(2);
      expect(result).toContain('Kyiv Oblast');
      expect(result).toContain('Lviv Oblast');
    });

    it('should filter out empty regions', () => {
      const plots = [
        createMockPlot({ region: 'Kyiv Oblast' }),
        createMockPlot({ region: '' }),
      ];
      const result = extractUniqueRegions(plots);
      expect(result).toHaveLength(1);
    });

    it('should sort regions alphabetically', () => {
      const plots = [
        createMockPlot({ region: 'Zaporizhzhia Oblast' }),
        createMockPlot({ region: 'Kyiv Oblast' }),
        createMockPlot({ region: 'Lviv Oblast' }),
      ];
      const result = extractUniqueRegions(plots);
      expect(result[0]).toBe('Kyiv Oblast');
      expect(result[1]).toBe('Lviv Oblast');
      expect(result[2]).toBe('Zaporizhzhia Oblast');
    });
  });

  describe('getPlotCoordinates', () => {
    it('should extract coordinates from plots', () => {
      const plots = [
        createMockPlot({ location: { latitude: 50.4501, longitude: 30.5234, address: '' } }),
        createMockPlot({ location: { latitude: 49.8397, longitude: 24.0297, address: '' } }),
      ];
      const coords = getPlotCoordinates(plots);
      expect(coords).toHaveLength(2);
      expect(coords[0]).toEqual({ latitude: 50.4501, longitude: 30.5234 });
    });

    it('should filter out invalid coordinates', () => {
      const plots = [
        createMockPlot({ location: { latitude: 50.4501, longitude: 30.5234, address: '' } }),
        createMockPlot({ location: { latitude: NaN, longitude: 30.5234, address: '' } }),
      ];
      const coords = getPlotCoordinates(plots);
      expect(coords).toHaveLength(1);
    });
  });

  describe('Constants', () => {
    it('should have valid UKRAINE_CENTER', () => {
      expect(UKRAINE_CENTER.latitude).toBeGreaterThan(44);
      expect(UKRAINE_CENTER.latitude).toBeLessThan(53);
      expect(UKRAINE_CENTER.longitude).toBeGreaterThan(22);
      expect(UKRAINE_CENTER.longitude).toBeLessThan(41);
    });

    it('should have valid UKRAINE_BOUNDS', () => {
      expect(UKRAINE_BOUNDS.north).toBeGreaterThan(UKRAINE_BOUNDS.south);
      expect(UKRAINE_BOUNDS.east).toBeGreaterThan(UKRAINE_BOUNDS.west);
    });
  });
});
