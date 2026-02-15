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
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { LandPlot, PlotFilters, LandCategory, ComputedPricing } from '../types';
import { calculateComputedPricing } from '../utils/pricingZones';
import { getPricingRule } from './pricingRules';
import { validateCadastralFormat, getCadastralValidationStatus, extractOblastFromCadastral } from '../utils/cadastral';

const PLOTS_COLLECTION = 'plots';

export const createPlot = async (
  plotData: Omit<LandPlot, 'id' | 'createdAt' | 'updatedAt' | 'totalPrice' | 'status' | 'pricing' | 'cadastralValidationStatus'>
): Promise<string> => {
  try {
    const totalPrice = plotData.area * plotData.pricePerSotka;
    
    // Validate cadastral number format
    const cadastralValidationStatus = getCadastralValidationStatus(
      plotData.cadastralNumber,
      plotData.cadastralVerified
    );
    
    // Calculate computed pricing if category and location are provided
    let pricing: ComputedPricing | undefined;
    if (plotData.category && plotData.location) {
      // Try to get pricing rule for the oblast
      const oblastFromCadastral = extractOblastFromCadastral(plotData.cadastralNumber);
      const oblastId = plotData.oblast || oblastFromCadastral || 'default';
      
      const pricingRule = await getPricingRule(
        oblastId,
        plotData.category,
        'urban_core' // Will be recalculated based on distance
      ).catch(() => null);
      
      // Calculate computed pricing with zone detection
      pricing = calculateComputedPricing(
        plotData.location.latitude,
        plotData.location.longitude,
        plotData.area,
        plotData.pricePerSotka,
        pricingRule || undefined
      );
      
      // If we got a different zone, try to get the correct pricing rule
      if (pricingRule && pricing.pricingZone !== 'urban_core') {
        const correctPricingRule = await getPricingRule(
          oblastId,
          plotData.category,
          pricing.pricingZone
        ).catch(() => null);
        
        if (correctPricingRule) {
          pricing = calculateComputedPricing(
            plotData.location.latitude,
            plotData.location.longitude,
            plotData.area,
            plotData.pricePerSotka,
            correctPricingRule
          );
        }
      }
    }
    
    const docRef = await addDoc(collection(db, PLOTS_COLLECTION), {
      ...plotData,
      totalPrice,
      status: 'pending',
      cadastralValidationStatus,
      ...(pricing && { pricing }),
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

export const getPlots = async (filters?: PlotFilters): Promise<LandPlot[]> => {
  try {
    let q = query(collection(db, PLOTS_COLLECTION), orderBy('createdAt', 'desc'));
    
    // Note: Firestore has limitations on compound queries
    // For MVP, we'll filter in memory for complex filters
    const querySnapshot = await getDocs(q);
    
    let plots: LandPlot[] = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as LandPlot;
    });
    
    // Only show approved plots to mobile app users
    plots = plots.filter(p => p.status === 'approved');
    
    // Apply filters in memory
    if (filters) {
      if (filters.minPrice !== undefined) {
        plots = plots.filter(p => p.totalPrice >= filters.minPrice!);
      }
      if (filters.maxPrice !== undefined) {
        plots = plots.filter(p => p.totalPrice <= filters.maxPrice!);
      }
      if (filters.zone) {
        plots = plots.filter(p => p.zone === filters.zone);
      }
      if (filters.region) {
        plots = plots.filter(p => p.region === filters.region);
      }
    }
    
    return plots;
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
