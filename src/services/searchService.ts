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

export const getAvailableOblasts = async (): Promise<string[]> => {
  const q = query(
    collection(db, PLOTS_COLLECTION),
    where('status', '==', 'approved'),
    orderBy('oblast')
  );
  
  const snapshot = await getDocs(q);
  const oblasts = new Set<string>();
  
  snapshot.docs.forEach(doc => {
    const oblast = doc.data().oblast;
    if (oblast) {
      oblasts.add(oblast);
    }
  });
  
  return Array.from(oblasts).sort();
};

export const getAvailableCategories = async (): Promise<LandCategory[]> => {
  const q = query(
    collection(db, PLOTS_COLLECTION),
    where('status', '==', 'approved'),
    orderBy('category')
  );
  
  const snapshot = await getDocs(q);
  const categories = new Set<LandCategory>();
  
  snapshot.docs.forEach(doc => {
    const category = doc.data().category as LandCategory;
    if (category) {
      categories.add(category);
    }
  });
  
  return Array.from(categories);
};

export const getPriceRange = async (): Promise<{ min: number; max: number }> => {
  const q = query(
    collection(db, PLOTS_COLLECTION),
    where('status', '==', 'approved')
  );
  
  const snapshot = await getDocs(q);
  let min = Infinity;
  let max = 0;
  
  snapshot.docs.forEach(doc => {
    const price = doc.data().totalPrice;
    if (price < min) min = price;
    if (price > max) max = price;
  });
  
  return { min: min === Infinity ? 0 : min, max };
};

export const getAreaRange = async (): Promise<{ min: number; max: number }> => {
  const q = query(
    collection(db, PLOTS_COLLECTION),
    where('status', '==', 'approved')
  );
  
  const snapshot = await getDocs(q);
  let min = Infinity;
  let max = 0;
  
  snapshot.docs.forEach(doc => {
    const area = doc.data().area;
    if (area < min) min = area;
    if (area > max) max = area;
  });
  
  return { min: min === Infinity ? 0 : min, max };
};
