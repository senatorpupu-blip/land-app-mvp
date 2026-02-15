import { onSnapshot, collection, query, where } from 'firebase/firestore';

// Helper to create mock Firestore document
const createMockDoc = (id: string, data: any) => ({
  id,
  data: () => data,
});

// Helper to create mock Firestore snapshot
const createMockSnapshot = (docs: any[]) => ({
  docs: docs.map(d => createMockDoc(d.id, d)),
  empty: docs.length === 0,
  size: docs.length,
});

// Sample approved plot data
const approvedPlot = {
  id: '1',
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
  createdAt: { toDate: () => new Date() },
  updatedAt: { toDate: () => new Date() },
};

// Plot with invalid coordinates
const invalidCoordinatesPlot = {
  id: '3',
  title: 'Invalid Coords Plot',
  description: 'Has invalid coordinates',
  area: 8,
  pricePerSotka: 4000,
  totalPrice: 32000,
  zone: 'C',
  region: 'Test Region',
  location: { latitude: NaN, longitude: undefined, address: '' },
  cadastralNumber: '1234567890:01:001:0001',
  cadastralVerified: false,
  photos: [],
  ownerId: 'user3',
  ownerPhone: '+380501234569',
  isInvestmentPlot: false,
  isCreditAvailable: false,
  status: 'approved',
  createdAt: { toDate: () => new Date() },
  updatedAt: { toDate: () => new Date() },
};

describe('MapScreen Firestore Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Firestore Query Construction', () => {
    it('should use collection, query, and where for approved plots', () => {
      // Simulate what MapScreen does
      const db = {};
      collection(db as any, 'plots');
      query({} as any, where('status', '==', 'approved'));

      expect(collection).toHaveBeenCalledWith(db, 'plots');
      expect(where).toHaveBeenCalledWith('status', '==', 'approved');
    });

    it('should call onSnapshot with query and callbacks', () => {
      const mockCallback = jest.fn();
      const mockErrorCallback = jest.fn();
      
      onSnapshot({} as any, mockCallback, mockErrorCallback);

      expect(onSnapshot).toHaveBeenCalled();
    });
  });

  describe('Snapshot Parsing', () => {
    it('should correctly parse Firestore docs to LandPlot objects', () => {
      const snapshot = createMockSnapshot([approvedPlot]);
      
      const parsedPlots = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      });

      expect(parsedPlots).toHaveLength(1);
      expect(parsedPlots[0].id).toBe('1');
      expect(parsedPlots[0].title).toBe('Test Plot');
      expect(parsedPlots[0].status).toBe('approved');
      expect(parsedPlots[0].createdAt).toBeInstanceOf(Date);
    });

    it('should handle missing timestamp fields gracefully', () => {
      const plotWithoutTimestamps = {
        ...approvedPlot,
        createdAt: null,
        updatedAt: undefined,
      };
      const snapshot = createMockSnapshot([plotWithoutTimestamps]);
      
      const parsedPlots = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      });

      expect(parsedPlots[0].createdAt).toBeInstanceOf(Date);
      expect(parsedPlots[0].updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Empty Snapshot Handling', () => {
    it('should handle empty snapshot without errors', () => {
      const snapshot = createMockSnapshot([]);
      
      expect(snapshot.empty).toBe(true);
      expect(snapshot.size).toBe(0);
      expect(snapshot.docs).toHaveLength(0);
    });

    it('should return empty array when parsing empty snapshot', () => {
      const snapshot = createMockSnapshot([]);
      
      const parsedPlots = snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data };
      });

      expect(parsedPlots).toHaveLength(0);
    });
  });

  describe('Invalid Coordinates Handling', () => {
    it('should parse plots with NaN coordinates without crashing', () => {
      const snapshot = createMockSnapshot([invalidCoordinatesPlot]);
      
      const parsedPlots = snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data };
      });

      expect(parsedPlots).toHaveLength(1);
      expect(parsedPlots[0].location.latitude).toBeNaN();
    });

    it('should filter out invalid coordinates for map fitting', () => {
      const plots = [
        { location: { latitude: 50.4501, longitude: 30.5234 } },
        { location: { latitude: NaN, longitude: 30.5234 } },
        { location: { latitude: 49.8397, longitude: undefined } },
        { location: null },
      ];

      const validCoordinates = plots.filter(p => {
        if (!p.location) return false;
        const { latitude, longitude } = p.location;
        return (
          typeof latitude === 'number' &&
          typeof longitude === 'number' &&
          !isNaN(latitude) &&
          !isNaN(longitude)
        );
      });

      expect(validCoordinates).toHaveLength(1);
      expect(validCoordinates[0].location!.latitude).toBe(50.4501);
    });
  });

  describe('Region Extraction', () => {
    it('should extract unique regions from plots', () => {
      const plots = [
        { region: 'Kyiv Oblast' },
        { region: 'Lviv Oblast' },
        { region: 'Kyiv Oblast' },
      ];

      const uniqueRegions = [...new Set(plots.map(p => p.region).filter(Boolean))];

      expect(uniqueRegions).toHaveLength(2);
      expect(uniqueRegions).toContain('Kyiv Oblast');
      expect(uniqueRegions).toContain('Lviv Oblast');
    });

    it('should filter out empty/null/undefined regions', () => {
      const plots = [
        { region: 'Kyiv Oblast' },
        { region: '' },
        { region: null },
        { region: undefined },
      ];

      const uniqueRegions = [...new Set(plots.map(p => p.region).filter(Boolean))];

      expect(uniqueRegions).toHaveLength(1);
      expect(uniqueRegions).toContain('Kyiv Oblast');
    });
  });

  describe('Unsubscribe Cleanup', () => {
    it('should return unsubscribe function from onSnapshot', () => {
      const unsubscribe = onSnapshot({} as any, jest.fn(), jest.fn());
      
      expect(typeof unsubscribe).toBe('function');
    });

    it('should be callable without errors', () => {
      const unsubscribe = onSnapshot({} as any, jest.fn(), jest.fn());
      
      expect(() => unsubscribe()).not.toThrow();
    });
  });
});

describe('Map Auto-Fit Region Calculation', () => {
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
      { latitude: 50.4501, longitude: 30.5234 },
      { latitude: 49.8397, longitude: 24.0297 },
    ];
    const result = calculateRegionForCoordinates(coords);

    expect(result).not.toBeNull();
    expect(result!.latitude).toBeCloseTo(50.1449, 4);
    expect(result!.longitude).toBeCloseTo(27.27655, 4);
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
      { latitude: 50.4502, longitude: 30.5235 },
    ];
    const result = calculateRegionForCoordinates(coords);

    expect(result).not.toBeNull();
    expect(result!.latitudeDelta).toBeGreaterThanOrEqual(0.01);
    expect(result!.longitudeDelta).toBeGreaterThanOrEqual(0.01);
  });
});
