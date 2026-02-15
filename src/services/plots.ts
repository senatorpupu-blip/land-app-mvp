import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit as firestoreLimit,
  startAfter,
  serverTimestamp,
  DocumentSnapshot,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { LandPlot, PlotFilters, PaginatedResult, PaginationOptions, MapCluster } from '../types';
import { encodeGeohash, getNeighborGeohashes, calculateDistance, getGeohashPrecisionForRadius } from '../utils/geohash';

const PLOTS_COLLECTION = 'plots';
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const createPlot = async (
  plotData: Omit<LandPlot, 'id' | 'createdAt' | 'updatedAt' | 'totalPrice' | 'status' | 'location'> & {
    location: Omit<LandPlot['location'], 'geohash'>;
  }
): Promise<string> => {
  try {
    const totalPrice = plotData.area * plotData.pricePerSotka;
    const geohash = encodeGeohash(plotData.location.latitude, plotData.location.longitude, 9);
    
    const docRef = await addDoc(collection(db, PLOTS_COLLECTION), {
      ...plotData,
      location: {
        ...plotData.location,
        geohash,
      },
      totalPrice,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating plot:', error);
    throw error;
  }
};

export const updatePlot = async (
  plotId: string, 
  updates: Partial<LandPlot>
): Promise<void> => {
  try {
    const plotRef = doc(db, PLOTS_COLLECTION, plotId);
    
    // Recalculate total price if area or pricePerSotka changed
    let totalPrice = updates.totalPrice;
    if (updates.area !== undefined || updates.pricePerSotka !== undefined) {
      const plotDoc = await getDoc(plotRef);
      if (plotDoc.exists()) {
        const currentData = plotDoc.data();
        const area = updates.area ?? currentData.area;
        const pricePerSotka = updates.pricePerSotka ?? currentData.pricePerSotka;
        totalPrice = area * pricePerSotka;
      }
    }
    
    await updateDoc(plotRef, {
      ...updates,
      ...(totalPrice !== undefined && { totalPrice }),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating plot:', error);
    throw error;
  }
};

export const deletePlot = async (plotId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, PLOTS_COLLECTION, plotId));
  } catch (error) {
    console.error('Error deleting plot:', error);
    throw error;
  }
};

export const getPlot = async (plotId: string): Promise<LandPlot | null> => {
  try {
    const plotDoc = await getDoc(doc(db, PLOTS_COLLECTION, plotId));
    
    if (!plotDoc.exists()) {
      return null;
    }
    
    const data = plotDoc.data();
    return {
      id: plotDoc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as LandPlot;
  } catch (error) {
    console.error('Error getting plot:', error);
    throw error;
  }
};

const docToPlot = (doc: QueryDocumentSnapshot): LandPlot => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as LandPlot;
};

export const getPlotsPaginated = async (
  filters?: PlotFilters,
  options?: PaginationOptions
): Promise<PaginatedResult<LandPlot>> => {
  try {
    const pageSize = Math.min(options?.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    
    // Build query with filters applied at Firestore level
    let constraints: any[] = [
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc'),
      firestoreLimit(pageSize + 1),
    ];
    
    // Add zone filter if specified
    if (filters?.zone) {
      constraints = [
        where('status', '==', 'approved'),
        where('zone', '==', filters.zone),
        orderBy('createdAt', 'desc'),
        firestoreLimit(pageSize + 1),
      ];
    }
    
    // Add region filter if specified
    if (filters?.region) {
      constraints = [
        where('status', '==', 'approved'),
        where('region', '==', filters.region),
        orderBy('createdAt', 'desc'),
        firestoreLimit(pageSize + 1),
      ];
    }
    
    // Add cursor for pagination
    if (options?.cursor) {
      constraints.push(startAfter(options.cursor));
    }
    
    const q = query(collection(db, PLOTS_COLLECTION), ...constraints);
    const querySnapshot = await getDocs(q);
    
    let plots = querySnapshot.docs.map(docToPlot);
    
    // Apply price filters in memory (Firestore doesn't support range on multiple fields)
    if (filters?.minPrice !== undefined) {
      plots = plots.filter(p => p.totalPrice >= filters.minPrice!);
    }
    if (filters?.maxPrice !== undefined) {
      plots = plots.filter(p => p.totalPrice <= filters.maxPrice!);
    }
    
    const hasMore = plots.length > pageSize;
    if (hasMore) {
      plots = plots.slice(0, pageSize);
    }
    
    const lastDoc = plots.length > 0 ? querySnapshot.docs[plots.length - 1] : null;
    
    return {
      data: plots,
      lastDoc,
      hasMore,
    };
  } catch (error) {
    console.error('Error getting paginated plots:', error);
    throw error;
  }
};

export const getPlotsByGeohash = async (
  latitude: number,
  longitude: number,
  radiusKm: number,
  options?: PaginationOptions
): Promise<PaginatedResult<LandPlot>> => {
  try {
    const pageSize = Math.min(options?.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const precision = getGeohashPrecisionForRadius(radiusKm);
    const centerGeohash = encodeGeohash(latitude, longitude, precision);
    const neighborGeohashes = getNeighborGeohashes(centerGeohash);
    
    const allPlots: LandPlot[] = [];
    
    // Query each geohash neighbor
    for (const geohash of neighborGeohashes) {
      const q = query(
        collection(db, PLOTS_COLLECTION),
        where('status', '==', 'approved'),
        where('location.geohash', '>=', geohash),
        where('location.geohash', '<=', geohash + '\uf8ff'),
        firestoreLimit(pageSize * 2)
      );
      
      const snapshot = await getDocs(q);
      const plots = snapshot.docs.map(docToPlot);
      allPlots.push(...plots);
    }
    
    // Filter by actual distance and deduplicate
    const uniquePlots = Array.from(new Map(allPlots.map(p => [p.id, p])).values());
    const filteredPlots = uniquePlots.filter(plot => {
      const distance = calculateDistance(
        latitude,
        longitude,
        plot.location.latitude,
        plot.location.longitude
      );
      return distance <= radiusKm;
    });
    
    // Sort by distance
    filteredPlots.sort((a, b) => {
      const distA = calculateDistance(latitude, longitude, a.location.latitude, a.location.longitude);
      const distB = calculateDistance(latitude, longitude, b.location.latitude, b.location.longitude);
      return distA - distB;
    });
    
    const hasMore = filteredPlots.length > pageSize;
    const paginatedPlots = filteredPlots.slice(0, pageSize);
    
    return {
      data: paginatedPlots,
      lastDoc: null,
      hasMore,
    };
  } catch (error) {
    console.error('Error getting plots by geohash:', error);
    throw error;
  }
};

export const getMapClusters = async (
  bounds: { north: number; south: number; east: number; west: number },
  zoomLevel: number
): Promise<MapCluster[]> => {
  try {
    // Determine geohash precision based on zoom level
    const precision = Math.max(1, Math.min(6, Math.floor(zoomLevel / 3)));
    
    const q = query(
      collection(db, PLOTS_COLLECTION),
      where('status', '==', 'approved'),
      where('location.latitude', '>=', bounds.south),
      where('location.latitude', '<=', bounds.north),
      firestoreLimit(1000)
    );
    
    const snapshot = await getDocs(q);
    const plots = snapshot.docs.map(docToPlot);
    
    // Filter by longitude in memory
    const filteredPlots = plots.filter(
      p => p.location.longitude >= bounds.west && p.location.longitude <= bounds.east
    );
    
    // Group by geohash prefix for clustering
    const clusters = new Map<string, { plots: LandPlot[]; lat: number; lng: number }>();
    
    for (const plot of filteredPlots) {
      const clusterGeohash = plot.location.geohash?.substring(0, precision) || 
        encodeGeohash(plot.location.latitude, plot.location.longitude, precision);
      
      if (!clusters.has(clusterGeohash)) {
        clusters.set(clusterGeohash, { plots: [], lat: 0, lng: 0 });
      }
      
      const cluster = clusters.get(clusterGeohash)!;
      cluster.plots.push(plot);
      cluster.lat += plot.location.latitude;
      cluster.lng += plot.location.longitude;
    }
    
    // Convert to MapCluster array
    const result: MapCluster[] = [];
    clusters.forEach((cluster, geohash) => {
      result.push({
        id: geohash,
        latitude: cluster.lat / cluster.plots.length,
        longitude: cluster.lng / cluster.plots.length,
        count: cluster.plots.length,
        plotIds: cluster.plots.map(p => p.id),
        geohash,
      });
    });
    
    return result;
  } catch (error) {
    console.error('Error getting map clusters:', error);
    throw error;
  }
};

// Legacy function for backward compatibility - now uses pagination internally
export const getPlots = async (filters?: PlotFilters): Promise<LandPlot[]> => {
  try {
    // If geo filters are provided, use geohash-based query
    if (filters?.latitude !== undefined && filters?.longitude !== undefined && filters?.radiusKm !== undefined) {
      const result = await getPlotsByGeohash(
        filters.latitude,
        filters.longitude,
        filters.radiusKm,
        { limit: MAX_PAGE_SIZE }
      );
      return result.data;
    }
    
    // Otherwise use paginated query
    const result = await getPlotsPaginated(filters, { limit: MAX_PAGE_SIZE });
    return result.data;
  } catch (error) {
    console.error('Error getting plots:', error);
    throw error;
  }
};

export const getPlotsByOwner = async (ownerId: string): Promise<LandPlot[]> => {
  try {
    const q = query(
      collection(db, PLOTS_COLLECTION),
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as LandPlot;
    });
  } catch (error) {
    console.error('Error getting plots by owner:', error);
    throw error;
  }
};

export const uploadPlotImage = async (
  plotId: string, 
  imageUri: string, 
  index: number
): Promise<string> => {
  try {
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    const imageRef = ref(storage, `plots/${plotId}/image_${index}`);
    await uploadBytes(imageRef, blob);
    
    const downloadUrl = await getDownloadURL(imageRef);
    return downloadUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};
