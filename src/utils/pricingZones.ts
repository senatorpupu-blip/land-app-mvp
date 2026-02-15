import { 
  OblastCenter, 
  PricingZone, 
  MarketStatus, 
  ComputedPricing,
  LandCategory,
  PricingRule
} from '../types';
import { OBLAST_CENTERS } from '../data/oblastCenters';

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

export const calculateHaversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return EARTH_RADIUS_KM * c;
};

export const determinePricingZone = (distanceKm: number): PricingZone => {
  if (distanceKm <= 5) {
    return 'urban_core';
  } else if (distanceKm <= 15) {
    return 'suburban_0_15';
  } else if (distanceKm <= 30) {
    return 'suburban_15_30';
  } else {
    return 'rural';
  }
};

export const findNearestOblastCenter = (
  latitude: number,
  longitude: number
): { oblastCenter: OblastCenter; distance: number } => {
  let nearestOblast: OblastCenter = OBLAST_CENTERS[0];
  let minDistance = Infinity;
  
  for (const oblast of OBLAST_CENTERS) {
    const distance = calculateHaversineDistance(
      latitude,
      longitude,
      oblast.latitude,
      oblast.longitude
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestOblast = oblast;
    }
  }
  
  return {
    oblastCenter: nearestOblast,
    distance: Math.round(minDistance * 100) / 100,
  };
};

export const determineMarketStatus = (
  pricePerSotka: number,
  minUSDPerSotka: number,
  maxUSDPerSotka: number,
  avgUSDPerSotka: number
): MarketStatus => {
  const lowerThreshold = avgUSDPerSotka * 0.85;
  const upperThreshold = avgUSDPerSotka * 1.15;
  
  if (pricePerSotka < lowerThreshold) {
    return 'below_market';
  } else if (pricePerSotka > upperThreshold) {
    return 'above_market';
  } else {
    return 'at_market';
  }
};

export const calculateComputedPricing = (
  latitude: number,
  longitude: number,
  area: number,
  pricePerSotka: number,
  pricingRule?: PricingRule
): ComputedPricing => {
  const { oblastCenter, distance } = findNearestOblastCenter(latitude, longitude);
  const pricingZone = determinePricingZone(distance);
  
  let recommendedMinUSD = 0;
  let recommendedMaxUSD = 0;
  let marketStatus: MarketStatus = 'at_market';
  
  if (pricingRule) {
    recommendedMinUSD = pricingRule.minUSDPerSotka * area;
    recommendedMaxUSD = pricingRule.maxUSDPerSotka * area;
    marketStatus = determineMarketStatus(
      pricePerSotka,
      pricingRule.minUSDPerSotka,
      pricingRule.maxUSDPerSotka,
      pricingRule.avgUSDPerSotka
    );
  }
  
  return {
    oblastId: oblastCenter.id,
    distanceToOblastCenter: distance,
    pricingZone,
    recommendedMinUSD,
    recommendedMaxUSD,
    marketStatus,
  };
};

export const getPricingZoneLabel = (zone: PricingZone): string => {
  switch (zone) {
    case 'urban_core':
      return 'Urban Core (0-5 km)';
    case 'suburban_0_15':
      return 'Suburban (5-15 km)';
    case 'suburban_15_30':
      return 'Suburban (15-30 km)';
    case 'rural':
      return 'Rural (30+ km)';
  }
};

export const getPricingZoneLabelUk = (zone: PricingZone): string => {
  switch (zone) {
    case 'urban_core':
      return 'Міський центр (0-5 км)';
    case 'suburban_0_15':
      return 'Приміська зона (5-15 км)';
    case 'suburban_15_30':
      return 'Приміська зона (15-30 км)';
    case 'rural':
      return 'Сільська місцевість (30+ км)';
  }
};

export const getMarketStatusLabel = (status: MarketStatus): string => {
  switch (status) {
    case 'below_market':
      return 'Below Market';
    case 'at_market':
      return 'At Market';
    case 'above_market':
      return 'Above Market';
  }
};

export const getMarketStatusLabelUk = (status: MarketStatus): string => {
  switch (status) {
    case 'below_market':
      return 'Нижче ринку';
    case 'at_market':
      return 'На рівні ринку';
    case 'above_market':
      return 'Вище ринку';
  }
};

export const getLandCategoryLabel = (category: LandCategory): string => {
  switch (category) {
    case 'agricultural':
      return 'Agricultural';
    case 'residential':
      return 'Residential';
    case 'commercial':
      return 'Commercial';
    case 'industrial':
      return 'Industrial';
    case 'recreational':
      return 'Recreational';
  }
};

export const getLandCategoryLabelUk = (category: LandCategory): string => {
  switch (category) {
    case 'agricultural':
      return 'Сільськогосподарські';
    case 'residential':
      return 'Житлової забудови';
    case 'commercial':
      return 'Комерційного призначення';
    case 'industrial':
      return 'Промисловості';
    case 'recreational':
      return 'Рекреаційного призначення';
  }
};
