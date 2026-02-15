// Pricing Zone Types
export type PricingZone = 'urban_core' | 'suburban_0_15' | 'suburban_15_30' | 'rural';

// Land Category Types (5 categories for Ukrainian land)
export type LandCategory = 
  | 'agricultural'      // Сільськогосподарські землі
  | 'residential'       // Землі житлової забудови
  | 'commercial'        // Землі комерційного призначення
  | 'industrial'        // Землі промисловості
  | 'recreational';     // Землі рекреаційного призначення

// Market Status based on price comparison
export type MarketStatus = 'below_market' | 'at_market' | 'above_market';

// Oblast Center for distance calculations
export interface OblastCenter {
  id: string;
  name: string;
  nameUk: string; // Ukrainian name
  latitude: number;
  longitude: number;
  oblastCode: string; // e.g., "01" for Vinnytsia
}

// Pricing Rule for zone-based pricing
export interface PricingRule {
  id: string;
  oblast: string;
  category: LandCategory;
  zone: PricingZone;
  minUSDPerSotka: number;
  avgUSDPerSotka: number;
  maxUSDPerSotka: number;
  updatedAt: Date;
}

// Computed pricing fields for LandPlot
export interface ComputedPricing {
  oblastId: string;
  distanceToOblastCenter: number; // in km
  pricingZone: PricingZone;
  recommendedMinUSD: number;
  recommendedMaxUSD: number;
  marketStatus: MarketStatus;
}

// Land Plot Types
export interface LandPlot {
  id: string;
  title: string;
  description: string;
  area: number; // in sotkas
  pricePerSotka: number;
  totalPrice: number;
  zone: 'A' | 'B' | 'C'; // Legacy zone field
  region: string;
  oblast?: string; // Ukrainian oblast
  category?: LandCategory;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  cadastralNumber: string;
  cadastralVerified: boolean;
  cadastralValidationStatus?: 'pending' | 'valid' | 'invalid';
  photos: string[];
  ownerId: string;
  ownerPhone: string;
  isInvestmentPlot: boolean;
  isCreditAvailable: boolean;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'deleted';
  rejectReason?: string;
  approvedAt?: Date;
  rejectedAt?: Date;
  deletedAt?: Date;
  approvedBy?: string;
  rejectedBy?: string;
  // Computed pricing fields
  pricing?: ComputedPricing;
  createdAt: Date;
  updatedAt: Date;
}

// User Role Types
export type UserRole = 'buyer' | 'seller' | 'admin';

// User Types
export interface User {
  id: string;
  phoneNumber?: string;
  email?: string;
  displayName?: string;
  role: UserRole;
  isBlocked?: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

// Chat Types
export interface Chat {
  id: string;
  plotId: string;
  ownerId: string;
  clientId: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  createdAt: Date;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: Date;
  read: boolean;
}

// Filter Types
export interface PlotFilters {
  minPrice?: number;
  maxPrice?: number;
  zone?: 'A' | 'B' | 'C';
  region?: string;
}

// Auth Types
export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
