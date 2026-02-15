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

// Land Intelligence computed fields
export interface LandIntelligence {
  pricePerHectare: number;
  priceVsOblastAverage: number;
  investmentScore: number;
  lastCalculatedAt: Date;
}

// Premium listing fields
export interface PremiumListing {
  isPremium: boolean;
  isPromoted: boolean;
  premiumExpiresAt?: Date;
  promotedExpiresAt?: Date;
  premiumPurchasedAt?: Date;
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
    geohash?: string;
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
  // Land intelligence fields
  intelligence?: LandIntelligence;
  // Premium listing fields
  premium?: PremiumListing;
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
  isSoftBanned?: boolean;
  softBanReason?: string;
  softBannedAt?: Date;
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

// Advanced Search Filter Types
export interface SearchFilters {
  oblast?: string;
  region?: string;
  boundingBox?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
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
}

// Search result with pagination
export interface SearchResult {
  plots: LandPlot[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

// Legacy Filter Types (for backward compatibility)
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

// Land Analytics Types
export interface OblastAnalytics {
  id: string;
  oblast: string;
  category: LandCategory;
  averagePricePerSotka: number;
  medianPricePerSotka: number;
  minPricePerSotka: number;
  maxPricePerSotka: number;
  totalListings: number;
  approvedListings: number;
  calculatedAt: Date;
}

// Admin Analytics Types
export interface AdminAnalytics {
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
}

// Payment abstraction types
export interface PaymentIntent {
  id: string;
  userId: string;
  plotId: string;
  type: 'premium' | 'promotion';
  amount: number;
  currency: 'UAH';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
}

// News & Content Types
export type NewsStatus = 'draft' | 'published' | 'archived';
export type NewsAuthorRole = 'admin' | 'manager';
export type NewsCategory = 
  | 'market-analysis'    // Аналіз ринку
  | 'legislation'        // Законодавство
  | 'platform-news'      // Новини платформи
  | 'investment'         // Інвестиції
  | 'other';             // Інше

export interface NewsMetaData {
  description?: string;
  keywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  content: string;
  coverImageUrl?: string;
  galleryImages: string[];
  category: NewsCategory;
  tags: string[];
  authorId: string;
  authorName: string;
  authorRole: NewsAuthorRole;
  readingTime: number;
  viewsCount: number;
  status: NewsStatus;
  isFeatured: boolean;
  metaData?: NewsMetaData;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

export interface NewsListResponse {
  articles: NewsArticle[];
  hasMore: boolean;
  nextCursor?: string;
  totalCount: number;
}

export interface TrendingScore {
  articleId: string;
  score: number;
  viewsLast24h: number;
  viewsLast7d: number;
  recencyBoost: number;
}
