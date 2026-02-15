/**
 * Shared Firestore document parsing utilities
 * Reduces duplication across service layer
 */

import { DocumentSnapshot, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { LandPlot, NewsArticle } from '../types';

/**
 * Safely converts Firestore Timestamp to Date
 */
export const toDate = (timestamp: unknown): Date | undefined => {
  if (!timestamp) return undefined;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'object' && 'toDate' in timestamp) {
    return (timestamp as { toDate: () => Date }).toDate();
  }
  return undefined;
};

/**
 * Safely converts Firestore Timestamp to Date with fallback
 */
export const toDateOrNow = (timestamp: unknown): Date => {
  return toDate(timestamp) || new Date();
};

/**
 * Parse a Firestore document into a LandPlot object
 * Handles all date conversions and nested objects safely
 */
export const parsePlotDocument = (
  doc: DocumentSnapshot | QueryDocumentSnapshot<DocumentData>
): LandPlot | null => {
  if (!doc.exists()) return null;
  
  const data = doc.data();
  if (!data) return null;

  // Validate required fields
  if (!data.location?.latitude || !data.location?.longitude) {
    return null;
  }

  return {
    id: doc.id,
    title: data.title || '',
    description: data.description || '',
    area: data.area || 0,
    pricePerSotka: data.pricePerSotka || 0,
    totalPrice: data.totalPrice || 0,
    zone: data.zone || 'A',
    region: data.region || '',
    oblast: data.oblast,
    category: data.category,
    location: {
      latitude: data.location.latitude,
      longitude: data.location.longitude,
      address: data.location?.address || '',
    },
    cadastralNumber: data.cadastralNumber || '',
    cadastralVerified: data.cadastralVerified || false,
    cadastralValidationStatus: data.cadastralValidationStatus,
    photos: data.photos || [],
    ownerId: data.ownerId || '',
    ownerPhone: data.ownerPhone || '',
    isInvestmentPlot: data.isInvestmentPlot || false,
    isCreditAvailable: data.isCreditAvailable || false,
    status: data.status || 'pending',
    pricing: data.pricing,
    createdAt: toDateOrNow(data.createdAt),
    updatedAt: toDateOrNow(data.updatedAt),
    approvedAt: toDate(data.approvedAt),
    rejectedAt: toDate(data.rejectedAt),
    deletedAt: toDate(data.deletedAt),
    intelligence: data.intelligence ? {
      ...data.intelligence,
      lastCalculatedAt: toDateOrNow(data.intelligence.lastCalculatedAt),
    } : undefined,
    premium: data.premium ? {
      ...data.premium,
      premiumExpiresAt: toDate(data.premium.premiumExpiresAt),
      promotedExpiresAt: toDate(data.premium.promotedExpiresAt),
      premiumPurchasedAt: toDate(data.premium.premiumPurchasedAt),
    } : undefined,
  } as LandPlot;
};

/**
 * Parse a Firestore document into a NewsArticle object
 */
export const parseNewsDocument = (
  doc: DocumentSnapshot | QueryDocumentSnapshot<DocumentData>
): NewsArticle | null => {
  if (!doc.exists()) return null;
  
  const data = doc.data();
  if (!data) return null;

  return {
    id: doc.id,
    title: data.title || '',
    slug: data.slug || '',
    shortDescription: data.shortDescription || '',
    content: data.content || '',
    coverImageUrl: data.coverImageUrl || '',
    galleryImages: data.galleryImages || [],
    category: data.category || 'other',
    tags: data.tags || [],
    authorId: data.authorId || '',
    authorName: data.authorName || '',
    authorRole: data.authorRole || 'admin',
    readingTime: data.readingTime || 1,
    viewsCount: data.viewsCount || 0,
    status: data.status || 'draft',
    isFeatured: data.isFeatured || false,
    metaData: data.metaData || {},
    createdAt: toDateOrNow(data.createdAt),
    updatedAt: toDateOrNow(data.updatedAt),
    publishedAt: toDate(data.publishedAt),
  } as NewsArticle;
};

/**
 * Check if a plot is promoted and the promotion is still active
 */
export const isPromotedAndActive = (plot: LandPlot): boolean => {
  if (!plot.premium?.isPromoted) return false;
  if (!plot.premium.promotedExpiresAt) return true;
  return new Date() < plot.premium.promotedExpiresAt;
};

/**
 * Check if a plot is premium and the premium is still active
 */
export const isPremiumAndActive = (plot: LandPlot): boolean => {
  if (!plot.premium?.isPremium) return false;
  if (!plot.premium.premiumExpiresAt) return true;
  return new Date() < plot.premium.premiumExpiresAt;
};

/**
 * Sort plots with promoted listings first
 */
export const sortWithPromotedFirst = (plots: LandPlot[]): LandPlot[] => {
  const promoted = plots.filter(isPromotedAndActive);
  const regular = plots.filter(p => !isPromotedAndActive(p));
  return [...promoted, ...regular];
};
