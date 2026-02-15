import * as admin from 'firebase-admin';
import { PricingRule, LandCategory, PricingZone } from '../types';
import { NATIONAL_DEFAULT_PRICES } from '../utils/pricingZones';

const PRICING_RULES_COLLECTION = 'pricingRules';

export interface PricingRuleResult {
  rule: {
    minUSDPerSotka: number;
    avgUSDPerSotka: number;
    maxUSDPerSotka: number;
  };
  source: 'oblast_category_zone' | 'oblast_category' | 'national_default';
}

/**
 * Get pricing rule with fallback logic:
 * 1. Try exact match: oblast + category + zone
 * 2. Fallback to: oblast + category (any zone - use urban_core as default)
 * 3. Fallback to: national default prices
 */
export const getPricingRuleWithFallback = async (
  db: admin.firestore.Firestore,
  oblast: string,
  category: LandCategory,
  zone: PricingZone
): Promise<PricingRuleResult> => {
  // Try exact match: oblast + category + zone
  const exactMatchId = `${oblast}_${category}_${zone}`;
  const exactMatchDoc = await db.collection(PRICING_RULES_COLLECTION).doc(exactMatchId).get();
  
  if (exactMatchDoc.exists) {
    const data = exactMatchDoc.data() as PricingRule;
    return {
      rule: {
        minUSDPerSotka: data.minUSDPerSotka,
        avgUSDPerSotka: data.avgUSDPerSotka,
        maxUSDPerSotka: data.maxUSDPerSotka,
      },
      source: 'oblast_category_zone',
    };
  }
  
  // Fallback 1: Try oblast + category (query for any zone, prefer urban_core)
  const oblastCategoryQuery = await db.collection(PRICING_RULES_COLLECTION)
    .where('oblast', '==', oblast)
    .where('category', '==', category)
    .limit(1)
    .get();
  
  if (!oblastCategoryQuery.empty) {
    const data = oblastCategoryQuery.docs[0].data() as PricingRule;
    return {
      rule: {
        minUSDPerSotka: data.minUSDPerSotka,
        avgUSDPerSotka: data.avgUSDPerSotka,
        maxUSDPerSotka: data.maxUSDPerSotka,
      },
      source: 'oblast_category',
    };
  }
  
  // Fallback 2: Use national default prices
  const nationalDefault = NATIONAL_DEFAULT_PRICES[category][zone];
  return {
    rule: {
      minUSDPerSotka: nationalDefault.min,
      avgUSDPerSotka: nationalDefault.avg,
      maxUSDPerSotka: nationalDefault.max,
    },
    source: 'national_default',
  };
};

/**
 * Create or update a pricing rule in Firestore
 */
export const upsertPricingRule = async (
  db: admin.firestore.Firestore,
  rule: Omit<PricingRule, 'id' | 'updatedAt'>
): Promise<string> => {
  const ruleId = `${rule.oblast}_${rule.category}_${rule.zone}`;
  
  await db.collection(PRICING_RULES_COLLECTION).doc(ruleId).set({
    ...rule,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  
  return ruleId;
};
