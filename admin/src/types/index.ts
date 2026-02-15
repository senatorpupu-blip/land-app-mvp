export type PlotStatus = 'pending' | 'approved' | 'hidden';

export interface LandPlot {
  id: string;
  title: string;
  description: string;
  area: number;
  pricePerSotka: number;
  totalPrice: number;
  zone: 'A' | 'B' | 'C';
  region: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
    geohash?: string;
  };
  cadastralNumber: string;
  cadastralVerified: boolean;
  photos: string[];
  ownerId: string;
  ownerPhone: string;
  isInvestmentPlot: boolean;
  isCreditAvailable: boolean;
  status: PlotStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  phoneNumber: string;
  displayName?: string;
  isBlocked: boolean;
  createdAt: Date;
}

export interface Report {
  id: string;
  plotId: string;
  reporterId: string;
  reason: string;
  status: 'pending' | 'resolved';
  createdAt: Date;
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

// User Roles
export type UserRole = 'user' | 'admin' | 'moderator';

export interface UserWithRole extends User {
  role: UserRole;
}
