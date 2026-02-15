import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  DocumentSnapshot,
  increment,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../config/firebase';
import { 
  NewsArticle, 
  NewsStatus, 
  NewsCategory, 
  NewsListResponse,
  NewsAuthorRole,
} from '../types';

const NEWS_COLLECTION = 'news';
const DEFAULT_PAGE_SIZE = 10;
const OFFLINE_CACHE_SIZE = 10;

let offlineCache: NewsArticle[] = [];

export const generateSlug = (title: string): string => {
  const translitMap: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'h', 'ґ': 'g', 'д': 'd', 'е': 'e', 'є': 'ye',
    'ж': 'zh', 'з': 'z', 'и': 'y', 'і': 'i', 'ї': 'yi', 'й': 'y', 'к': 'k', 'л': 'l',
    'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ь': '', 'ю': 'yu',
    'я': 'ya', "'": '', 'ъ': '', 'ы': 'y', 'э': 'e',
  };
  
  return title
    .toLowerCase()
    .split('')
    .map(char => translitMap[char] || char)
    .join('')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
};

export const calculateReadingTime = (content: string): number => {
  const wordsPerMinute = 200;
  const wordCount = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
};

const parseFirestoreArticle = (doc: DocumentSnapshot): NewsArticle | null => {
  if (!doc.exists()) return null;
  
  const data = doc.data();
  if (!data) return null;
  
  return {
    id: doc.id,
    title: data.title || '',
    slug: data.slug || '',
    shortDescription: data.shortDescription || '',
    content: data.content || '',
    coverImageUrl: data.coverImageUrl,
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
    metaData: data.metaData,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    publishedAt: data.publishedAt?.toDate(),
  };
};

export const getPublishedNews = async (
  pageSize: number = DEFAULT_PAGE_SIZE,
  cursor?: string
): Promise<NewsListResponse> => {
  try {
    let q = query(
      collection(db, NEWS_COLLECTION),
      where('status', '==', 'published'),
      orderBy('publishedAt', 'desc'),
      limit(pageSize + 1)
    );
    
    if (cursor) {
      const cursorDoc = await getDoc(doc(db, NEWS_COLLECTION, cursor));
      if (cursorDoc.exists()) {
        q = query(
          collection(db, NEWS_COLLECTION),
          where('status', '==', 'published'),
          orderBy('publishedAt', 'desc'),
          startAfter(cursorDoc),
          limit(pageSize + 1)
        );
      }
    }
    
    const snapshot = await getDocs(q);
    const articles: NewsArticle[] = [];
    
    snapshot.docs.forEach((docSnap, index) => {
      if (index < pageSize) {
        const article = parseFirestoreArticle(docSnap);
        if (article) articles.push(article);
      }
    });
    
    if (!cursor && articles.length > 0) {
      offlineCache = articles.slice(0, OFFLINE_CACHE_SIZE);
    }
    
    return {
      articles,
      hasMore: snapshot.docs.length > pageSize,
      nextCursor: articles.length > 0 ? articles[articles.length - 1].id : undefined,
      totalCount: articles.length,
    };
  } catch (error) {
    if (offlineCache.length > 0) {
      return {
        articles: offlineCache,
        hasMore: false,
        totalCount: offlineCache.length,
      };
    }
    throw error;
  }
};

export const getFeaturedNews = async (limitCount: number = 5): Promise<NewsArticle[]> => {
  const q = query(
    collection(db, NEWS_COLLECTION),
    where('status', '==', 'published'),
    where('isFeatured', '==', true),
    orderBy('publishedAt', 'desc'),
    limit(limitCount)
  );
  
  const snapshot = await getDocs(q);
  const articles: NewsArticle[] = [];
  
  snapshot.docs.forEach(docSnap => {
    const article = parseFirestoreArticle(docSnap);
    if (article) articles.push(article);
  });
  
  return articles;
};

export const getNewsByCategory = async (
  category: NewsCategory,
  pageSize: number = DEFAULT_PAGE_SIZE,
  cursor?: string
): Promise<NewsListResponse> => {
  let q = query(
    collection(db, NEWS_COLLECTION),
    where('status', '==', 'published'),
    where('category', '==', category),
    orderBy('publishedAt', 'desc'),
    limit(pageSize + 1)
  );
  
  if (cursor) {
    const cursorDoc = await getDoc(doc(db, NEWS_COLLECTION, cursor));
    if (cursorDoc.exists()) {
      q = query(
        collection(db, NEWS_COLLECTION),
        where('status', '==', 'published'),
        where('category', '==', category),
        orderBy('publishedAt', 'desc'),
        startAfter(cursorDoc),
        limit(pageSize + 1)
      );
    }
  }
  
  const snapshot = await getDocs(q);
  const articles: NewsArticle[] = [];
  
  snapshot.docs.forEach((docSnap, index) => {
    if (index < pageSize) {
      const article = parseFirestoreArticle(docSnap);
      if (article) articles.push(article);
    }
  });
  
  return {
    articles,
    hasMore: snapshot.docs.length > pageSize,
    nextCursor: articles.length > 0 ? articles[articles.length - 1].id : undefined,
    totalCount: articles.length,
  };
};

export const getNewsById = async (id: string): Promise<NewsArticle | null> => {
  const docRef = doc(db, NEWS_COLLECTION, id);
  const docSnap = await getDoc(docRef);
  return parseFirestoreArticle(docSnap);
};

export const getNewsBySlug = async (slug: string): Promise<NewsArticle | null> => {
  const q = query(
    collection(db, NEWS_COLLECTION),
    where('slug', '==', slug),
    where('status', '==', 'published'),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  return parseFirestoreArticle(snapshot.docs[0]);
};

export const incrementViewCount = async (articleId: string): Promise<void> => {
  try {
    const incrementViews = httpsCallable(functions, 'incrementNewsViews');
    await incrementViews({ articleId });
  } catch (error) {
    const docRef = doc(db, NEWS_COLLECTION, articleId);
    await updateDoc(docRef, {
      viewsCount: increment(1),
    });
  }
};

export const subscribeToPublishedNews = (
  callback: (articles: NewsArticle[]) => void,
  limitCount: number = DEFAULT_PAGE_SIZE
): (() => void) => {
  const q = query(
    collection(db, NEWS_COLLECTION),
    where('status', '==', 'published'),
    orderBy('publishedAt', 'desc'),
    limit(limitCount)
  );
  
  return onSnapshot(q, (snapshot) => {
    const articles: NewsArticle[] = [];
    snapshot.docs.forEach(docSnap => {
      const article = parseFirestoreArticle(docSnap);
      if (article) articles.push(article);
    });
    callback(articles);
  });
};

export const getAllNewsForAdmin = async (
  statusFilter?: NewsStatus,
  categoryFilter?: NewsCategory,
  searchQuery?: string,
  pageSize: number = 20,
  cursor?: string
): Promise<NewsListResponse> => {
  let q = query(
    collection(db, NEWS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1)
  );
  
  if (statusFilter) {
    q = query(
      collection(db, NEWS_COLLECTION),
      where('status', '==', statusFilter),
      orderBy('createdAt', 'desc'),
      limit(pageSize + 1)
    );
  }
  
  if (cursor) {
    const cursorDoc = await getDoc(doc(db, NEWS_COLLECTION, cursor));
    if (cursorDoc.exists()) {
      if (statusFilter) {
        q = query(
          collection(db, NEWS_COLLECTION),
          where('status', '==', statusFilter),
          orderBy('createdAt', 'desc'),
          startAfter(cursorDoc),
          limit(pageSize + 1)
        );
      } else {
        q = query(
          collection(db, NEWS_COLLECTION),
          orderBy('createdAt', 'desc'),
          startAfter(cursorDoc),
          limit(pageSize + 1)
        );
      }
    }
  }
  
  const snapshot = await getDocs(q);
  let articles: NewsArticle[] = [];
  
  snapshot.docs.forEach((docSnap, index) => {
    if (index < pageSize) {
      const article = parseFirestoreArticle(docSnap);
      if (article) articles.push(article);
    }
  });
  
  if (categoryFilter) {
    articles = articles.filter(a => a.category === categoryFilter);
  }
  
  if (searchQuery) {
    const lowerQuery = searchQuery.toLowerCase();
    articles = articles.filter(a => 
      a.title.toLowerCase().includes(lowerQuery) ||
      a.shortDescription.toLowerCase().includes(lowerQuery)
    );
  }
  
  return {
    articles,
    hasMore: snapshot.docs.length > pageSize,
    nextCursor: articles.length > 0 ? articles[articles.length - 1].id : undefined,
    totalCount: articles.length,
  };
};

export interface CreateNewsInput {
  title: string;
  shortDescription: string;
  content: string;
  category: NewsCategory;
  tags: string[];
  coverImageUrl?: string;
  galleryImages?: string[];
  isFeatured?: boolean;
  status?: NewsStatus;
  authorId: string;
  authorName: string;
  authorRole: NewsAuthorRole;
}

export const createNewsArticle = async (input: CreateNewsInput): Promise<string> => {
  const baseSlug = generateSlug(input.title);
  const timestamp = Date.now();
  const slug = `${baseSlug}-${timestamp}`;
  
  const readingTime = calculateReadingTime(input.content);
  
  const articleData = {
    title: input.title,
    slug,
    shortDescription: input.shortDescription,
    content: input.content,
    category: input.category,
    tags: input.tags,
    coverImageUrl: input.coverImageUrl || null,
    galleryImages: input.galleryImages || [],
    isFeatured: input.isFeatured || false,
    status: input.status || 'draft',
    authorId: input.authorId,
    authorName: input.authorName,
    authorRole: input.authorRole,
    readingTime,
    viewsCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    publishedAt: input.status === 'published' ? serverTimestamp() : null,
  };
  
  const docRef = await addDoc(collection(db, NEWS_COLLECTION), articleData);
  return docRef.id;
};

export interface UpdateNewsInput {
  title?: string;
  shortDescription?: string;
  content?: string;
  category?: NewsCategory;
  tags?: string[];
  coverImageUrl?: string;
  galleryImages?: string[];
  isFeatured?: boolean;
  status?: NewsStatus;
}

export const updateNewsArticle = async (
  articleId: string, 
  input: UpdateNewsInput
): Promise<void> => {
  const docRef = doc(db, NEWS_COLLECTION, articleId);
  const existingDoc = await getDoc(docRef);
  
  if (!existingDoc.exists()) {
    throw new Error('Статтю не знайдено');
  }
  
  const existingData = existingDoc.data();
  const updates: Record<string, unknown> = {
    ...input,
    updatedAt: serverTimestamp(),
  };
  
  if (input.content) {
    updates.readingTime = calculateReadingTime(input.content);
  }
  
  if (input.title && input.title !== existingData.title) {
    const baseSlug = generateSlug(input.title);
    const timestamp = Date.now();
    updates.slug = `${baseSlug}-${timestamp}`;
  }
  
  if (input.status === 'published' && existingData.status !== 'published') {
    updates.publishedAt = serverTimestamp();
  }
  
  await updateDoc(docRef, updates);
};

export const publishArticle = async (articleId: string): Promise<void> => {
  const docRef = doc(db, NEWS_COLLECTION, articleId);
  await updateDoc(docRef, {
    status: 'published',
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const unpublishArticle = async (articleId: string): Promise<void> => {
  const docRef = doc(db, NEWS_COLLECTION, articleId);
  await updateDoc(docRef, {
    status: 'draft',
    updatedAt: serverTimestamp(),
  });
};

export const archiveArticle = async (articleId: string): Promise<void> => {
  const docRef = doc(db, NEWS_COLLECTION, articleId);
  await updateDoc(docRef, {
    status: 'archived',
    updatedAt: serverTimestamp(),
  });
};

export const toggleFeatured = async (articleId: string, isFeatured: boolean): Promise<void> => {
  const docRef = doc(db, NEWS_COLLECTION, articleId);
  await updateDoc(docRef, {
    isFeatured,
    updatedAt: serverTimestamp(),
  });
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const uploadNewsImage = async (
  uri: string,
  articleId: string,
  imageType: 'cover' | 'gallery'
): Promise<string> => {
  const response = await fetch(uri);
  const blob = await response.blob();
  
  if (blob.size > MAX_IMAGE_SIZE) {
    throw new Error('Розмір зображення перевищує 5MB');
  }
  
  if (!ALLOWED_IMAGE_TYPES.includes(blob.type)) {
    throw new Error('Дозволені формати: JPG, PNG, WebP');
  }
  
  const timestamp = Date.now();
  const extension = blob.type.split('/')[1];
  const path = `news/${articleId}/${imageType}_${timestamp}.${extension}`;
  
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob);
  
  return getDownloadURL(storageRef);
};

export const getOfflineCachedNews = (): NewsArticle[] => {
  return offlineCache;
};

export const clearOfflineCache = (): void => {
  offlineCache = [];
};

export const getNewsCategoryLabel = (category: NewsCategory): string => {
  const labels: Record<NewsCategory, string> = {
    'market-analysis': 'Аналіз ринку',
    'legislation': 'Законодавство',
    'platform-news': 'Новини платформи',
    'investment': 'Інвестиції',
    'other': 'Інше',
  };
  return labels[category];
};

export const getAllNewsCategories = (): { value: NewsCategory; label: string }[] => {
  return [
    { value: 'market-analysis', label: 'Аналіз ринку' },
    { value: 'legislation', label: 'Законодавство' },
    { value: 'platform-news', label: 'Новини платформи' },
    { value: 'investment', label: 'Інвестиції' },
    { value: 'other', label: 'Інше' },
  ];
};
