import {
  encodeGeohash,
  decodeGeohash,
  getGeohashPrecisionForRadius,
  getGeohashesForBoundingBox,
  getNeighborGeohashes,
} from '../../src/utils/geohash';

describe('Geohash Utilities', () => {
  describe('encodeGeohash', () => {
    it('should encode Kyiv coordinates correctly', () => {
      const hash = encodeGeohash(50.4501, 30.5234, 6);
      expect(hash.length).toBe(6);
      expect(hash.startsWith('u8')).toBe(true);
    });

    it('should encode Lviv coordinates correctly', () => {
      const hash = encodeGeohash(49.8397, 24.0297, 6);
      expect(hash.length).toBe(6);
      expect(hash.startsWith('u8')).toBe(true);
    });

    it('should handle different precisions', () => {
      const hash3 = encodeGeohash(50.4501, 30.5234, 3);
      const hash6 = encodeGeohash(50.4501, 30.5234, 6);
      const hash9 = encodeGeohash(50.4501, 30.5234, 9);
      
      expect(hash3.length).toBe(3);
      expect(hash6.length).toBe(6);
      expect(hash9.length).toBe(9);
      expect(hash6.startsWith(hash3)).toBe(true);
      expect(hash9.startsWith(hash6)).toBe(true);
    });

    it('should handle edge coordinates', () => {
      expect(() => encodeGeohash(90, 180, 5)).not.toThrow();
      expect(() => encodeGeohash(-90, -180, 5)).not.toThrow();
      expect(() => encodeGeohash(0, 0, 5)).not.toThrow();
    });
  });

  describe('decodeGeohash', () => {
    it('should decode geohash back to approximate coordinates', () => {
      const original = { latitude: 50.4501, longitude: 30.5234 };
      const hash = encodeGeohash(original.latitude, original.longitude, 9);
      const decoded = decodeGeohash(hash);
      
      expect(Math.abs(decoded.latitude - original.latitude)).toBeLessThan(0.001);
      expect(Math.abs(decoded.longitude - original.longitude)).toBeLessThan(0.001);
    });

    it('should handle short geohashes with less precision', () => {
      const hash = 'u8v';
      const decoded = decodeGeohash(hash);
      
      expect(decoded.latitude).toBeGreaterThan(45);
      expect(decoded.latitude).toBeLessThan(55);
      expect(decoded.longitude).toBeGreaterThan(25);
      expect(decoded.longitude).toBeLessThan(35);
    });
  });

  describe('getGeohashPrecisionForRadius', () => {
    it('should return correct precision for various radii', () => {
      expect(getGeohashPrecisionForRadius(0.01)).toBe(9);
      expect(getGeohashPrecisionForRadius(0.05)).toBe(8);
      expect(getGeohashPrecisionForRadius(0.5)).toBe(7);
      expect(getGeohashPrecisionForRadius(2)).toBe(6);
      expect(getGeohashPrecisionForRadius(10)).toBe(5);
      expect(getGeohashPrecisionForRadius(50)).toBe(4);
      expect(getGeohashPrecisionForRadius(500)).toBe(3);
      expect(getGeohashPrecisionForRadius(2000)).toBe(2);
      expect(getGeohashPrecisionForRadius(5000)).toBe(1);
    });
  });

  describe('getGeohashesForBoundingBox', () => {
    it('should return geohashes covering a bounding box', () => {
      const geohashes = getGeohashesForBoundingBox(
        50.5, // north
        50.4, // south
        30.6, // east
        30.5, // west
        5
      );
      
      expect(geohashes.length).toBeGreaterThan(0);
      expect(geohashes.every(h => h.length === 5)).toBe(true);
    });

    it('should include corner geohashes', () => {
      const geohashes = getGeohashesForBoundingBox(51, 50, 31, 30, 4);
      
      expect(geohashes.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('getNeighborGeohashes', () => {
    it('should return the original geohash and neighbors', () => {
      const neighbors = getNeighborGeohashes('u8vxn');
      
      expect(neighbors).toContain('u8vxn');
      expect(neighbors.length).toBeGreaterThan(1);
    });

    it('should return unique geohashes', () => {
      const neighbors = getNeighborGeohashes('u8vxn');
      const uniqueNeighbors = [...new Set(neighbors)];
      
      expect(neighbors.length).toBe(uniqueNeighbors.length);
    });
  });
});
