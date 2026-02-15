import { 
  collection, 
  doc, 
  getDocs, 
  updateDoc, 
  query, 
  orderBy,
  where,
  limit as firestoreLimit,
  startAfter,
  serverTimestamp,
} from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { LandPlot, PaginatedResult, PaginationOptions, PlotStatus } from '../types';

const PLOTS_COLLECTION = 'plots';
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const docToPlot = (doc: QueryDocumentSnapshot<DocumentData>): LandPlot => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    status: data.status || 'pending',
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as LandPlot;
};

export const getPlotsPaginated = async (
  options?: PaginationOptions & { status?: PlotStatus }
): Promise<PaginatedResult<LandPlot>> => {
  try {
    const pageSize = Math.min(options?.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    
    let constraints: any[] = [
      orderBy('createdAt', 'desc'),
      firestoreLimit(pageSize + 1),
    ];
    
    // Add status filter if specified
    if (options?.status) {
      constraints = [
        where('status', '==', options.status),
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

// Legacy function for backward compatibility
export const getAllPlots = async (): Promise<LandPlot[]> => {
  try {
    const result = await getPlotsPaginated({ limit: MAX_PAGE_SIZE });
    return result.data;
  } catch (error) {
    console.error('Error getting plots:', error);
    throw error;
  }
};

export const approvePlot = async (plotId: string): Promise<void> => {
  try {
    const plotRef = doc(db, PLOTS_COLLECTION, plotId);
    await updateDoc(plotRef, {
      status: 'approved',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error approving plot:', error);
    throw error;
  }
};

export const hidePlot = async (plotId: string): Promise<void> => {
  try {
    const plotRef = doc(db, PLOTS_COLLECTION, plotId);
    await updateDoc(plotRef, {
      status: 'hidden',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error hiding plot:', error);
    throw error;
  }
};

export const setPendingPlot = async (plotId: string): Promise<void> => {
  try {
    const plotRef = doc(db, PLOTS_COLLECTION, plotId);
    await updateDoc(plotRef, {
      status: 'pending',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error setting plot to pending:', error);
    throw error;
  }
};
