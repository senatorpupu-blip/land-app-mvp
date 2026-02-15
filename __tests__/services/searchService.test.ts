import { SearchFilters, LandPlot, SearchResult } from '../../src/types';

const mockPlot: LandPlot = {
  id: 'test-plot-1',
  title: 'Test Plot',
  description: 'A test plot',
  area: 100,
  pricePerSotka: 1000,
  totalPrice: 100000,
  zone: 'A',
  region: 'Kyiv',
  oblast: 'kyiv',
  category: 'agricultural',
  location: {
    latitude: 50.4501,
    longitude: 30.5234,
    address: 'Test Address',
    geohash: 'u8vxn8',
  },
  cadastralNumber: '1234567890:01:001:0001',
  cadastralVerified: true,
  photos: [],
  ownerId: 'user-1',
  ownerPhone: '+380501234567',
  isInvestmentPlot: false,
  isCreditAvailable: false,
  status: 'approved',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Search Service Types', () => {
  describe('SearchFilters', () => {
    it('should accept valid filter combinations', () => {
      const filters: SearchFilters = {
        oblast: 'kyiv',
        category: 'agricultural',
        minPrice: 50000,
        maxPrice: 200000,
        minArea: 50,
        maxArea: 500,
      };
      
      expect(filters.oblast).toBe('kyiv');
      expect(filters.category).toBe('agricultural');
      expect(filters.minPrice).toBe(50000);
      expect(filters.maxPrice).toBe(200000);
    });

    it('should accept bounding box filter', () => {
      const filters: SearchFilters = {
        boundingBox: {
          north: 51,
          south: 50,
          east: 31,
          west: 30,
        },
      };
      
      expect(filters.boundingBox?.north).toBe(51);
      expect(filters.boundingBox?.south).toBe(50);
    });

    it('should accept investment score filter', () => {
      const filters: SearchFilters = {
        minInvestmentScore: 70,
        isInvestmentPlot: true,
      };
      
      expect(filters.minInvestmentScore).toBe(70);
      expect(filters.isInvestmentPlot).toBe(true);
    });

    it('should accept premium filters', () => {
      const filters: SearchFilters = {
        isPremium: true,
        isPromoted: true,
      };
      
      expect(filters.isPremium).toBe(true);
      expect(filters.isPromoted).toBe(true);
    });
  });

  describe('SearchResult', () => {
    it('should have correct structure', () => {
      const result: SearchResult = {
        plots: [mockPlot],
        totalCount: 1,
        hasMore: false,
        nextCursor: undefined,
      };
      
      expect(result.plots.length).toBe(1);
      expect(result.totalCount).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should support pagination', () => {
      const result: SearchResult = {
        plots: [mockPlot],
        totalCount: 100,
        hasMore: true,
        nextCursor: 'cursor-abc123',
      };
      
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('cursor-abc123');
    });
  });
});

describe('Filter Application Logic', () => {
  const plots: LandPlot[] = [
    { ...mockPlot, id: '1', totalPrice: 50000, area: 50, oblast: 'kyiv' },
    { ...mockPlot, id: '2', totalPrice: 100000, area: 100, oblast: 'lviv' },
    { ...mockPlot, id: '3', totalPrice: 200000, area: 200, oblast: 'kyiv' },
  ];

  it('should filter by price range', () => {
    const filters: SearchFilters = { minPrice: 75000, maxPrice: 150000 };
    const filtered = plots.filter(p => {
      if (filters.minPrice && p.totalPrice < filters.minPrice) return false;
      if (filters.maxPrice && p.totalPrice > filters.maxPrice) return false;
      return true;
    });
    
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('2');
  });

  it('should filter by area range', () => {
    const filters: SearchFilters = { minArea: 75, maxArea: 150 };
    const filtered = plots.filter(p => {
      if (filters.minArea && p.area < filters.minArea) return false;
      if (filters.maxArea && p.area > filters.maxArea) return false;
      return true;
    });
    
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('2');
  });

  it('should filter by oblast', () => {
    const filters: SearchFilters = { oblast: 'kyiv' };
    const filtered = plots.filter(p => !filters.oblast || p.oblast === filters.oblast);
    
    expect(filtered.length).toBe(2);
  });

  it('should combine multiple filters', () => {
    const filters: SearchFilters = { 
      oblast: 'kyiv',
      minPrice: 100000,
    };
    const filtered = plots.filter(p => {
      if (filters.oblast && p.oblast !== filters.oblast) return false;
      if (filters.minPrice && p.totalPrice < filters.minPrice) return false;
      return true;
    });
    
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('3');
  });
});

describe('Bounding Box Filter', () => {
  const plotsWithLocation: LandPlot[] = [
    { ...mockPlot, id: '1', location: { ...mockPlot.location, latitude: 50.5, longitude: 30.5 } },
    { ...mockPlot, id: '2', location: { ...mockPlot.location, latitude: 49.8, longitude: 24.0 } },
    { ...mockPlot, id: '3', location: { ...mockPlot.location, latitude: 48.5, longitude: 35.0 } },
  ];

  it('should filter plots within bounding box', () => {
    const boundingBox = { north: 51, south: 50, east: 31, west: 30 };
    const filtered = plotsWithLocation.filter(p => {
      const lat = p.location.latitude;
      const lng = p.location.longitude;
      return lat >= boundingBox.south && lat <= boundingBox.north &&
             lng >= boundingBox.west && lng <= boundingBox.east;
    });
    
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('1');
  });

  it('should return empty for non-matching bounding box', () => {
    const boundingBox = { north: 40, south: 39, east: 20, west: 19 };
    const filtered = plotsWithLocation.filter(p => {
      const lat = p.location.latitude;
      const lng = p.location.longitude;
      return lat >= boundingBox.south && lat <= boundingBox.north &&
             lng >= boundingBox.west && lng <= boundingBox.east;
    });
    
    expect(filtered.length).toBe(0);
  });
});

describe('Premium Sorting', () => {
  const plotsWithPremium: LandPlot[] = [
    { ...mockPlot, id: '1', premium: undefined },
    { ...mockPlot, id: '2', premium: { isPremium: true, isPromoted: true, premiumExpiresAt: new Date(Date.now() + 86400000) } },
    { ...mockPlot, id: '3', premium: { isPremium: false, isPromoted: false } },
  ];

  it('should sort promoted plots first', () => {
    const isPromotedAndActive = (plot: LandPlot): boolean => {
      if (!plot.premium?.isPromoted) return false;
      if (!plot.premium.promotedExpiresAt) return true;
      return new Date() < plot.premium.promotedExpiresAt;
    };

    const promoted = plotsWithPremium.filter(isPromotedAndActive);
    const regular = plotsWithPremium.filter(p => !isPromotedAndActive(p));
    const sorted = [...promoted, ...regular];
    
    expect(sorted[0].id).toBe('2');
    expect(sorted.length).toBe(3);
  });
});
