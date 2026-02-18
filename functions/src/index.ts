import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { CreateLandPlotRequest, ComputedPricing, LandCategory, PricingZone } from './types';
import { 
  findNearestOblastCenter, 
  determinePricingZone, 
  determineMarketStatus,
  isValidCategory
} from './utils/pricingZones';
import { 
  validateCadastralFormat, 
  getCadastralValidationStatus,
  extractOblastFromCadastral 
} from './utils/cadastral';
import { getPricingRuleWithFallback } from './services/pricingRules';
import { sanitizeText, RateLimiter } from './utils/security';

admin.initializeApp();

const db = admin.firestore();

const PLOTS_COLLECTION = 'plots';
const USERS_COLLECTION = 'users';
const ANALYTICS_COLLECTION = 'landAnalytics';

const rateLimiter = new RateLimiter(100, 60000);

interface CreateLandPlotResponse {
  success: boolean;
  plotId?: string;
  error?: string;
  pricing?: ComputedPricing;
}

/**
 * Callable Cloud Function to create a land plot with server-side validation
 * and computed pricing fields.
 */
export const createLandPlot = functions.https.onCall(
  async (data: CreateLandPlotRequest, context): Promise<CreateLandPlotResponse> => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to create a land plot.'
      );
    }

    const userId = context.auth.uid;

    // Check if user is blocked
    const userDoc = await db.collection(USERS_COLLECTION).doc(userId).get();
    if (userDoc.exists && userDoc.data()?.isBlocked === true) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'User is blocked and cannot create land plots.'
      );
    }

    // Validate required fields
    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Title is required and must be a non-empty string.'
      );
    }

    if (!data.area || typeof data.area !== 'number' || data.area <= 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Area must be a positive number.'
      );
    }

    if (!data.pricePerSotka || typeof data.pricePerSotka !== 'number' || data.pricePerSotka <= 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Price per sotka must be a positive number.'
      );
    }

    if (!data.location || typeof data.location.latitude !== 'number' || typeof data.location.longitude !== 'number') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Location with valid latitude and longitude is required.'
      );
    }

    // Validate cadastral number (server-side)
    if (!data.cadastralNumber || typeof data.cadastralNumber !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Cadastral number is required.'
      );
    }

    const isCadastralValid = validateCadastralFormat(data.cadastralNumber);
    const cadastralValidationStatus = getCadastralValidationStatus(data.cadastralNumber, false);

    if (!isCadastralValid) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid cadastral number format. Expected format: XXXXXXXXXX:XX:XXX:XXXX'
      );
    }

    // Validate category (server-side)
    let category: LandCategory | undefined;
    if (data.category) {
      if (!isValidCategory(data.category)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Invalid category. Must be one of: agricultural, residential, commercial, industrial, recreational.'
        );
      }
      category = data.category;
    }

    // Validate zone
    if (!data.zone || !['A', 'B', 'C'].includes(data.zone)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Zone must be A, B, or C.'
      );
    }

    // Calculate total price
    const totalPrice = data.area * data.pricePerSotka;

    // Calculate computed pricing (server-side)
    let pricing: ComputedPricing | undefined;
    
    if (category) {
      // Find nearest oblast center and calculate distance
      const { oblastCenter, distance } = findNearestOblastCenter(
        data.location.latitude,
        data.location.longitude
      );
      
      // Determine pricing zone based on distance
      const pricingZone = determinePricingZone(distance);
      
      // Determine oblast from cadastral number or provided oblast or nearest center
      const oblastFromCadastral = extractOblastFromCadastral(data.cadastralNumber);
      const oblastId = data.oblast || oblastFromCadastral || oblastCenter.id;
      
      // Get pricing rule with fallback logic
      const pricingResult = await getPricingRuleWithFallback(
        db,
        oblastId,
        category,
        pricingZone
      );
      
      // Calculate recommended prices and market status
      const recommendedMinUSD = pricingResult.rule.minUSDPerSotka * data.area;
      const recommendedMaxUSD = pricingResult.rule.maxUSDPerSotka * data.area;
      const marketStatus = determineMarketStatus(
        data.pricePerSotka,
        pricingResult.rule.minUSDPerSotka,
        pricingResult.rule.maxUSDPerSotka,
        pricingResult.rule.avgUSDPerSotka
      );
      
      pricing = {
        oblastId: oblastCenter.id,
        distanceToOblastCenter: distance,
        pricingZone,
        recommendedMinUSD,
        recommendedMaxUSD,
        marketStatus,
      };
      
      functions.logger.info('Pricing calculated', {
        oblastId,
        category,
        pricingZone,
        pricingSource: pricingResult.source,
        marketStatus,
      });
    }

    // Get user phone from auth or user document
    let ownerPhone = '';
    if (context.auth.token.phone_number) {
      ownerPhone = context.auth.token.phone_number;
    } else if (userDoc.exists) {
      ownerPhone = userDoc.data()?.phoneNumber || '';
    }

    // Create the land plot document
    const plotData = {
      title: data.title.trim(),
      description: data.description?.trim() || '',
      area: data.area,
      pricePerSotka: data.pricePerSotka,
      totalPrice,
      zone: data.zone,
      region: data.region || '',
      location: {
        latitude: data.location.latitude,
        longitude: data.location.longitude,
        address: data.location.address || '',
      },
      cadastralNumber: data.cadastralNumber,
      cadastralVerified: false,
      cadastralValidationStatus,
      photos: data.photos || [],
      ownerId: userId,
      ownerPhone,
      isInvestmentPlot: data.isInvestmentPlot || false,
      isCreditAvailable: data.isCreditAvailable || false,
      status: 'pending',
      ...(category && { category }),
      ...(data.oblast && { oblast: data.oblast }),
      ...(pricing && { pricing }),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
      const docRef = await db.collection(PLOTS_COLLECTION).add(plotData);
      
      functions.logger.info('Land plot created', {
        plotId: docRef.id,
        userId,
        category,
        hasComputedPricing: !!pricing,
      });

      return {
        success: true,
        plotId: docRef.id,
        pricing,
      };
    } catch (error) {
      functions.logger.error('Error creating land plot', { error, userId });
      throw new functions.https.HttpsError(
        'internal',
        'Failed to create land plot. Please try again.'
      );
    }
  }
);

interface RecomputePricingRequest {
  plotId: string;
}

interface RecomputePricingResponse {
  success: boolean;
  pricing?: ComputedPricing;
  error?: string;
}

export const recomputePricingForPlot = functions.https.onCall(
  async (data: RecomputePricingRequest, context): Promise<RecomputePricingResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated.'
      );
    }

    const userId = context.auth.uid;

    if (!data.plotId || typeof data.plotId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Plot ID is required.'
      );
    }

    const plotDoc = await db.collection(PLOTS_COLLECTION).doc(data.plotId).get();
    
    if (!plotDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Plot not found.'
      );
    }

    const plotData = plotDoc.data();
    
    if (!plotData) {
      throw new functions.https.HttpsError(
        'internal',
        'Failed to read plot data.'
      );
    }

    const userDoc = await db.collection(USERS_COLLECTION).doc(userId).get();
    const isAdmin = userDoc.exists && userDoc.data()?.role === 'admin';
    
    if (plotData.ownerId !== userId && !isAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'You do not have permission to update this plot.'
      );
    }

    const category = plotData.category as LandCategory | undefined;
    
    if (!category) {
      return {
        success: true,
        pricing: undefined,
      };
    }

    const location = plotData.location;
    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Plot location is invalid.'
      );
    }

    const { oblastCenter, distance } = findNearestOblastCenter(
      location.latitude,
      location.longitude
    );
    
    const pricingZone = determinePricingZone(distance);
    
    const oblastFromCadastral = plotData.cadastralNumber 
      ? extractOblastFromCadastral(plotData.cadastralNumber) 
      : null;
    const oblastId = plotData.oblast || oblastFromCadastral || oblastCenter.id;
    
    const pricingResult = await getPricingRuleWithFallback(
      db,
      oblastId,
      category,
      pricingZone
    );
    
    const area = plotData.area || 0;
    const pricePerSotka = plotData.pricePerSotka || 0;
    
    const recommendedMinUSD = pricingResult.rule.minUSDPerSotka * area;
    const recommendedMaxUSD = pricingResult.rule.maxUSDPerSotka * area;
    const marketStatus = determineMarketStatus(
      pricePerSotka,
      pricingResult.rule.minUSDPerSotka,
      pricingResult.rule.maxUSDPerSotka,
      pricingResult.rule.avgUSDPerSotka
    );
    
    const pricing: ComputedPricing = {
      oblastId: oblastCenter.id,
      distanceToOblastCenter: distance,
      pricingZone,
      recommendedMinUSD,
      recommendedMaxUSD,
      marketStatus,
    };

    const totalPrice = area * pricePerSotka;

    await db.collection(PLOTS_COLLECTION).doc(data.plotId).update({
      pricing,
      totalPrice,
      status: 'pending',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info('Pricing recomputed for plot', {
      plotId: data.plotId,
      userId,
      pricingZone,
      marketStatus,
    });

    return {
      success: true,
      pricing,
    };
  }
);

interface SearchFilters {
  oblast?: string;
  region?: string;
  category?: LandCategory;
  minPrice?: number;
  maxPrice?: number;
  minPricePerSotka?: number;
  maxPricePerSotka?: number;
  minArea?: number;
  maxArea?: number;
  minInvestmentScore?: number;
  isInvestmentPlot?: boolean;
  isCreditAvailable?: boolean;
  isPremium?: boolean;
  isPromoted?: boolean;
  zone?: 'A' | 'B' | 'C';
  pricingZone?: PricingZone;
  boundingBox?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

interface SearchRequest {
  filters: SearchFilters;
  pageSize?: number;
  cursor?: string;
  sortBy?: 'createdAt' | 'totalPrice' | 'pricePerSotka' | 'area' | 'investmentScore';
  sortOrder?: 'asc' | 'desc';
}

interface SearchResponse {
  success: boolean;
  result?: {
    plots: any[];
    totalCount: number;
    hasMore: boolean;
    nextCursor?: string;
  };
  error?: string;
}

export const searchLandPlots = functions.https.onCall(
  async (data: SearchRequest, context): Promise<SearchResponse> => {
    const userId = context.auth?.uid || 'anonymous';
    
    if (!rateLimiter.isAllowed(userId)) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Too many requests. Please try again later.'
      );
    }

    const { filters = {}, pageSize = 20, sortBy = 'createdAt', sortOrder = 'desc' } = data;
    const effectivePageSize = Math.min(pageSize, 100);

    let query: admin.firestore.Query = db.collection(PLOTS_COLLECTION)
      .where('status', '==', 'approved');

    if (filters.oblast) {
      query = query.where('oblast', '==', filters.oblast);
    }
    if (filters.category) {
      query = query.where('category', '==', filters.category);
    }
    if (filters.zone) {
      query = query.where('zone', '==', filters.zone);
    }
    if (filters.pricingZone) {
      query = query.where('pricing.pricingZone', '==', filters.pricingZone);
    }
    if (filters.isInvestmentPlot !== undefined) {
      query = query.where('isInvestmentPlot', '==', filters.isInvestmentPlot);
    }
    if (filters.isCreditAvailable !== undefined) {
      query = query.where('isCreditAvailable', '==', filters.isCreditAvailable);
    }

    query = query.orderBy(sortBy, sortOrder).limit(effectivePageSize + 1);

    const snapshot = await query.get();
    let plots = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (filters.minPrice !== undefined) {
      plots = plots.filter((p: any) => p.totalPrice >= filters.minPrice!);
    }
    if (filters.maxPrice !== undefined) {
      plots = plots.filter((p: any) => p.totalPrice <= filters.maxPrice!);
    }
    if (filters.minArea !== undefined) {
      plots = plots.filter((p: any) => p.area >= filters.minArea!);
    }
    if (filters.maxArea !== undefined) {
      plots = plots.filter((p: any) => p.area <= filters.maxArea!);
    }
    if (filters.minInvestmentScore !== undefined) {
      plots = plots.filter((p: any) => (p.intelligence?.investmentScore || 0) >= filters.minInvestmentScore!);
    }
    if (filters.boundingBox) {
      const { north, south, east, west } = filters.boundingBox;
      plots = plots.filter((p: any) => {
        const lat = p.location?.latitude;
        const lng = p.location?.longitude;
        return lat >= south && lat <= north && lng >= west && lng <= east;
      });
    }

    const promotedPlots = plots.filter((p: any) => {
      if (!p.premium?.isPromoted) return false;
      if (!p.premium.promotedExpiresAt) return true;
      return new Date() < p.premium.promotedExpiresAt.toDate();
    });
    const regularPlots = plots.filter((p: any) => {
      if (!p.premium?.isPromoted) return true;
      if (!p.premium.promotedExpiresAt) return false;
      return new Date() >= p.premium.promotedExpiresAt.toDate();
    });
    plots = [...promotedPlots, ...regularPlots];

    const hasMore = plots.length > effectivePageSize;
    if (hasMore) {
      plots = plots.slice(0, effectivePageSize);
    }

    const nextCursor = hasMore && plots.length > 0 ? plots[plots.length - 1].id : undefined;

    return {
      success: true,
      result: {
        plots,
        totalCount: plots.length,
        hasMore,
        nextCursor,
      },
    };
  }
);

const calculateInvestmentScore = (plot: any, oblastAvgPrice: number): number => {
  let score = 50;
  
  if (plot.pricing?.marketStatus === 'below_market') {
    score += 20;
  } else if (plot.pricing?.marketStatus === 'above_market') {
    score -= 15;
  }
  
  if (oblastAvgPrice > 0 && plot.pricePerSotka < oblastAvgPrice * 0.8) {
    score += 15;
  } else if (oblastAvgPrice > 0 && plot.pricePerSotka > oblastAvgPrice * 1.2) {
    score -= 10;
  }
  
  if (plot.pricing?.pricingZone === 'urban_core') {
    score += 10;
  } else if (plot.pricing?.pricingZone === 'suburban_0_15') {
    score += 5;
  }
  
  if (plot.category === 'residential' || plot.category === 'commercial') {
    score += 5;
  }
  
  if (plot.isInvestmentPlot) {
    score += 5;
  }
  
  return Math.max(0, Math.min(100, score));
};

export const calculateOblastAnalytics = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    functions.logger.info('Starting daily oblast analytics calculation');
    
    const plotsSnapshot = await db.collection(PLOTS_COLLECTION)
      .where('status', '==', 'approved')
      .get();
    
    const oblastData: Record<string, Record<string, number[]>> = {};
    
    plotsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const oblast = data.oblast || 'unknown';
      const category = data.category || 'unknown';
      const pricePerSotka = data.pricePerSotka || 0;
      
      if (!oblastData[oblast]) {
        oblastData[oblast] = {};
      }
      if (!oblastData[oblast][category]) {
        oblastData[oblast][category] = [];
      }
      oblastData[oblast][category].push(pricePerSotka);
    });
    
    const batch = db.batch();
    const now = admin.firestore.FieldValue.serverTimestamp();
    
    for (const [oblast, categories] of Object.entries(oblastData)) {
      for (const [category, prices] of Object.entries(categories)) {
        if (prices.length === 0) continue;
        
        const sorted = [...prices].sort((a, b) => a - b);
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        const median = sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];
        
        const analyticsRef = db.collection(ANALYTICS_COLLECTION).doc(`${oblast}_${category}`);
        batch.set(analyticsRef, {
          oblast,
          category,
          averagePricePerSotka: Math.round(avg * 100) / 100,
          medianPricePerSotka: Math.round(median * 100) / 100,
          minPricePerSotka: Math.min(...prices),
          maxPricePerSotka: Math.max(...prices),
          totalListings: prices.length,
          approvedListings: prices.length,
          calculatedAt: now,
        });
      }
    }
    
    await batch.commit();
    functions.logger.info('Oblast analytics calculation completed', {
      oblastsProcessed: Object.keys(oblastData).length,
    });
    
    return null;
  });

export const updatePlotIntelligence = functions.firestore
  .document('plots/{plotId}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) return;
    
    const plotData = change.after.data();
    if (!plotData || plotData.status !== 'approved') return;
    
    const oblast = plotData.oblast || 'unknown';
    const category = plotData.category || 'unknown';
    
    const analyticsDoc = await db.collection(ANALYTICS_COLLECTION)
      .doc(`${oblast}_${category}`)
      .get();
    
    const oblastAvgPrice = analyticsDoc.exists 
      ? analyticsDoc.data()?.averagePricePerSotka || 0 
      : 0;
    
    const pricePerHectare = (plotData.pricePerSotka || 0) * 100;
    const priceVsOblastAverage = oblastAvgPrice > 0 
      ? Math.round((plotData.pricePerSotka / oblastAvgPrice) * 100) 
      : 100;
    const investmentScore = calculateInvestmentScore(plotData, oblastAvgPrice);
    
    const intelligence = {
      pricePerHectare,
      priceVsOblastAverage,
      investmentScore,
      lastCalculatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    const currentIntelligence = plotData.intelligence;
    if (
      currentIntelligence?.pricePerHectare === pricePerHectare &&
      currentIntelligence?.priceVsOblastAverage === priceVsOblastAverage &&
      currentIntelligence?.investmentScore === investmentScore
    ) {
      return;
    }
    
    await change.after.ref.update({ intelligence });
  });

interface AdminAnalyticsResponse {
  success: boolean;
  analytics?: {
    totalListings: number;
    approvedListings: number;
    pendingListings: number;
    rejectedListings: number;
    deletedListings: number;
    totalUsers: number;
    blockedUsers: number;
    softBannedUsers: number;
    averagePriceByOblast: Record<string, number>;
    listingsByCategory: Record<string, number>;
    calculatedAt: Date;
  };
  error?: string;
}

export const getAdminAnalytics = functions.https.onCall(
  async (data, context): Promise<AdminAnalyticsResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const userDoc = await db.collection(USERS_COLLECTION).doc(context.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    const [plotsSnapshot, usersSnapshot, analyticsSnapshot] = await Promise.all([
      db.collection(PLOTS_COLLECTION).get(),
      db.collection(USERS_COLLECTION).get(),
      db.collection(ANALYTICS_COLLECTION).get(),
    ]);

    let totalListings = 0, approvedListings = 0, pendingListings = 0, rejectedListings = 0, deletedListings = 0;
    const listingsByCategory: Record<string, number> = {};

    plotsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      totalListings++;
      
      switch (data.status) {
        case 'approved': approvedListings++; break;
        case 'pending': pendingListings++; break;
        case 'rejected': rejectedListings++; break;
        case 'deleted': deletedListings++; break;
      }
      
      const category = data.category || 'unknown';
      listingsByCategory[category] = (listingsByCategory[category] || 0) + 1;
    });

    let totalUsers = 0, blockedUsers = 0, softBannedUsers = 0;
    usersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      totalUsers++;
      if (data.isBlocked) blockedUsers++;
      if (data.isSoftBanned) softBannedUsers++;
    });

    const averagePriceByOblast: Record<string, number> = {};
    analyticsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!averagePriceByOblast[data.oblast]) {
        averagePriceByOblast[data.oblast] = data.averagePricePerSotka;
      }
    });

    return {
      success: true,
      analytics: {
        totalListings,
        approvedListings,
        pendingListings,
        rejectedListings,
        deletedListings,
        totalUsers,
        blockedUsers,
        softBannedUsers,
        averagePriceByOblast,
        listingsByCategory,
        calculatedAt: new Date(),
      },
    };
  }
);

interface BulkActionRequest {
  plotIds: string[];
  action: 'approve' | 'reject';
  reason?: string;
}

export const bulkModerateListings = functions.https.onCall(
  async (data: BulkActionRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const userDoc = await db.collection(USERS_COLLECTION).doc(context.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    if (!data.plotIds || !Array.isArray(data.plotIds) || data.plotIds.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Plot IDs required');
    }

    if (data.plotIds.length > 50) {
      throw new functions.https.HttpsError('invalid-argument', 'Maximum 50 plots per batch');
    }

    const batch = db.batch();
    const now = admin.firestore.FieldValue.serverTimestamp();

    for (const plotId of data.plotIds) {
      const plotRef = db.collection(PLOTS_COLLECTION).doc(plotId);
      
      if (data.action === 'approve') {
        batch.update(plotRef, {
          status: 'approved',
          approvedAt: now,
          approvedBy: context.auth.uid,
          updatedAt: now,
        });
      } else {
        batch.update(plotRef, {
          status: 'rejected',
          rejectedAt: now,
          rejectedBy: context.auth.uid,
          rejectReason: sanitizeText(data.reason || 'Bulk rejection'),
          updatedAt: now,
        });
      }
    }

    await batch.commit();

    functions.logger.info('Bulk moderation completed', {
      action: data.action,
      count: data.plotIds.length,
      adminId: context.auth.uid,
    });

    return { success: true, processedCount: data.plotIds.length };
  }
);

interface SoftBanRequest {
  userId: string;
  ban: boolean;
  reason?: string;
}

export const softBanUser = functions.https.onCall(
  async (data: SoftBanRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const adminDoc = await db.collection(USERS_COLLECTION).doc(context.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    if (!data.userId) {
      throw new functions.https.HttpsError('invalid-argument', 'User ID required');
    }

    const userRef = db.collection(USERS_COLLECTION).doc(data.userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    if (data.ban) {
      await userRef.update({
        isSoftBanned: true,
        softBanReason: sanitizeText(data.reason || 'Policy violation'),
        softBannedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await userRef.update({
        isSoftBanned: false,
        softBanReason: admin.firestore.FieldValue.delete(),
        softBannedAt: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    functions.logger.info('User soft ban status changed', {
      userId: data.userId,
      banned: data.ban,
      adminId: context.auth.uid,
    });

    return { success: true };
  }
);

interface PremiumRequest {
  plotId: string;
  type: 'premium' | 'promotion';
  durationDays: number;
}

export const activatePremiumListing = functions.https.onCall(
  async (data: PremiumRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    if (!data.plotId || !data.type || !data.durationDays) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    if (data.durationDays < 1 || data.durationDays > 365) {
      throw new functions.https.HttpsError('invalid-argument', 'Duration must be 1-365 days');
    }

    const plotRef = db.collection(PLOTS_COLLECTION).doc(data.plotId);
    const plotDoc = await plotRef.get();

    if (!plotDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Plot not found');
    }

    const plotData = plotDoc.data();
    if (plotData?.ownerId !== context.auth.uid) {
      const userDoc = await db.collection(USERS_COLLECTION).doc(context.auth.uid).get();
      if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Not authorized');
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + data.durationDays * 24 * 60 * 60 * 1000);

    const premiumUpdate: any = {
      'premium.isPremium': data.type === 'premium' ? true : (plotData?.premium?.isPremium || false),
      'premium.isPromoted': data.type === 'promotion' ? true : (plotData?.premium?.isPromoted || false),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (data.type === 'premium') {
      premiumUpdate['premium.premiumExpiresAt'] = expiresAt;
      premiumUpdate['premium.premiumPurchasedAt'] = now;
    } else {
      premiumUpdate['premium.promotedExpiresAt'] = expiresAt;
    }

    await plotRef.update(premiumUpdate);

    functions.logger.info('Premium listing activated', {
      plotId: data.plotId,
      type: data.type,
      durationDays: data.durationDays,
      userId: context.auth.uid,
    });

    return { success: true, expiresAt };
  }
);

export const expirePremiumListings = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async () => {
    const now = new Date();
    
    const premiumExpired = await db.collection(PLOTS_COLLECTION)
      .where('premium.isPremium', '==', true)
      .where('premium.premiumExpiresAt', '<=', now)
      .get();

    const promotedExpired = await db.collection(PLOTS_COLLECTION)
      .where('premium.isPromoted', '==', true)
      .where('premium.promotedExpiresAt', '<=', now)
      .get();

    const batch = db.batch();
    let count = 0;

    premiumExpired.docs.forEach(doc => {
      batch.update(doc.ref, { 'premium.isPremium': false });
      count++;
    });

    promotedExpired.docs.forEach(doc => {
      batch.update(doc.ref, { 'premium.isPromoted': false });
      count++;
    });

    if (count > 0) {
      await batch.commit();
      functions.logger.info('Expired premium listings processed', { count });
    }

    return null;
  });

// ==========================================
// NEWS & CONTENT CLOUD FUNCTIONS
// ==========================================

const NEWS_COLLECTION = 'news';

type NewsCategory = 'market-analysis' | 'legislation' | 'platform-news' | 'investment' | 'other';
type NewsStatus = 'draft' | 'published' | 'archived';
type NewsAuthorRole = 'admin' | 'manager';

interface CreateNewsRequest {
  title: string;
  shortDescription: string;
  content: string;
  category: NewsCategory;
  tags: string[];
  coverImageUrl?: string;
  galleryImages?: string[];
  isFeatured?: boolean;
  status?: NewsStatus;
}

interface CreateNewsResponse {
  success: boolean;
  articleId?: string;
  slug?: string;
  error?: string;
}

const generateSlug = (title: string): string => {
  const translitMap: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'h', 'ґ': 'g', 'д': 'd', 'е': 'e', 'є': 'ye',
    'ж': 'zh', 'з': 'z', 'и': 'y', 'і': 'i', 'ї': 'yi', 'й': 'y', 'к': 'k', 'л': 'l',
    'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ь': '', 'ю': 'yu',
    'я': 'ya', "'": '', 'ъ': '', 'ы': 'y', 'э': 'e',
  };
  
  return title
    .toLowerCase()
    .split('')
    .map(char => translitMap[char] || char)
    .join('')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
};

const calculateReadingTime = (content: string): number => {
  const wordsPerMinute = 200;
  const wordCount = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
};

const isValidNewsCategory = (category: string): category is NewsCategory => {
  return ['market-analysis', 'legislation', 'platform-news', 'investment', 'other'].includes(category);
};

export const createNewsArticle = functions.https.onCall(
  async (data: CreateNewsRequest, context): Promise<CreateNewsResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Користувач має бути авторизований.'
      );
    }

    const userId = context.auth.uid;
    
    const userDoc = await db.collection(USERS_COLLECTION).doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Користувача не знайдено.'
      );
    }
    
    const userData = userDoc.data();
    const userRole = userData?.role;
    
    if (userRole !== 'admin' && userRole !== 'manager') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Тільки адміністратори та менеджери можуть створювати новини.'
      );
    }

    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Заголовок є обов\'язковим.'
      );
    }
    
    if (data.title.length > 200) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Заголовок занадто довгий (макс. 200 символів).'
      );
    }

    if (!data.shortDescription || data.shortDescription.length > 500) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Короткий опис є обов\'язковим (макс. 500 символів).'
      );
    }

    if (!data.content || data.content.length > 50000) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Зміст є обов\'язковим (макс. 50000 символів).'
      );
    }

    if (!data.category || !isValidNewsCategory(data.category)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Невірна категорія.'
      );
    }

    const sanitizedTitle = sanitizeText(data.title, 200);
    const sanitizedDescription = sanitizeText(data.shortDescription, 500);
    const sanitizedContent = sanitizeText(data.content, 50000);

    const baseSlug = generateSlug(sanitizedTitle);
    const timestamp = Date.now();
    const slug = `${baseSlug}-${timestamp}`;

    const existingSlug = await db.collection(NEWS_COLLECTION)
      .where('slug', '==', slug)
      .limit(1)
      .get();
    
    if (!existingSlug.empty) {
      throw new functions.https.HttpsError(
        'already-exists',
        'Стаття з таким slug вже існує.'
      );
    }

    const readingTime = calculateReadingTime(sanitizedContent);
    const authorRole: NewsAuthorRole = userRole === 'admin' ? 'admin' : 'manager';

    const articleData = {
      title: sanitizedTitle,
      slug,
      shortDescription: sanitizedDescription,
      content: sanitizedContent,
      category: data.category,
      tags: (data.tags || []).slice(0, 10).map(t => sanitizeText(t, 50)),
      coverImageUrl: data.coverImageUrl || null,
      galleryImages: (data.galleryImages || []).slice(0, 10),
      isFeatured: data.isFeatured || false,
      status: data.status || 'draft',
      authorId: userId,
      authorName: userData?.displayName || userData?.email || 'Адміністратор',
      authorRole,
      readingTime,
      viewsCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      publishedAt: data.status === 'published' ? admin.firestore.FieldValue.serverTimestamp() : null,
    };

    try {
      const docRef = await db.collection(NEWS_COLLECTION).add(articleData);
      
      functions.logger.info('News article created', {
        articleId: docRef.id,
        slug,
        userId,
        category: data.category,
      });

      return {
        success: true,
        articleId: docRef.id,
        slug,
      };
    } catch (error) {
      functions.logger.error('Error creating news article', { error, userId });
      throw new functions.https.HttpsError(
        'internal',
        'Не вдалося створити статтю.'
      );
    }
  }
);

interface IncrementViewsRequest {
  articleId: string;
}

interface IncrementViewsResponse {
  success: boolean;
  viewsCount?: number;
}

export const incrementNewsViews = functions.https.onCall(
  async (data: IncrementViewsRequest): Promise<IncrementViewsResponse> => {
    if (!data.articleId || typeof data.articleId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'ID статті є обов\'язковим.'
      );
    }

    const articleRef = db.collection(NEWS_COLLECTION).doc(data.articleId);
    const articleDoc = await articleRef.get();
    
    if (!articleDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Статтю не знайдено.'
      );
    }

    const articleData = articleDoc.data();
    if (articleData?.status !== 'published') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Можна переглядати тільки опубліковані статті.'
      );
    }

    await articleRef.update({
      viewsCount: admin.firestore.FieldValue.increment(1),
    });

    const updatedDoc = await articleRef.get();
    const newViewsCount = updatedDoc.data()?.viewsCount || 0;

    return {
      success: true,
      viewsCount: newViewsCount,
    };
  }
);

interface UpdateNewsRequest {
  articleId: string;
  title?: string;
  shortDescription?: string;
  content?: string;
  category?: NewsCategory;
  tags?: string[];
  coverImageUrl?: string;
  galleryImages?: string[];
  isFeatured?: boolean;
  status?: NewsStatus;
}

interface UpdateNewsResponse {
  success: boolean;
  error?: string;
}

export const updateNewsArticle = functions.https.onCall(
  async (data: UpdateNewsRequest, context): Promise<UpdateNewsResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Користувач має бути авторизований.'
      );
    }

    const userId = context.auth.uid;
    
    const userDoc = await db.collection(USERS_COLLECTION).doc(userId).get();
    const userRole = userDoc.data()?.role;
    
    if (userRole !== 'admin' && userRole !== 'manager') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Тільки адміністратори та менеджери можуть редагувати новини.'
      );
    }

    if (!data.articleId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'ID статті є обов\'язковим.'
      );
    }

    const articleRef = db.collection(NEWS_COLLECTION).doc(data.articleId);
    const articleDoc = await articleRef.get();
    
    if (!articleDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Статтю не знайдено.'
      );
    }

    const existingData = articleDoc.data();
    const updates: Record<string, unknown> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (data.title !== undefined) {
      if (data.title.length > 200) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Заголовок занадто довгий.'
        );
      }
      updates.title = sanitizeText(data.title, 200);
      
      if (data.title !== existingData?.title) {
        const baseSlug = generateSlug(data.title);
        const timestamp = Date.now();
        updates.slug = `${baseSlug}-${timestamp}`;
      }
    }

    if (data.shortDescription !== undefined) {
      updates.shortDescription = sanitizeText(data.shortDescription, 500);
    }

    if (data.content !== undefined) {
      updates.content = sanitizeText(data.content, 50000);
      updates.readingTime = calculateReadingTime(data.content);
    }

    if (data.category !== undefined && isValidNewsCategory(data.category)) {
      updates.category = data.category;
    }

    if (data.tags !== undefined) {
      updates.tags = data.tags.slice(0, 10).map(t => sanitizeText(t, 50));
    }

    if (data.coverImageUrl !== undefined) {
      updates.coverImageUrl = data.coverImageUrl;
    }

    if (data.galleryImages !== undefined) {
      updates.galleryImages = data.galleryImages.slice(0, 10);
    }

    if (data.isFeatured !== undefined) {
      updates.isFeatured = data.isFeatured;
    }

    if (data.status !== undefined) {
      updates.status = data.status;
      if (data.status === 'published' && existingData?.status !== 'published') {
        updates.publishedAt = admin.firestore.FieldValue.serverTimestamp();
      }
    }

    await articleRef.update(updates);

    functions.logger.info('News article updated', {
      articleId: data.articleId,
      userId,
    });

    return { success: true };
  }
);

export const checkSlugUniqueness = functions.https.onCall(
  async (data: { slug: string }): Promise<{ isUnique: boolean }> => {
    if (!data.slug || typeof data.slug !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Slug є обов\'язковим.'
      );
    }

    const existing = await db.collection(NEWS_COLLECTION)
      .where('slug', '==', data.slug)
      .limit(1)
      .get();

    return { isUnique: existing.empty };
  }
);

// ============================================
// MONOBANK PAYMENT INTEGRATION
// ============================================

const PAYMENTS_COLLECTION = 'payments';
const FREE_LISTINGS_LIMIT = 2;
const LISTING_FEE_UAH = 250;

interface CreateListingPaymentRequest {
  userId: string;
  listingId: string;
}

interface CreateListingPaymentResponse {
  success: boolean;
  paymentUrl?: string;
  invoiceId?: string;
  error?: string;
}

/**
 * Create a payment invoice for listing publication via Monobank API
 * User gets 2 free listings, 3rd+ requires 250 UAH payment
 */
export const createListingPayment = functions.https.onCall(
  async (data: CreateListingPaymentRequest, context): Promise<CreateListingPaymentResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Користувач повинен бути авторизований.'
      );
    }

    const userId = context.auth.uid;

    if (!data.listingId || typeof data.listingId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'ID оголошення є обов\'язковим.'
      );
    }

    // Check user's listing count
    const userListingsSnapshot = await db.collection(PLOTS_COLLECTION)
      .where('ownerId', '==', userId)
      .where('status', 'in', ['pending', 'approved'])
      .get();

    const listingCount = userListingsSnapshot.size;

    // If user has less than FREE_LISTINGS_LIMIT, no payment needed
    if (listingCount < FREE_LISTINGS_LIMIT) {
      return {
        success: true,
        invoiceId: 'free',
      };
    }

    // Create payment record in Firestore
    const paymentData = {
      userId,
      listingId: data.listingId,
      amount: LISTING_FEE_UAH,
      currency: 'UAH',
      status: 'pending',
      type: 'listing_fee',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const paymentRef = await db.collection(PAYMENTS_COLLECTION).add(paymentData);
    const invoiceId = paymentRef.id;

    // In production, this would call Monobank API to create invoice
    // For now, we return a mock payment URL
    // Monobank API: POST https://api.monobank.ua/api/merchant/invoice/create
    const monobankToken = functions.config().monobank?.token;
    
    if (!monobankToken) {
      // Development mode - return mock URL
      functions.logger.warn('Monobank token not configured, using mock payment');
      
      const mockPaymentUrl = `https://pay.example.com/invoice/${invoiceId}?amount=${LISTING_FEE_UAH}`;
      
      await paymentRef.update({
        paymentUrl: mockPaymentUrl,
        invoiceId,
      });

      return {
        success: true,
        paymentUrl: mockPaymentUrl,
        invoiceId,
      };
    }

    // Production Monobank API call
    try {
      const response = await fetch('https://api.monobank.ua/api/merchant/invoice/create', {
        method: 'POST',
        headers: {
          'X-Token': monobankToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: LISTING_FEE_UAH * 100, // Monobank expects amount in kopiykas
          ccy: 980, // UAH currency code
          merchantPaymInfo: {
            reference: invoiceId,
            destination: `Публікація оголошення #${data.listingId}`,
          },
          redirectUrl: `https://land-app.example.com/payment/success?invoiceId=${invoiceId}`,
          webHookUrl: `https://us-central1-land-app-mvp.cloudfunctions.net/monobankWebhook`,
          validity: 3600, // 1 hour validity
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.errText || 'Monobank API error');
      }

      await paymentRef.update({
        paymentUrl: result.pageUrl,
        monobankInvoiceId: result.invoiceId,
      });

      functions.logger.info('Monobank invoice created', {
        invoiceId,
        monobankInvoiceId: result.invoiceId,
        userId,
        listingId: data.listingId,
      });

      return {
        success: true,
        paymentUrl: result.pageUrl,
        invoiceId,
      };
    } catch (error: any) {
      functions.logger.error('Monobank API error', { error: error.message, userId });
      
      await paymentRef.update({
        status: 'failed',
        error: error.message,
      });

      return {
        success: false,
        error: 'Не вдалося створити платіж. Спробуйте пізніше.',
      };
    }
  }
);

interface MonobankWebhookData {
  invoiceId: string;
  status: string;
  amount: number;
  ccy: number;
  reference: string;
  createdDate: string;
  modifiedDate: string;
}

/**
 * Webhook handler for Monobank payment notifications
 */
export const monobankWebhook = functions.https.onRequest(
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    const data = req.body as MonobankWebhookData;

    if (!data.reference) {
      functions.logger.error('Monobank webhook: missing reference');
      res.status(400).send('Missing reference');
      return;
    }

    const paymentRef = db.collection(PAYMENTS_COLLECTION).doc(data.reference);
    const paymentDoc = await paymentRef.get();

    if (!paymentDoc.exists) {
      functions.logger.error('Monobank webhook: payment not found', { reference: data.reference });
      res.status(404).send('Payment not found');
      return;
    }

    const paymentData = paymentDoc.data();

    if (data.status === 'success') {
      // Payment successful - update payment and listing status
      await paymentRef.update({
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        monobankStatus: data.status,
      });

      // Update listing to allow publication
      if (paymentData?.listingId) {
        await db.collection(PLOTS_COLLECTION).doc(paymentData.listingId).update({
          paymentStatus: 'paid',
          paymentId: data.reference,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      functions.logger.info('Payment completed', {
        invoiceId: data.reference,
        listingId: paymentData?.listingId,
        amount: data.amount,
      });
    } else if (data.status === 'failure' || data.status === 'expired') {
      // Payment failed or expired
      await paymentRef.update({
        status: 'failed',
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
        monobankStatus: data.status,
      });

      functions.logger.info('Payment failed', {
        invoiceId: data.reference,
        status: data.status,
      });
    }

    res.status(200).send('OK');
  }
);

/**
 * Check payment status for a listing
 */
export const checkPaymentStatus = functions.https.onCall(
  async (data: { listingId: string }, context): Promise<{ status: string; requiresPayment: boolean }> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Користувач повинен бути авторизований.'
      );
    }

    const userId = context.auth.uid;

    // Check user's listing count
    const userListingsSnapshot = await db.collection(PLOTS_COLLECTION)
      .where('ownerId', '==', userId)
      .where('status', 'in', ['pending', 'approved'])
      .get();

    const listingCount = userListingsSnapshot.size;

    if (listingCount < FREE_LISTINGS_LIMIT) {
      return {
        status: 'free',
        requiresPayment: false,
      };
    }

    // Check if there's a completed payment for this listing
    const paymentSnapshot = await db.collection(PAYMENTS_COLLECTION)
      .where('listingId', '==', data.listingId)
      .where('status', '==', 'completed')
      .limit(1)
      .get();

    if (!paymentSnapshot.empty) {
      return {
        status: 'paid',
        requiresPayment: false,
      };
    }

    return {
      status: 'pending',
      requiresPayment: true,
    };
  }
);

// ============================================
// ENTERPRISE RBAC ADMIN SYSTEM
// ============================================

const AUDIT_LOGS_COLLECTION = 'auditLogs';

// Role hierarchy and permissions
type AdminRole = 'super_admin' | 'admin' | 'moderator' | 'support' | 'finance';

interface RolePermissions {
  canAssignRoles: boolean;
  canRemoveRoles: boolean;
  canViewAuditLogs: boolean;
  canModerateListings: boolean;
  canManageUsers: boolean;
  canViewRevenue: boolean;
  canImpersonateUsers: boolean;
  canViewUserProfiles: boolean;
  canViewLoginLogs: boolean;
  canViewPayments: boolean;
  canExportReports: boolean;
  canViewRevenueCharts: boolean;
  requires2FA: boolean;
}

const ROLE_PERMISSIONS: Record<AdminRole, RolePermissions> = {
  super_admin: {
    canAssignRoles: true,
    canRemoveRoles: true,
    canViewAuditLogs: true,
    canModerateListings: true,
    canManageUsers: true,
    canViewRevenue: true,
    canImpersonateUsers: true,
    canViewUserProfiles: true,
    canViewLoginLogs: true,
    canViewPayments: true,
    canExportReports: true,
    canViewRevenueCharts: true,
    requires2FA: true,
  },
  admin: {
    canAssignRoles: false,
    canRemoveRoles: false,
    canViewAuditLogs: false,
    canModerateListings: true,
    canManageUsers: true,
    canViewRevenue: true,
    canImpersonateUsers: true,
    canViewUserProfiles: true,
    canViewLoginLogs: false,
    canViewPayments: false,
    canExportReports: false,
    canViewRevenueCharts: false,
    requires2FA: true,
  },
  moderator: {
    canAssignRoles: false,
    canRemoveRoles: false,
    canViewAuditLogs: false,
    canModerateListings: true,
    canManageUsers: false,
    canViewRevenue: false,
    canImpersonateUsers: false,
    canViewUserProfiles: false,
    canViewLoginLogs: false,
    canViewPayments: false,
    canExportReports: false,
    canViewRevenueCharts: false,
    requires2FA: false,
  },
  support: {
    canAssignRoles: false,
    canRemoveRoles: false,
    canViewAuditLogs: false,
    canModerateListings: false,
    canManageUsers: false,
    canViewRevenue: false,
    canImpersonateUsers: true,
    canViewUserProfiles: true,
    canViewLoginLogs: true,
    canViewPayments: false,
    canExportReports: false,
    canViewRevenueCharts: false,
    requires2FA: false,
  },
  finance: {
    canAssignRoles: false,
    canRemoveRoles: false,
    canViewAuditLogs: false,
    canModerateListings: false,
    canManageUsers: false,
    canViewRevenue: true,
    canImpersonateUsers: false,
    canViewUserProfiles: false,
    canViewLoginLogs: false,
    canViewPayments: true,
    canExportReports: true,
    canViewRevenueCharts: true,
    requires2FA: false,
  },
};

const VALID_ROLES: AdminRole[] = ['super_admin', 'admin', 'moderator', 'support', 'finance'];

function isValidAdminRole(role: string): role is AdminRole {
  return VALID_ROLES.includes(role as AdminRole);
}

/**
 * Log admin action to audit logs collection
 */
async function logAdminAction(
  actorId: string,
  actorRole: AdminRole,
  action: string,
  targetId: string | null,
  details: Record<string, any>
): Promise<void> {
  await db.collection(AUDIT_LOGS_COLLECTION).add({
    actorId,
    actorRole,
    action,
    targetId,
    details,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    ipAddress: null, // Would be populated from request headers in production
  });
}

/**
 * Get user's admin role from custom claims
 */
async function getUserAdminRole(uid: string): Promise<AdminRole | null> {
  try {
    const user = await admin.auth().getUser(uid);
    const claims = user.customClaims;
    if (claims && claims.adminRole && isValidAdminRole(claims.adminRole)) {
      return claims.adminRole;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if user has specific permission
 */
function hasPermission(role: AdminRole | null, permission: keyof RolePermissions): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role][permission] === true;
}

/**
 * Verify 2FA is enabled for roles that require it
 */
async function verify2FARequired(uid: string, role: AdminRole): Promise<boolean> {
  if (!ROLE_PERMISSIONS[role].requires2FA) {
    return true; // 2FA not required for this role
  }
  
  // Check if user has 2FA enabled
  const userDoc = await db.collection(USERS_COLLECTION).doc(uid).get();
  if (!userDoc.exists) return false;
  
  const userData = userDoc.data();
  return userData?.twoFactorEnabled === true;
}

interface AssignRoleRequest {
  targetUserId: string;
  role: AdminRole;
}

interface AssignRoleResponse {
  success: boolean;
  error?: string;
}

/**
 * Assign admin role to user via custom claims
 * Only super_admin can assign roles
 */
export const assignAdminRole = functions.https.onCall(
  async (data: AssignRoleRequest, context): Promise<AssignRoleResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Користувач повинен бути авторизований.'
      );
    }

    const actorId = context.auth.uid;
    const actorRole = await getUserAdminRole(actorId);

    // Only super_admin can assign roles
    if (!hasPermission(actorRole, 'canAssignRoles')) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Тільки super_admin може призначати ролі.'
      );
    }

    // Verify 2FA for super_admin
    const has2FA = await verify2FARequired(actorId, actorRole!);
    if (!has2FA) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Потрібна двофакторна автентифікація.'
      );
    }

    if (!data.targetUserId || typeof data.targetUserId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'ID користувача є обов\'язковим.'
      );
    }

    if (!data.role || !isValidAdminRole(data.role)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Недійсна роль. Допустимі: ${VALID_ROLES.join(', ')}`
      );
    }

    try {
      // Set custom claims via Firebase Admin SDK
      await admin.auth().setCustomUserClaims(data.targetUserId, {
        adminRole: data.role,
      });

      // Also update Firestore user document for reference
      await db.collection(USERS_COLLECTION).doc(data.targetUserId).update({
        adminRole: data.role,
        adminRoleAssignedAt: admin.firestore.FieldValue.serverTimestamp(),
        adminRoleAssignedBy: actorId,
      });

      // Log the action
      await logAdminAction(actorId, actorRole!, 'ASSIGN_ROLE', data.targetUserId, {
        newRole: data.role,
      });

      functions.logger.info('Admin role assigned', {
        actorId,
        targetUserId: data.targetUserId,
        role: data.role,
      });

      return { success: true };
    } catch (error: any) {
      functions.logger.error('Failed to assign admin role', { error: error.message });
      return {
        success: false,
        error: 'Не вдалося призначити роль.',
      };
    }
  }
);

interface RemoveRoleRequest {
  targetUserId: string;
}

/**
 * Remove admin role from user
 * Only super_admin can remove roles
 */
export const removeAdminRole = functions.https.onCall(
  async (data: RemoveRoleRequest, context): Promise<AssignRoleResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Користувач повинен бути авторизований.'
      );
    }

    const actorId = context.auth.uid;
    const actorRole = await getUserAdminRole(actorId);

    if (!hasPermission(actorRole, 'canRemoveRoles')) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Тільки super_admin може видаляти ролі.'
      );
    }

    const has2FA = await verify2FARequired(actorId, actorRole!);
    if (!has2FA) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Потрібна двофакторна автентифікація.'
      );
    }

    if (!data.targetUserId || typeof data.targetUserId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'ID користувача є обов\'язковим.'
      );
    }

    // Get current role for logging
    const previousRole = await getUserAdminRole(data.targetUserId);

    try {
      // Remove custom claims
      await admin.auth().setCustomUserClaims(data.targetUserId, {
        adminRole: null,
      });

      // Update Firestore
      await db.collection(USERS_COLLECTION).doc(data.targetUserId).update({
        adminRole: admin.firestore.FieldValue.delete(),
        adminRoleRemovedAt: admin.firestore.FieldValue.serverTimestamp(),
        adminRoleRemovedBy: actorId,
      });

      // Log the action
      await logAdminAction(actorId, actorRole!, 'REMOVE_ROLE', data.targetUserId, {
        previousRole,
      });

      functions.logger.info('Admin role removed', {
        actorId,
        targetUserId: data.targetUserId,
        previousRole,
      });

      return { success: true };
    } catch (error: any) {
      functions.logger.error('Failed to remove admin role', { error: error.message });
      return {
        success: false,
        error: 'Не вдалося видалити роль.',
      };
    }
  }
);

interface GetAuditLogsRequest {
  limit?: number;
  startAfter?: string;
  action?: string;
  actorId?: string;
}

interface AuditLogEntry {
  id: string;
  actorId: string;
  actorRole: AdminRole;
  action: string;
  targetId: string | null;
  details: Record<string, any>;
  timestamp: any;
}

interface GetAuditLogsResponse {
  success: boolean;
  logs?: AuditLogEntry[];
  error?: string;
}

/**
 * Get audit logs
 * Only super_admin can view audit logs
 */
export const getAuditLogs = functions.https.onCall(
  async (data: GetAuditLogsRequest, context): Promise<GetAuditLogsResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Користувач повинен бути авторизований.'
      );
    }

    const actorId = context.auth.uid;
    const actorRole = await getUserAdminRole(actorId);

    if (!hasPermission(actorRole, 'canViewAuditLogs')) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Недостатньо прав для перегляду журналу аудиту.'
      );
    }

    const limit = Math.min(data.limit || 50, 100);

    try {
      let query: admin.firestore.Query = db.collection(AUDIT_LOGS_COLLECTION)
        .orderBy('timestamp', 'desc')
        .limit(limit);

      if (data.action) {
        query = query.where('action', '==', data.action);
      }

      if (data.actorId) {
        query = query.where('actorId', '==', data.actorId);
      }

      const snapshot = await query.get();
      const logs: AuditLogEntry[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as AuditLogEntry));

      return { success: true, logs };
    } catch (error: any) {
      functions.logger.error('Failed to get audit logs', { error: error.message });
      return {
        success: false,
        error: 'Не вдалося отримати журнал аудиту.',
      };
    }
  }
);

interface GetMyPermissionsResponse {
  success: boolean;
  role: AdminRole | null;
  permissions: RolePermissions | null;
}

/**
 * Get current user's admin role and permissions
 */
export const getMyAdminPermissions = functions.https.onCall(
  async (_data: unknown, context): Promise<GetMyPermissionsResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Користувач повинен бути авторизований.'
      );
    }

    const role = await getUserAdminRole(context.auth.uid);

    if (!role) {
      return {
        success: true,
        role: null,
        permissions: null,
      };
    }

    return {
      success: true,
      role,
      permissions: ROLE_PERMISSIONS[role],
    };
  }
);

interface Enable2FARequest {
  secret: string;
  token: string;
}

interface Enable2FAResponse {
  success: boolean;
  error?: string;
}

/**
 * Enable 2FA for admin users
 * Required for super_admin and admin roles
 */
export const enable2FA = functions.https.onCall(
  async (data: Enable2FARequest, context): Promise<Enable2FAResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Користувач повинен бути авторизований.'
      );
    }

    const userId = context.auth.uid;

    if (!data.secret || !data.token) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Секрет та токен є обов\'язковими.'
      );
    }

    // In production, verify the TOTP token against the secret
    // For now, we just store the 2FA status
    // TODO: Implement actual TOTP verification using a library like speakeasy

    try {
      await db.collection(USERS_COLLECTION).doc(userId).update({
        twoFactorEnabled: true,
        twoFactorEnabledAt: admin.firestore.FieldValue.serverTimestamp(),
        // In production, store encrypted secret
      });

      const role = await getUserAdminRole(userId);
      if (role) {
        await logAdminAction(userId, role, 'ENABLE_2FA', userId, {});
      }

      return { success: true };
    } catch (error: any) {
      functions.logger.error('Failed to enable 2FA', { error: error.message });
      return {
        success: false,
        error: 'Не вдалося увімкнути 2FA.',
      };
    }
  }
);

interface Verify2FARequest {
  token: string;
}

interface Verify2FAResponse {
  success: boolean;
  verified: boolean;
  error?: string;
}

/**
 * Verify 2FA token for admin actions
 */
export const verify2FAToken = functions.https.onCall(
  async (data: Verify2FARequest, context): Promise<Verify2FAResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Користувач повинен бути авторизований.'
      );
    }

    const userId = context.auth.uid;

    if (!data.token) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Токен є обов\'язковим.'
      );
    }

    // In production, verify the TOTP token
    // For now, accept any 6-digit token for testing
    const isValidToken = /^\d{6}$/.test(data.token);

    if (!isValidToken) {
      return {
        success: true,
        verified: false,
        error: 'Недійсний токен.',
      };
    }

    // Log verification attempt
    const role = await getUserAdminRole(userId);
    if (role) {
      await logAdminAction(userId, role, 'VERIFY_2FA', userId, {
        verified: true,
      });
    }

    return {
      success: true,
      verified: true,
    };
  }
);

interface ImpersonateUserRequest {
  targetUserId: string;
}

interface ImpersonateUserResponse {
  success: boolean;
  customToken?: string;
  error?: string;
}

/**
 * Generate custom token for user impersonation
 * Only admin and support roles can impersonate
 */
export const impersonateUser = functions.https.onCall(
  async (data: ImpersonateUserRequest, context): Promise<ImpersonateUserResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Користувач повинен бути авторизований.'
      );
    }

    const actorId = context.auth.uid;
    const actorRole = await getUserAdminRole(actorId);

    if (!hasPermission(actorRole, 'canImpersonateUsers')) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Недостатньо прав для імітації користувача.'
      );
    }

    // Verify 2FA if required
    if (actorRole && ROLE_PERMISSIONS[actorRole].requires2FA) {
      const has2FA = await verify2FARequired(actorId, actorRole);
      if (!has2FA) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Потрібна двофакторна автентифікація.'
        );
      }
    }

    if (!data.targetUserId || typeof data.targetUserId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'ID користувача є обов\'язковим.'
      );
    }

    // Cannot impersonate super_admin
    const targetRole = await getUserAdminRole(data.targetUserId);
    if (targetRole === 'super_admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Неможливо імітувати super_admin.'
      );
    }

    try {
      // Generate custom token with impersonation flag
      const customToken = await admin.auth().createCustomToken(data.targetUserId, {
        impersonatedBy: actorId,
        impersonatedAt: Date.now(),
      });

      // Log the impersonation
      await logAdminAction(actorId, actorRole!, 'IMPERSONATE_USER', data.targetUserId, {
        targetRole,
      });

      functions.logger.info('User impersonation', {
        actorId,
        targetUserId: data.targetUserId,
      });

      return {
        success: true,
        customToken,
      };
    } catch (error: any) {
      functions.logger.error('Failed to impersonate user', { error: error.message });
      return {
        success: false,
        error: 'Не вдалося імітувати користувача.',
      };
    }
  }
);

interface GetLoginLogsRequest {
  userId?: string;
  limit?: number;
}

interface LoginLogEntry {
  id: string;
  userId: string;
  timestamp: any;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
}

interface GetLoginLogsResponse {
  success: boolean;
  logs?: LoginLogEntry[];
  error?: string;
}

/**
 * Get login logs
 * Only support role can view login logs
 */
export const getLoginLogs = functions.https.onCall(
  async (data: GetLoginLogsRequest, context): Promise<GetLoginLogsResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Користувач повинен бути авторизований.'
      );
    }

    const actorId = context.auth.uid;
    const actorRole = await getUserAdminRole(actorId);

    if (!hasPermission(actorRole, 'canViewLoginLogs')) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Недостатньо прав для перегляду журналу входів.'
      );
    }

    const limit = Math.min(data.limit || 50, 100);

    try {
      let query: admin.firestore.Query = db.collection('loginLogs')
        .orderBy('timestamp', 'desc')
        .limit(limit);

      if (data.userId) {
        query = query.where('userId', '==', data.userId);
      }

      const snapshot = await query.get();
      const logs: LoginLogEntry[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as LoginLogEntry));

      return { success: true, logs };
    } catch (error: any) {
      functions.logger.error('Failed to get login logs', { error: error.message });
      return {
        success: false,
        error: 'Не вдалося отримати журнал входів.',
      };
    }
  }
);

interface GetRevenueDataRequest {
  startDate?: string;
  endDate?: string;
}

interface RevenueData {
  totalRevenue: number;
  totalPayments: number;
  averagePayment: number;
  revenueByDay: Array<{ date: string; amount: number }>;
}

interface GetRevenueDataResponse {
  success: boolean;
  data?: RevenueData;
  error?: string;
}

/**
 * Get revenue data
 * Only admin and finance roles can view revenue
 */
export const getRevenueData = functions.https.onCall(
  async (data: GetRevenueDataRequest, context): Promise<GetRevenueDataResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Користувач повинен бути авторизований.'
      );
    }

    const actorId = context.auth.uid;
    const actorRole = await getUserAdminRole(actorId);

    if (!hasPermission(actorRole, 'canViewRevenue')) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Недостатньо прав для перегляду доходів.'
      );
    }

    try {
      let query: admin.firestore.Query = db.collection(PAYMENTS_COLLECTION)
        .where('status', '==', 'completed');

      const snapshot = await query.get();
      
      let totalRevenue = 0;
      const revenueByDay: Record<string, number> = {};

      snapshot.docs.forEach(doc => {
        const payment = doc.data();
        totalRevenue += payment.amount || 0;
        
        if (payment.completedAt) {
          const date = payment.completedAt.toDate().toISOString().split('T')[0];
          revenueByDay[date] = (revenueByDay[date] || 0) + (payment.amount || 0);
        }
      });

      const totalPayments = snapshot.size;
      const averagePayment = totalPayments > 0 ? totalRevenue / totalPayments : 0;

      // Log the access
      await logAdminAction(actorId, actorRole!, 'VIEW_REVENUE', null, {
        startDate: data.startDate,
        endDate: data.endDate,
      });

      return {
        success: true,
        data: {
          totalRevenue,
          totalPayments,
          averagePayment,
          revenueByDay: Object.entries(revenueByDay).map(([date, amount]) => ({
            date,
            amount,
          })).sort((a, b) => a.date.localeCompare(b.date)),
        },
      };
    } catch (error: any) {
      functions.logger.error('Failed to get revenue data', { error: error.message });
      return {
        success: false,
        error: 'Не вдалося отримати дані про доходи.',
      };
    }
  }
);

interface ExportReportRequest {
  reportType: 'payments' | 'users' | 'listings';
  format: 'json' | 'csv';
  startDate?: string;
  endDate?: string;
}

interface ExportReportResponse {
  success: boolean;
  data?: string;
  error?: string;
}

/**
 * Export reports
 * Only finance role can export reports
 */
export const exportReport = functions.https.onCall(
  async (data: ExportReportRequest, context): Promise<ExportReportResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Користувач повинен бути авторизований.'
      );
    }

    const actorId = context.auth.uid;
    const actorRole = await getUserAdminRole(actorId);

    if (!hasPermission(actorRole, 'canExportReports')) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Недостатньо прав для експорту звітів.'
      );
    }

    if (!data.reportType || !['payments', 'users', 'listings'].includes(data.reportType)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Недійсний тип звіту.'
      );
    }

    try {
      let collectionName: string;
      switch (data.reportType) {
        case 'payments':
          collectionName = PAYMENTS_COLLECTION;
          break;
        case 'users':
          collectionName = USERS_COLLECTION;
          break;
        case 'listings':
          collectionName = PLOTS_COLLECTION;
          break;
        default:
          throw new Error('Invalid report type');
      }

      const snapshot = await db.collection(collectionName).limit(1000).get();
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      let exportData: string;
      if (data.format === 'csv') {
        // Simple CSV conversion
        if (records.length === 0) {
          exportData = '';
        } else {
          const headers = Object.keys(records[0]);
          const csvRows = [
            headers.join(','),
            ...records.map(record => 
              headers.map(h => JSON.stringify((record as any)[h] ?? '')).join(',')
            ),
          ];
          exportData = csvRows.join('\n');
        }
      } else {
        exportData = JSON.stringify(records, null, 2);
      }

      // Log the export
      await logAdminAction(actorId, actorRole!, 'EXPORT_REPORT', null, {
        reportType: data.reportType,
        format: data.format,
        recordCount: records.length,
      });

      return {
        success: true,
        data: exportData,
      };
    } catch (error: any) {
      functions.logger.error('Failed to export report', { error: error.message });
      return {
        success: false,
        error: 'Не вдалося експортувати звіт.',
      };
    }
  }
);
