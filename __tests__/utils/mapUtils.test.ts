describe('Map Utility Functions', () => {
  describe('calculateRegionForCoordinates', () => {
    const calculateRegionForCoordinates = (coordinates: { latitude: number; longitude: number }[]) => {
      if (coordinates.length === 0) {
        return null;
      }

      const latitudes = coordinates.map(c => c.latitude).filter(l => !isNaN(l) && l !== undefined);
      const longitudes = coordinates.map(c => c.longitude).filter(l => !isNaN(l) && l !== undefined);

      if (latitudes.length === 0 || longitudes.length === 0) {
        return null;
      }

      const minLat = Math.min(...latitudes);
      const maxLat = Math.max(...latitudes);
      const minLng = Math.min(...longitudes);
      const maxLng = Math.max(...longitudes);

      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;

      const latDelta = Math.max((maxLat - minLat) * 1.5, 0.01);
      const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.01);

      return {
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
      };
    };

    it('should return null for empty coordinates array', () => {
      const result = calculateRegionForCoordinates([]);
      expect(result).toBeNull();
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
        { latitude: 50.4501, longitude: 30.5234 }, // Kyiv
        { latitude: 49.8397, longitude: 24.0297 }, // Lviv
      ];
      const result = calculateRegionForCoordinates(coords);

      expect(result).not.toBeNull();
      expect(result!.latitude).toBeCloseTo(50.1449, 4);
      expect(result!.longitude).toBeCloseTo(27.27655, 4);
    });

    it('should calculate appropriate delta for spread coordinates', () => {
      const coords = [
        { latitude: 50.4501, longitude: 30.5234 }, // Kyiv
        { latitude: 46.4825, longitude: 30.7233 }, // Odesa
      ];
      const result = calculateRegionForCoordinates(coords);

      expect(result).not.toBeNull();
      expect(result!.latitudeDelta).toBeGreaterThan(0);
      expect(result!.longitudeDelta).toBeGreaterThan(0);
    });

    it('should handle coordinates with NaN values', () => {
      const coords = [
        { latitude: 50.4501, longitude: 30.5234 },
        { latitude: NaN, longitude: NaN },
      ];
      const result = calculateRegionForCoordinates(coords);

      expect(result).not.toBeNull();
      expect(result!.latitude).toBe(50.4501);
      expect(result!.longitude).toBe(30.5234);
    });

    it('should return null when all coordinates are invalid', () => {
      const coords = [
        { latitude: NaN, longitude: NaN },
        { latitude: undefined as any, longitude: undefined as any },
      ];
      const result = calculateRegionForCoordinates(coords);

      expect(result).toBeNull();
    });

    it('should ensure minimum delta values', () => {
      const coords = [
        { latitude: 50.4501, longitude: 30.5234 },
        { latitude: 50.4502, longitude: 30.5235 }, // Very close
      ];
      const result = calculateRegionForCoordinates(coords);

      expect(result).not.toBeNull();
      expect(result!.latitudeDelta).toBeGreaterThanOrEqual(0.01);
      expect(result!.longitudeDelta).toBeGreaterThanOrEqual(0.01);
    });
  });

  describe('filterValidCoordinates', () => {
    const filterValidCoordinates = (plots: any[]) => {
      return plots.filter(plot => {
        if (!plot.location) return false;
        const { latitude, longitude } = plot.location;
        return (
          typeof latitude === 'number' &&
          typeof longitude === 'number' &&
          !isNaN(latitude) &&
          !isNaN(longitude) &&
          latitude >= -90 &&
          latitude <= 90 &&
          longitude >= -180 &&
          longitude <= 180
        );
      });
    };

    it('should filter out plots with null location', () => {
      const plots = [
        { id: '1', location: { latitude: 50.4501, longitude: 30.5234 } },
        { id: '2', location: null },
      ];
      const result = filterValidCoordinates(plots);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should filter out plots with undefined coordinates', () => {
      const plots = [
        { id: '1', location: { latitude: 50.4501, longitude: 30.5234 } },
        { id: '2', location: { latitude: undefined, longitude: undefined } },
      ];
      const result = filterValidCoordinates(plots);

      expect(result).toHaveLength(1);
    });

    it('should filter out plots with NaN coordinates', () => {
      const plots = [
        { id: '1', location: { latitude: 50.4501, longitude: 30.5234 } },
        { id: '2', location: { latitude: NaN, longitude: 30.5234 } },
      ];
      const result = filterValidCoordinates(plots);

      expect(result).toHaveLength(1);
    });

    it('should filter out plots with out-of-range latitude', () => {
      const plots = [
        { id: '1', location: { latitude: 50.4501, longitude: 30.5234 } },
        { id: '2', location: { latitude: 91, longitude: 30.5234 } },
        { id: '3', location: { latitude: -91, longitude: 30.5234 } },
      ];
      const result = filterValidCoordinates(plots);

      expect(result).toHaveLength(1);
    });

    it('should filter out plots with out-of-range longitude', () => {
      const plots = [
        { id: '1', location: { latitude: 50.4501, longitude: 30.5234 } },
        { id: '2', location: { latitude: 50.4501, longitude: 181 } },
        { id: '3', location: { latitude: 50.4501, longitude: -181 } },
      ];
      const result = filterValidCoordinates(plots);

      expect(result).toHaveLength(1);
    });

    it('should keep all valid plots', () => {
      const plots = [
        { id: '1', location: { latitude: 50.4501, longitude: 30.5234 } },
        { id: '2', location: { latitude: 49.8397, longitude: 24.0297 } },
        { id: '3', location: { latitude: 46.4825, longitude: 30.7233 } },
      ];
      const result = filterValidCoordinates(plots);

      expect(result).toHaveLength(3);
    });

    it('should handle empty array', () => {
      const result = filterValidCoordinates([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('extractUniqueRegions', () => {
    const extractUniqueRegions = (plots: any[]) => {
      return [...new Set(plots.map(p => p.region).filter(Boolean))];
    };

    it('should extract unique regions', () => {
      const plots = [
        { region: 'Kyiv Oblast' },
        { region: 'Lviv Oblast' },
        { region: 'Kyiv Oblast' },
      ];
      const result = extractUniqueRegions(plots);

      expect(result).toHaveLength(2);
      expect(result).toContain('Kyiv Oblast');
      expect(result).toContain('Lviv Oblast');
    });

    it('should filter out empty regions', () => {
      const plots = [
        { region: 'Kyiv Oblast' },
        { region: '' },
        { region: null },
        { region: undefined },
      ];
      const result = extractUniqueRegions(plots);

      expect(result).toHaveLength(1);
      expect(result).toContain('Kyiv Oblast');
    });

    it('should return empty array for empty plots', () => {
      const result = extractUniqueRegions([]);
      expect(result).toHaveLength(0);
    });
  });
});
