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
  };
  cadastralNumber: string;
  cadastralVerified: boolean;
  photos: string[];
  ownerId: string;
  ownerPhone: string;
  isInvestmentPlot: boolean;
  isCreditAvailable: boolean;
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
}

// Auth Types
export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
