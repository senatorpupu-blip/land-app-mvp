// Land Plot Types
export interface LandPlot {
  id: string;
  title: string;
  description: string;
  area: number; // in sotkas
  pricePerSotka: number;
  totalPrice: number;
  zone: 'A' | 'B' | 'C';
  region: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
    geohash?: string; // For geo queries (optional for backward compatibility)
  };
  cadastralNumber: string;
  cadastralVerified: boolean;
  photos: string[];
  ownerId: string;
  ownerPhone: string;
  isInvestmentPlot: boolean;
  isCreditAvailable: boolean;
  status: 'pending' | 'approved' | 'hidden';
  createdAt: Date;
  updatedAt: Date;
}

// User Types
export interface User {
  id: string;
  phoneNumber: string;
  displayName?: string;
  createdAt: Date;
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
  // Geo filters
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}

// Pagination Types
export interface PaginatedResult<T> {
  data: T[];
  lastDoc: unknown | null;
  hasMore: boolean;
}

export interface PaginationOptions {
  limit?: number;
  cursor?: unknown;
}

// Map Clustering Types
export interface MapCluster {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  plotIds: string[];
  geohash: string;
}

// User Roles
export type UserRole = 'user' | 'admin' | 'moderator';

export interface UserWithRole extends User {
  role: UserRole;
  isBlocked: boolean;
}

// Auth Types
export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
