import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { CreateLandPlotRequest, ComputedPricing, LandCategory } from './types';
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

admin.initializeApp();

const db = admin.firestore();

const PLOTS_COLLECTION = 'plots';
const USERS_COLLECTION = 'users';

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
