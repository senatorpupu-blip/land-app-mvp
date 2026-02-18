import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  getDocs,
  QueryDocumentSnapshot,
  DocumentData,
  Unsubscribe,
  QueryConstraint,
  enableNetwork,
  disableNetwork,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { LandPlot } from '../types';
import {
  validatePlotData,
  filterValidCoordinates,
  removeDuplicatePlots,
} from '../utils/mapUtils';
import { formatPriceUAH } from '../utils/currency';

const PLOTS_COLLECTION = 'plots';
const DEFAULT_PAGE_SIZE = 200;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapServiceFilters {
  zone?: string;
  region?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface MapServiceState {
  plots: LandPlot[];
  isLoading: boolean;
  isOffline: boolean;
  error: string | null;
  hasMore: boolean;
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  filters: MapServiceFilters;
}

export interface MapServiceCallbacks {
  onPlotsUpdate: (plots: LandPlot[]) => void;
  onLoadingChange: (isLoading: boolean) => void;
  onOfflineChange: (isOffline: boolean) => void;
  onError: (error: string | null) => void;
  onHasMoreChange: (hasMore: boolean) => void;
}

type FirestoreError = {
  code?: string;
  message?: string;
};

const isFirestoreError = (error: unknown): error is FirestoreError => {
  return typeof error === 'object' && error !== null;
};

const parseFirestoreDoc = (doc: QueryDocumentSnapshot<DocumentData>): LandPlot | null => {
  try {
    const data = doc.data();
    
    if (!validatePlotData(data)) {
      return null;
    }

    return {
      id: doc.id,
      title: data.title || '',
      description: data.description || '',
      area: data.area || 0,
      pricePerSotka: data.pricePerSotka || 0,
      totalPrice: data.totalPrice || 0,
      zone: data.zone || 'A',
      region: data.region || '',
      oblast: data.oblast,
      category: data.category,
      location: {
        latitude: data.location?.latitude || 0,
        longitude: data.location?.longitude || 0,
        address: data.location?.address || '',
      },
      cadastralNumber: data.cadastralNumber || '',
      cadastralVerified: data.cadastralVerified || false,
      cadastralValidationStatus: data.cadastralValidationStatus,
      photos: data.photos || [],
      ownerId: data.ownerId || '',
      ownerPhone: data.ownerPhone || '',
      isInvestmentPlot: data.isInvestmentPlot || false,
      isCreditAvailable: data.isCreditAvailable || false,
      status: data.status || 'pending',
      pricing: data.pricing,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  } catch {
    return null;
  }
};

const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

const isOfflineError = (error: unknown): boolean => {
  if (!isFirestoreError(error)) return false;
  const code = error.code || '';
  return (
    code === 'unavailable' ||
    code === 'failed-precondition' ||
    code.includes('offline') ||
    (error.message || '').toLowerCase().includes('offline')
  );
};

export class MapService {
  private unsubscribe: Unsubscribe | null = null;
  private callbacks: MapServiceCallbacks;
  private state: MapServiceState;
  private cachedPlots: LandPlot[] = [];
  private retryCount = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentBoundingBox: BoundingBox | null = null;

  constructor(callbacks: MapServiceCallbacks) {
    this.callbacks = callbacks;
    this.state = {
      plots: [],
      isLoading: true,
      isOffline: false,
      error: null,
      hasMore: true,
      lastDoc: null,
      filters: {},
    };
  }

  private updateState(updates: Partial<MapServiceState>): void {
    this.state = { ...this.state, ...updates };
    
    if ('plots' in updates) {
      this.callbacks.onPlotsUpdate(this.state.plots);
    }
    if ('isLoading' in updates) {
      this.callbacks.onLoadingChange(this.state.isLoading);
    }
    if ('isOffline' in updates) {
      this.callbacks.onOfflineChange(this.state.isOffline);
    }
    if ('error' in updates) {
      this.callbacks.onError(this.state.error);
    }
    if ('hasMore' in updates) {
      this.callbacks.onHasMoreChange(this.state.hasMore);
    }
  }

  private buildQuery(boundingBox?: BoundingBox): QueryConstraint[] {
    const constraints: QueryConstraint[] = [
      where('status', '==', 'approved'),
    ];

    // Add server-side filters for zone and region (Firestore AND filtering)
    if (this.state.filters.zone) {
      constraints.push(where('zone', '==', this.state.filters.zone));
    }
    if (this.state.filters.region) {
      constraints.push(where('region', '==', this.state.filters.region));
    }

    // Add ordering and pagination
    constraints.push(orderBy('createdAt', 'desc'));
    constraints.push(limit(DEFAULT_PAGE_SIZE));

    if (this.state.lastDoc) {
      constraints.push(startAfter(this.state.lastDoc));
    }

    return constraints;
  }

  // Apply client-side price filtering (Firestore doesn't support range queries with other filters efficiently)
  private applyPriceFilter(plots: LandPlot[]): LandPlot[] {
    const { minPrice, maxPrice } = this.state.filters;
    
    return plots.filter(plot => {
      if (minPrice !== undefined && plot.totalPrice < minPrice) {
        return false;
      }
      if (maxPrice !== undefined && plot.totalPrice > maxPrice) {
        return false;
      }
      return true;
    });
  }

  setFilters(filters: MapServiceFilters): void {
    const filtersChanged = JSON.stringify(this.state.filters) !== JSON.stringify(filters);
    
    if (filtersChanged) {
      this.updateState({ 
        filters, 
        lastDoc: null, // Reset pagination when filters change
        plots: [],
      });
      // Re-subscribe with new filters
      this.subscribeToPlots(this.currentBoundingBox || undefined);
    }
  }

  resetFilters(): void {
    this.setFilters({});
  }

  private filterByBoundingBox(plots: LandPlot[], boundingBox: BoundingBox): LandPlot[] {
    return plots.filter(plot => {
      const { latitude, longitude } = plot.location;
      return (
        latitude >= boundingBox.south &&
        latitude <= boundingBox.north &&
        longitude >= boundingBox.west &&
        longitude <= boundingBox.east
      );
    });
  }

  async subscribeToPlots(boundingBox?: BoundingBox): Promise<void> {
    this.cleanup();
    this.updateState({ isLoading: true, error: null });
    this.currentBoundingBox = boundingBox || null;

    const plotsRef = collection(db, PLOTS_COLLECTION);
    const constraints = this.buildQuery(boundingBox);
    const q = query(plotsRef, ...constraints);

    try {
      this.unsubscribe = onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snapshot) => {
          const isFromCache = snapshot.metadata.fromCache;
          
          if (isFromCache && this.state.plots.length === 0) {
            this.updateState({ isOffline: true });
          } else if (!isFromCache) {
            this.updateState({ isOffline: false });
            this.retryCount = 0;
          }

          let loadedPlots: LandPlot[] = [];
          
          snapshot.docs.forEach(doc => {
            const plot = parseFirestoreDoc(doc);
            if (plot) {
              loadedPlots.push(plot);
            }
          });

          loadedPlots = filterValidCoordinates(loadedPlots);
          loadedPlots = removeDuplicatePlots(loadedPlots);

          if (boundingBox) {
            loadedPlots = this.filterByBoundingBox(loadedPlots, boundingBox);
          }

          // Apply client-side price filtering
          loadedPlots = this.applyPriceFilter(loadedPlots);

          this.cachedPlots = loadedPlots;
          
          const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
          const hasMore = snapshot.docs.length === DEFAULT_PAGE_SIZE;

          this.updateState({
            plots: loadedPlots,
            isLoading: false,
            hasMore,
            lastDoc,
            error: null,
          });
        },
        async (error) => {
          await this.handleError(error, boundingBox);
        }
      );
    } catch (error) {
      await this.handleError(error, boundingBox);
    }
  }

  private async handleError(error: unknown, boundingBox?: BoundingBox): Promise<void> {
    const errorMessage = isFirestoreError(error) 
      ? error.message || 'Unknown error' 
      : 'Unknown error';

    if (isOfflineError(error)) {
      this.updateState({
        isOffline: true,
        isLoading: false,
        plots: this.cachedPlots,
        error: 'You are offline. Showing cached data.',
      });
      return;
    }

    if (this.retryCount < MAX_RETRIES) {
      this.retryCount++;
      await delay(RETRY_DELAY_MS * this.retryCount);
      await this.subscribeToPlots(boundingBox);
      return;
    }

    this.updateState({
      isLoading: false,
      error: `Failed to load plots: ${errorMessage}`,
      plots: this.cachedPlots,
    });
  }

  async loadMorePlots(): Promise<void> {
    if (!this.state.hasMore || this.state.isLoading) {
      return;
    }

    this.updateState({ isLoading: true });

    const plotsRef = collection(db, PLOTS_COLLECTION);
    const constraints = this.buildQuery(this.currentBoundingBox || undefined);
    const q = query(plotsRef, ...constraints);

    try {
      const snapshot = await getDocs(q);
      
      let newPlots: LandPlot[] = [];
      snapshot.docs.forEach(doc => {
        const plot = parseFirestoreDoc(doc);
        if (plot) {
          newPlots.push(plot);
        }
      });

      newPlots = filterValidCoordinates(newPlots);

      if (this.currentBoundingBox) {
        newPlots = this.filterByBoundingBox(newPlots, this.currentBoundingBox);
      }

      // Apply client-side price filtering
      newPlots = this.applyPriceFilter(newPlots);

      const allPlots = removeDuplicatePlots([...this.state.plots, ...newPlots]);
      const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
      const hasMore = snapshot.docs.length === DEFAULT_PAGE_SIZE;

      this.cachedPlots = allPlots;
      
      this.updateState({
        plots: allPlots,
        isLoading: false,
        hasMore,
        lastDoc,
      });
    } catch (error) {
      await this.handleError(error, this.currentBoundingBox || undefined);
    }
  }

  onRegionChange(boundingBox: BoundingBox, debounceMs = 400): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      const significantChange = this.isSignificantRegionChange(boundingBox);
      
      if (significantChange) {
        this.currentBoundingBox = boundingBox;
        this.updateState({ lastDoc: null });
        this.subscribeToPlots(boundingBox);
      } else {
        const filteredPlots = this.filterByBoundingBox(this.cachedPlots, boundingBox);
        this.updateState({ plots: filteredPlots });
      }
    }, debounceMs);
  }

  private isSignificantRegionChange(newBox: BoundingBox): boolean {
    if (!this.currentBoundingBox) {
      return true;
    }

    const threshold = 0.5;
    const latDiff = Math.abs(
      (newBox.north + newBox.south) / 2 - 
      (this.currentBoundingBox.north + this.currentBoundingBox.south) / 2
    );
    const lngDiff = Math.abs(
      (newBox.east + newBox.west) / 2 - 
      (this.currentBoundingBox.east + this.currentBoundingBox.west) / 2
    );

    const currentHeight = this.currentBoundingBox.north - this.currentBoundingBox.south;
    const newHeight = newBox.north - newBox.south;
    const zoomChange = Math.abs(newHeight - currentHeight) / currentHeight;

    return latDiff > threshold || lngDiff > threshold || zoomChange > 0.5;
  }

  async setOfflineMode(offline: boolean): Promise<void> {
    try {
      if (offline) {
        await disableNetwork(db);
      } else {
        await enableNetwork(db);
      }
      this.updateState({ isOffline: offline });
    } catch {
      // Silently fail - network state will be detected automatically
    }
  }

  getState(): MapServiceState {
    return { ...this.state };
  }

  getCachedPlots(): LandPlot[] {
    return [...this.cachedPlots];
  }

  cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

export const extractUniqueRegions = (plots: LandPlot[]): string[] => {
  const regions = plots
    .map(p => p.region)
    .filter((region): region is string => Boolean(region));
  return [...new Set(regions)];
};

export const getRequiredIndexes = (): string[] => {
  return [
    'Collection: plots - Fields: status (Ascending), createdAt (Descending)',
    'Collection: plots - Fields: status (Ascending), zone (Ascending), createdAt (Descending)',
    'Collection: plots - Fields: status (Ascending), region (Ascending), createdAt (Descending)',
    'Collection: plots - Fields: status (Ascending), zone (Ascending), region (Ascending), createdAt (Descending)',
  ];
};
