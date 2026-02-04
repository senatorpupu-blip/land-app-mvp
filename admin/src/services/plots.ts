import { 
  collection, 
  doc, 
  getDocs, 
  updateDoc, 
  query, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { LandPlot } from '../types';

const PLOTS_COLLECTION = 'plots';

export const getAllPlots = async (): Promise<LandPlot[]> => {
  try {
    const q = query(collection(db, PLOTS_COLLECTION), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        status: data.status || 'pending',
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as LandPlot;
    });
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
