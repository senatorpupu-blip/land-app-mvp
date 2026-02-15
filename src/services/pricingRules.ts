import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc,
  query, 
  where,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { PricingRule, LandCategory, PricingZone } from '../types';

const PRICING_RULES_COLLECTION = 'pricingRules';

export const getPricingRule = async (
  oblast: string,
  category: LandCategory,
  zone: PricingZone
): Promise<PricingRule | null> => {
  try {
    const q = query(
      collection(db, PRICING_RULES_COLLECTION),
      where('oblast', '==', oblast),
      where('category', '==', category),
      where('zone', '==', zone)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    const data = doc.data();
    
    return {
      id: doc.id,
      ...data,
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as PricingRule;
  } catch (error) {
    console.error('Error getting pricing rule:', error);
    throw error;
  }
};

export const getPricingRulesByOblast = async (
  oblast: string
): Promise<PricingRule[]> => {
  try {
    const q = query(
      collection(db, PRICING_RULES_COLLECTION),
      where('oblast', '==', oblast)
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as PricingRule;
    });
  } catch (error) {
    console.error('Error getting pricing rules by oblast:', error);
    throw error;
  }
};

export const getAllPricingRules = async (): Promise<PricingRule[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, PRICING_RULES_COLLECTION));
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as PricingRule;
    });
  } catch (error) {
    console.error('Error getting all pricing rules:', error);
    throw error;
  }
};

export const createPricingRule = async (
  rule: Omit<PricingRule, 'id' | 'updatedAt'>
): Promise<string> => {
  try {
    const ruleId = `${rule.oblast}_${rule.category}_${rule.zone}`;
    const docRef = doc(db, PRICING_RULES_COLLECTION, ruleId);
    
    await setDoc(docRef, {
      ...rule,
      updatedAt: serverTimestamp(),
    });
    
    return ruleId;
  } catch (error) {
    console.error('Error creating pricing rule:', error);
    throw error;
  }
};

export const updatePricingRule = async (
  ruleId: string,
  updates: Partial<Omit<PricingRule, 'id' | 'updatedAt'>>
): Promise<void> => {
  try {
    const docRef = doc(db, PRICING_RULES_COLLECTION, ruleId);
    
    await setDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('Error updating pricing rule:', error);
    throw error;
  }
};

export const getDefaultPricingRules = (): Omit<PricingRule, 'id' | 'updatedAt'>[] => {
  const zones: PricingZone[] = ['urban_core', 'suburban_0_15', 'suburban_15_30', 'rural'];
  const categories: LandCategory[] = ['agricultural', 'residential', 'commercial', 'industrial', 'recreational'];
  
  const defaultPrices: Record<LandCategory, Record<PricingZone, { min: number; avg: number; max: number }>> = {
    agricultural: {
      urban_core: { min: 2000, avg: 3500, max: 5000 },
      suburban_0_15: { min: 1500, avg: 2500, max: 3500 },
      suburban_15_30: { min: 1000, avg: 1800, max: 2500 },
      rural: { min: 500, avg: 1000, max: 1500 },
    },
    residential: {
      urban_core: { min: 5000, avg: 8000, max: 12000 },
      suburban_0_15: { min: 3000, avg: 5000, max: 8000 },
      suburban_15_30: { min: 2000, avg: 3500, max: 5000 },
      rural: { min: 1000, avg: 2000, max: 3000 },
    },
    commercial: {
      urban_core: { min: 8000, avg: 15000, max: 25000 },
      suburban_0_15: { min: 5000, avg: 10000, max: 15000 },
      suburban_15_30: { min: 3000, avg: 6000, max: 10000 },
      rural: { min: 1500, avg: 3000, max: 5000 },
    },
    industrial: {
      urban_core: { min: 3000, avg: 5000, max: 8000 },
      suburban_0_15: { min: 2000, avg: 3500, max: 5000 },
      suburban_15_30: { min: 1500, avg: 2500, max: 4000 },
      rural: { min: 800, avg: 1500, max: 2500 },
    },
    recreational: {
      urban_core: { min: 4000, avg: 7000, max: 10000 },
      suburban_0_15: { min: 2500, avg: 4500, max: 7000 },
      suburban_15_30: { min: 1500, avg: 3000, max: 5000 },
      rural: { min: 800, avg: 1800, max: 3000 },
    },
  };
  
  const rules: Omit<PricingRule, 'id' | 'updatedAt'>[] = [];
  
  for (const category of categories) {
    for (const zone of zones) {
      const prices = defaultPrices[category][zone];
      rules.push({
        oblast: 'default',
        category,
        zone,
        minUSDPerSotka: prices.min,
        avgUSDPerSotka: prices.avg,
        maxUSDPerSotka: prices.max,
      });
    }
  }
  
  return rules;
};
