export type PricingZone = 'urban_core' | 'suburban_0_15' | 'suburban_15_30' | 'rural';

export type LandCategory = 
  | 'agricultural'
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'recreational';

export type MarketStatus = 'below_market' | 'at_market' | 'above_market';

export type PlotStatus = 'pending' | 'approved' | 'hidden';

export interface OblastCenter {
  id: string;
  name: string;
  nameUk: string;
  latitude: number;
  longitude: number;
  oblastCode: string;
}

export interface PricingRule {
  id: string;
  oblast: string;
  category: LandCategory;
  zone: PricingZone;
  minUSDPerSotka: number;
  avgUSDPerSotka: number;
  maxUSDPerSotka: number;
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface ComputedPricing {
  oblastId: string;
  distanceToOblastCenter: number;
  pricingZone: PricingZone;
  recommendedMinUSD: number;
  recommendedMaxUSD: number;
  marketStatus: MarketStatus;
}

export interface PlotLocation {
  latitude: number;
  longitude: number;
  address: string;
}

export interface CreateLandPlotRequest {
  title: string;
  description: string;
  area: number;
  pricePerSotka: number;
  zone: 'A' | 'B' | 'C';
  region: string;
  location: PlotLocation;
  cadastralNumber: string;
  photos: string[];
  isInvestmentPlot: boolean;
  isCreditAvailable: boolean;
  category?: LandCategory;
  oblast?: string;
}

export interface LandPlot {
  id: string;
  title: string;
  description: string;
  area: number;
  pricePerSotka: number;
  totalPrice: number;
  zone: 'A' | 'B' | 'C';
  region: string;
  location: PlotLocation;
  cadastralNumber: string;
  cadastralVerified: boolean;
  cadastralValidationStatus: 'pending' | 'valid' | 'invalid';
  photos: string[];
  ownerId: string;
  ownerPhone: string;
  isInvestmentPlot: boolean;
  isCreditAvailable: boolean;
  status: PlotStatus;
  category?: LandCategory;
  oblast?: string;
  pricing?: ComputedPricing;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}
