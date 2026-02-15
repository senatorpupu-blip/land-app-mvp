import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  getDocs,
  QueryConstraint,
  DocumentSnapshot
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { LandPlot, SearchFilters, SearchResult, LandCategory, PricingZone } from '../types';

const PLOTS_COLLECTION = 'plots';
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export interface SearchRequest {
  filters: SearchFilters;
  pageSize?: number;
  cursor?: string;
  sortBy?: 'createdAt' | 'totalPrice' | 'pricePerSotka' | 'area' | 'investmentScore';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResponse {
  success: boolean;
  result?: SearchResult;
  error?: string;
}

const parseFirestorePlot = (doc: DocumentSnapshot): LandPlot => {
  const data = doc.data();
  if (!data) {
    throw new Error('Document data is undefined');
  }
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    approvedAt: data.approvedAt?.toDate(),
    rejectedAt: data.rejectedAt?.toDate(),
    deletedAt: data.deletedAt?.toDate(),
    intelligence: data.intelligence ? {
      ...data.intelligence,
      lastCalculatedAt: data.intelligence.lastCalculatedAt?.toDate() || new Date(),
    } : undefined,
    premium: data.premium ? {
      ...data.premium,
      premiumExpiresAt: data.premium.premiumExpiresAt?.toDate(),
      promotedExpiresAt: data.premium.promotedExpiresAt?.toDate(),
      premiumPurchasedAt: data.premium.premiumPurchasedAt?.toDate(),
    } : undefined,
  } as LandPlot;
};

const isPromotedAndActive = (plot: LandPlot): boolean => {
  if (!plot.premium?.isPromoted) return false;
  if (!plot.premium.promotedExpiresAt) return true;
  return new Date() < plot.premium.promotedExpiresAt;
};

const isPremiumAndActive = (plot: LandPlot): boolean => {
  if (!plot.premium?.isPremium) return false;
  if (!plot.premium.premiumExpiresAt) return true;
  return new Date() < plot.premium.premiumExpiresAt;
};

export const searchPlots = async (request: SearchRequest): Promise<SearchResult> => {
  const { filters, pageSize = DEFAULT_PAGE_SIZE, cursor, sortBy = 'createdAt', sortOrder = 'desc' } = request;
  const effectivePageSize = Math.min(pageSize, MAX_PAGE_SIZE);
  
  const constraints: QueryConstraint[] = [];
  
  constraints.push(where('status', '==', 'approved'));
  
  if (filters.oblast) {
    constraints.push(where('oblast', '==', filters.oblast));
  }
  
  if (filters.category) {
    constraints.push(where('category', '==', filters.category));
  }
  
  if (filters.zone) {
    constraints.push(where('zone', '==', filters.zone));
  }
  
  if (filters.pricingZone) {
    constraints.push(where('pricing.pricingZone', '==', filters.pricingZone));
  }
  
  if (filters.isInvestmentPlot !== undefined) {
    constraints.push(where('isInvestmentPlot', '==', filters.isInvestmentPlot));
  }
  
  if (filters.isCreditAvailable !== undefined) {
    constraints.push(where('isCreditAvailable', '==', filters.isCreditAvailable));
  }
  
  if (filters.isPremium !== undefined) {
    constraints.push(where('premium.isPremium', '==', filters.isPremium));
  }
  
  if (filters.isPromoted !== undefined) {
    constraints.push(where('premium.isPromoted', '==', filters.isPromoted));
  }
  
  const orderField = sortBy === 'investmentScore' ? 'createdAt' : sortBy;
  constraints.push(orderBy(orderField, sortOrder));
  
  const fetchSize = effectivePageSize + 1;
  constraints.push(limit(fetchSize));
  
  const q = query(collection(db, PLOTS_COLLECTION), ...constraints);
  
  const querySnapshot = await getDocs(q);
  
  let plots: LandPlot[] = querySnapshot.docs.map(parseFirestorePlot);
  
  if (filters.minPrice !== undefined) {
    plots = plots.filter(p => p.totalPrice >= filters.minPrice!);
  }
  if (filters.maxPrice !== undefined) {
    plots = plots.filter(p => p.totalPrice <= filters.maxPrice!);
  }
  if (filters.minPricePerSotka !== undefined) {
    plots = plots.filter(p => p.pricePerSotka >= filters.minPricePerSotka!);
  }
  if (filters.maxPricePerSotka !== undefined) {
    plots = plots.filter(p => p.pricePerSotka <= filters.maxPricePerSotka!);
  }
  if (filters.minArea !== undefined) {
    plots = plots.filter(p => p.area >= filters.minArea!);
  }
  if (filters.maxArea !== undefined) {
    plots = plots.filter(p => p.area <= filters.maxArea!);
  }
  if (filters.minInvestmentScore !== undefined) {
    plots = plots.filter(p => (p.intelligence?.investmentScore || 0) >= filters.minInvestmentScore!);
  }
  if (filters.region) {
    plots = plots.filter(p => p.region === filters.region);
  }
  if (filters.boundingBox) {
    const { north, south, east, west } = filters.boundingBox;
    plots = plots.filter(p => {
      const lat = p.location.latitude;
      const lng = p.location.longitude;
      return lat >= south && lat <= north && lng >= west && lng <= east;
    });
  }
  
  const promotedPlots = plots.filter(isPromotedAndActive);
  const regularPlots = plots.filter(p => !isPromotedAndActive(p));
  plots = [...promotedPlots, ...regularPlots];
  
  const hasMore = plots.length > effectivePageSize;
  if (hasMore) {
    plots = plots.slice(0, effectivePageSize);
  }
  
  const nextCursor = hasMore && plots.length > 0 
    ? plots[plots.length - 1].id 
    : undefined;
  
  return {
    plots,
    totalCount: plots.length,
    hasMore,
    nextCursor,
  };
};

export const searchPlotsServerSide = async (request: SearchRequest): Promise<SearchResult> => {
  try {
    const searchLandPlots = httpsCallable<SearchRequest, SearchResponse>(
      functions,
      'searchLandPlots'
    );
    
    const result = await searchLandPlots(request);
    
    if (!result.data.success || !result.data.result) {
      throw new Error(result.data.error || 'Search failed');
    }
    
    return result.data.result;
  } catch (error: any) {
    if (error.code) {
      throw new Error(error.message || 'Search failed');
    }
    throw error;
  }
};

export interface FilterOptions {
  oblasts: string[];
  categories: LandCategory[];
  priceRange: { min: number; max: number };
  areaRange: { min: number; max: number };
}

let cachedFilterOptions: FilterOptions | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export const getFilterOptions = async (): Promise<FilterOptions> => {
  const now = Date.now();
  if (cachedFilterOptions && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedFilterOptions;
  }
  
  const q = query(
    collection(db, PLOTS_COLLECTION),
    where('status', '==', 'approved'),
    limit(1000)
  );
  
  const snapshot = await getDocs(q);
  
  const oblasts = new Set<string>();
  const categories = new Set<LandCategory>();
  let minPrice = Infinity;
  let maxPrice = 0;
  let minArea = Infinity;
  let maxArea = 0;
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.oblast) oblasts.add(data.oblast);
    if (data.category) categories.add(data.category as LandCategory);
    if (data.totalPrice < minPrice) minPrice = data.totalPrice;
    if (data.totalPrice > maxPrice) maxPrice = data.totalPrice;
    if (data.area < minArea) minArea = data.area;
    if (data.area > maxArea) maxArea = data.area;
  });
  
  cachedFilterOptions = {
    oblasts: Array.from(oblasts).sort(),
    categories: Array.from(categories),
    priceRange: { min: minPrice === Infinity ? 0 : minPrice, max: maxPrice },
    areaRange: { min: minArea === Infinity ? 0 : minArea, max: maxArea },
  };
  cacheTimestamp = now;
  
  return cachedFilterOptions;
};

export const invalidateFilterOptionsCache = (): void => {
  cachedFilterOptions = null;
  cacheTimestamp = 0;
};

export const getAvailableOblasts = async (): Promise<string[]> => {
  const options = await getFilterOptions();
  return options.oblasts;
};

export const getAvailableCategories = async (): Promise<LandCategory[]> => {
  const options = await getFilterOptions();
  return options.categories;
};

export const getPriceRange = async (): Promise<{ min: number; max: number }> => {
  const options = await getFilterOptions();
  return options.priceRange;
};

export const getAreaRange = async (): Promise<{ min: number; max: number }> => {
  const options = await getFilterOptions();
  return options.areaRange;
};
