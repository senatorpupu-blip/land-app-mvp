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
