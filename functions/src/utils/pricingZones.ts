import { OBLAST_CENTERS } from '../data/oblastCenters';
import { OblastCenter, PricingZone, MarketStatus, LandCategory } from '../types';

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
  minUSD: number,
  maxUSD: number,
  avgUSD: number
): MarketStatus => {
  if (pricePerSotka < minUSD) {
    return 'below_market';
  } else if (pricePerSotka > maxUSD) {
    return 'above_market';
  } else {
    return 'at_market';
  }
};

export const NATIONAL_DEFAULT_PRICES: Record<LandCategory, Record<PricingZone, { min: number; avg: number; max: number }>> = {
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

export const VALID_CATEGORIES: LandCategory[] = [
  'agricultural',
  'residential',
  'commercial',
  'industrial',
  'recreational',
];

export const isValidCategory = (category: string): category is LandCategory => {
  return VALID_CATEGORIES.includes(category as LandCategory);
};

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export const encodeGeohash = (latitude: number, longitude: number, precision: number = 9): string => {
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;
  let hash = '';
  let bit = 0;
  let ch = 0;
  let isLng = true;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (lngMin + lngMax) / 2;
      if (longitude >= mid) {
        ch |= (1 << (4 - bit));
        lngMin = mid;
      } else {
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (latitude >= mid) {
        ch |= (1 << (4 - bit));
        latMin = mid;
      } else {
        latMax = mid;
      }
    }

    isLng = !isLng;
    bit++;

    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
};

export const getGeohashNeighbors = (geohash: string): string[] => {
  const neighbors: string[] = [geohash];
  const precision = geohash.length;
  
  if (precision > 1) {
    const parent = geohash.slice(0, -1);
    for (let i = 0; i < 32; i++) {
      const neighbor = parent + BASE32[i];
      if (neighbor !== geohash) {
        neighbors.push(neighbor);
      }
    }
  }
  
  return neighbors;
};
