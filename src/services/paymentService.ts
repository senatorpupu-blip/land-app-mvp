import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import { PaymentIntent } from '../types';

export interface PremiumPricing {
  premium7Days: number;
  premium30Days: number;
  premium90Days: number;
  promotion7Days: number;
  promotion30Days: number;
}

export const PREMIUM_PRICING: PremiumPricing = {
  premium7Days: 199,
  premium30Days: 499,
  premium90Days: 999,
  promotion7Days: 99,
  promotion30Days: 249,
};

// Free listings configuration
export const FREE_LISTINGS_LIMIT = 2;
export const LISTING_FEE_UAH = 250;

export interface CreatePaymentRequest {
  plotId: string;
  type: 'premium' | 'promotion';
  durationDays: number;
}

export interface CreatePaymentResponse {
  success: boolean;
  paymentIntent?: {
    id: string;
    amount: number;
    currency: string;
  };
  error?: string;
}

export interface ActivatePremiumRequest {
  plotId: string;
  type: 'premium' | 'promotion';
  durationDays: number;
}

export interface ActivatePremiumResponse {
  success: boolean;
  expiresAt?: Date;
  error?: string;
}

export const calculatePremiumPrice = (
  type: 'premium' | 'promotion',
  durationDays: number
): number => {
  if (type === 'premium') {
    if (durationDays <= 7) return PREMIUM_PRICING.premium7Days;
    if (durationDays <= 30) return PREMIUM_PRICING.premium30Days;
    return PREMIUM_PRICING.premium90Days;
  } else {
    if (durationDays <= 7) return PREMIUM_PRICING.promotion7Days;
    return PREMIUM_PRICING.promotion30Days;
  }
};

export const createPaymentIntent = async (
  request: CreatePaymentRequest
): Promise<CreatePaymentResponse> => {
  const amount = calculatePremiumPrice(request.type, request.durationDays);
  
  return {
    success: true,
    paymentIntent: {
      id: `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount,
      currency: 'UAH',
    },
  };
};

export const activatePremiumListing = async (
  request: ActivatePremiumRequest
): Promise<ActivatePremiumResponse> => {
  try {
    const activatePremium = httpsCallable<ActivatePremiumRequest, { success: boolean; expiresAt: string }>(
      functions,
      'activatePremiumListing'
    );
    
    const result = await activatePremium(request);
    
    if (!result.data.success) {
      throw new Error('Failed to activate premium listing');
    }
    
    return {
      success: true,
      expiresAt: new Date(result.data.expiresAt),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to activate premium listing',
    };
  }
};

export const formatPrice = (amount: number): string => {
  return `${amount.toLocaleString('uk-UA')} ₴`;
};

export const getPremiumBenefits = (type: 'premium' | 'promotion'): string[] => {
  if (type === 'premium') {
    return [
      'Виділення оголошення кольором',
      'Значок "Преміум"',
      'Пріоритет у пошуку',
      'Розширена статистика переглядів',
    ];
  } else {
    return [
      'Показ на початку списку',
      'Значок "Топ"',
      'Більше переглядів',
    ];
  }
};

/**
 * Check if premium status is expired
 */
export const isPremiumExpired = (expiresAt: Date | undefined): boolean => {
  if (!expiresAt) return true;
  return new Date() > expiresAt;
};

/**
 * Check if promotion status is expired
 */
export const isPromotionExpired = (expiresAt: Date | undefined): boolean => {
  if (!expiresAt) return true;
  return new Date() > expiresAt;
};

/**
 * Calculate days remaining until expiration
 */
export const getDaysRemaining = (expiresAt: Date | undefined): number => {
  if (!expiresAt) return 0;
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

/**
 * Format expiration date for display
 */
export const formatExpirationDate = (expiresAt: Date | undefined): string => {
  if (!expiresAt) return 'Не активовано';
  
  const daysRemaining = getDaysRemaining(expiresAt);
  
  if (daysRemaining === 0) {
    return 'Закінчується сьогодні';
  } else if (daysRemaining === 1) {
    return 'Закінчується завтра';
  } else if (daysRemaining <= 7) {
    return `Залишилось ${daysRemaining} днів`;
  } else {
    return expiresAt.toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
};

/**
 * Get premium status summary for a plot
 */
export interface PremiumStatus {
  isPremium: boolean;
  isPromoted: boolean;
  premiumDaysRemaining: number;
  promotionDaysRemaining: number;
  premiumExpirationText: string;
  promotionExpirationText: string;
}

export const getPremiumStatus = (
  premiumExpiresAt: Date | undefined,
  promotedExpiresAt: Date | undefined
): PremiumStatus => {
  const premiumExpired = isPremiumExpired(premiumExpiresAt);
  const promotionExpired = isPromotionExpired(promotedExpiresAt);
  
  return {
    isPremium: !premiumExpired,
    isPromoted: !promotionExpired,
    premiumDaysRemaining: getDaysRemaining(premiumExpiresAt),
    promotionDaysRemaining: getDaysRemaining(promotedExpiresAt),
    premiumExpirationText: formatExpirationDate(premiumExpiresAt),
    promotionExpirationText: formatExpirationDate(promotedExpiresAt),
  };
};

/**
 * Available premium packages
 */
export interface PremiumPackage {
  id: string;
  type: 'premium' | 'promotion';
  durationDays: number;
  price: number;
  label: string;
  description: string;
}

/**
 * Free listings logic - 2 free, 3rd+ requires payment
 */
export interface ListingPaymentStatus {
  requiresPayment: boolean;
  freeListingsUsed: number;
  freeListingsRemaining: number;
  listingFee: number;
}

export const getListingPaymentStatus = (userListingCount: number): ListingPaymentStatus => {
  const freeListingsUsed = Math.min(userListingCount, FREE_LISTINGS_LIMIT);
  const freeListingsRemaining = Math.max(0, FREE_LISTINGS_LIMIT - userListingCount);
  const requiresPayment = userListingCount >= FREE_LISTINGS_LIMIT;
  
  return {
    requiresPayment,
    freeListingsUsed,
    freeListingsRemaining,
    listingFee: requiresPayment ? LISTING_FEE_UAH : 0,
  };
};

export const getListingFeeText = (userListingCount: number): string => {
  const status = getListingPaymentStatus(userListingCount);
  
  if (!status.requiresPayment) {
    if (status.freeListingsRemaining === 1) {
      return 'Це ваше останнє безкоштовне оголошення';
    }
    return `Безкоштовно (залишилось ${status.freeListingsRemaining} безкоштовних)`;
  }
  
  return `${LISTING_FEE_UAH} ₴ за публікацію`;
};

export interface CreateListingPaymentRequest {
  userId: string;
  listingId: string;
}

export interface CreateListingPaymentResponse {
  success: boolean;
  paymentUrl?: string;
  invoiceId?: string;
  error?: string;
}

export const createListingPayment = async (
  request: CreateListingPaymentRequest
): Promise<CreateListingPaymentResponse> => {
  try {
    const createPayment = httpsCallable<CreateListingPaymentRequest, CreateListingPaymentResponse>(
      functions,
      'createListingPayment'
    );
    
    const result = await createPayment(request);
    return result.data;
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Не вдалося створити платіж',
    };
  }
};

export const PREMIUM_PACKAGES: PremiumPackage[] = [
  {
    id: 'premium-7',
    type: 'premium',
    durationDays: 7,
    price: PREMIUM_PRICING.premium7Days,
    label: 'Преміум 7 днів',
    description: 'Виділіть своє оголошення на тиждень',
  },
  {
    id: 'premium-30',
    type: 'premium',
    durationDays: 30,
    price: PREMIUM_PRICING.premium30Days,
    label: 'Преміум 30 днів',
    description: 'Найпопулярніший вибір',
  },
  {
    id: 'premium-90',
    type: 'premium',
    durationDays: 90,
    price: PREMIUM_PRICING.premium90Days,
    label: 'Преміум 90 днів',
    description: 'Найвигідніша пропозиція',
  },
  {
    id: 'promo-7',
    type: 'promotion',
    durationDays: 7,
    price: PREMIUM_PRICING.promotion7Days,
    label: 'Топ 7 днів',
    description: 'Показ на початку списку',
  },
  {
    id: 'promo-30',
    type: 'promotion',
    durationDays: 30,
    price: PREMIUM_PRICING.promotion30Days,
    label: 'Топ 30 днів',
    description: 'Максимум переглядів',
  },
];
