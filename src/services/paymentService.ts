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
