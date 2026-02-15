import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../config/theme';
import { NewsArticle, NewsCategory } from '../types';
import {
  getPublishedNews,
  getFeaturedNews,
  getNewsByCategory,
  getNewsCategoryLabel,
  getAllNewsCategories,
  getOfflineCachedNews,
} from '../services/newsService';
import { uk } from '../localization/uk';

const { width } = Dimensions.get('window');
const CAROUSEL_HEIGHT = 200;

interface FeaturedCarouselProps {
  articles: NewsArticle[];
  onPress: (article: NewsArticle) => void;
}

const FeaturedCarousel: React.FC<FeaturedCarouselProps> = ({ articles, onPress }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  if (articles.length === 0) return null;

  return (
    <View style={styles.carouselContainer}>
      <Text style={styles.sectionTitle}>{uk.news.featured}</Text>
      <FlatList
        data={articles}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setActiveIndex(index);
        }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.carouselItem}
            onPress={() => onPress(item)}
            activeOpacity={0.9}
          >
            {item.coverImageUrl ? (
              <Image
                source={{ uri: item.coverImageUrl }}
                style={styles.carouselImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.carouselImage, styles.placeholderImage]}>
                <Text style={styles.placeholderText}>📰</Text>
              </View>
            )}
            <View style={styles.carouselOverlay}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>
                  {getNewsCategoryLabel(item.category)}
                </Text>
              </View>
              <Text style={styles.carouselTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.carouselMeta}>
                {item.readingTime} {uk.news.readingTime}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id}
      />
      <View style={styles.pagination}>
        {articles.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              index === activeIndex && styles.paginationDotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
};

interface CategoryFilterProps {
  selectedCategory: NewsCategory | null;
  onSelect: (category: NewsCategory | null) => void;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({ selectedCategory, onSelect }) => {
  const categories = getAllNewsCategories();

  return (
    <View style={styles.categoryFilterContainer}>
      <FlatList
        data={[{ value: null, label: uk.filters.all }, ...categories]}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.categoryChip,
              selectedCategory === item.value && styles.categoryChipActive,
            ]}
            onPress={() => onSelect(item.value as NewsCategory | null)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === item.value && styles.categoryChipTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.value || 'all'}
        contentContainerStyle={styles.categoryFilterContent}
      />
    </View>
  );
};

interface NewsCardProps {
  article: NewsArticle;
  onPress: () => void;
}

const NewsCard: React.FC<NewsCardProps> = ({ article, onPress }) => {
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <TouchableOpacity style={styles.newsCard} onPress={onPress} activeOpacity={0.8}>
      {article.coverImageUrl ? (
        <Image
          source={{ uri: article.coverImageUrl }}
          style={styles.newsCardImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.newsCardImage, styles.placeholderImageSmall]}>
          <Text style={styles.placeholderTextSmall}>📰</Text>
        </View>
      )}
      <View style={styles.newsCardContent}>
        <View style={styles.newsCardHeader}>
          <Text style={styles.newsCardCategory}>
            {getNewsCategoryLabel(article.category)}
          </Text>
          <Text style={styles.newsCardDate}>
            {article.publishedAt ? formatDate(article.publishedAt) : ''}
          </Text>
        </View>
        <Text style={styles.newsCardTitle} numberOfLines={2}>
          {article.title}
        </Text>
        <Text style={styles.newsCardDescription} numberOfLines={2}>
          {article.shortDescription}
        </Text>
        <View style={styles.newsCardFooter}>
          <Text style={styles.newsCardMeta}>
            {article.readingTime} {uk.news.readingTime}
          </Text>
          <Text style={styles.newsCardMeta}>
            {article.viewsCount} {uk.news.views}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const SkeletonCard: React.FC = () => (
  <View style={styles.skeletonCard}>
    <View style={styles.skeletonImage} />
    <View style={styles.skeletonContent}>
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
      <View style={[styles.skeletonLine, styles.skeletonLineMedium]} />
    </View>
  </View>
);

export const NewsListScreen: React.FC = () => {
  const navigation = useNavigation();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [featuredArticles, setFeaturedArticles] = useState<NewsArticle[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const loadNews = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
        setCursor(undefined);
      } else if (!refresh && !cursor) {
        setIsLoading(true);
      }
      setError(null);

      const [newsResponse, featured] = await Promise.all([
        selectedCategory
          ? getNewsByCategory(selectedCategory, 10, refresh ? undefined : cursor)
          : getPublishedNews(10, refresh ? undefined : cursor),
        refresh || !cursor ? getFeaturedNews(5) : Promise.resolve(featuredArticles),
      ]);

      if (refresh || !cursor) {
        setArticles(newsResponse.articles);
        setFeaturedArticles(featured);
      } else {
        setArticles((prev) => [...prev, ...newsResponse.articles]);
      }

      setHasMore(newsResponse.hasMore);
      setCursor(newsResponse.nextCursor);
    } catch (err) {
      setError(uk.errors.network);
      const cached = getOfflineCachedNews();
      if (cached.length > 0 && articles.length === 0) {
        setArticles(cached);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [selectedCategory, cursor, featuredArticles, articles.length]);

  useEffect(() => {
    loadNews(true);
  }, [selectedCategory]);

  const handleRefresh = () => {
    loadNews(true);
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore && !isLoading) {
      setIsLoadingMore(true);
      loadNews(false);
    }
  };

  const handleArticlePress = (article: NewsArticle) => {
    (navigation as any).navigate('NewsDetail', { articleId: article.id });
  };

  const handleCategoryChange = (category: NewsCategory | null) => {
    setSelectedCategory(category);
    setCursor(undefined);
    setArticles([]);
  };

  const renderHeader = () => (
    <View>
      <FeaturedCarousel articles={featuredArticles} onPress={handleArticlePress} />
      <CategoryFilter
        selectedCategory={selectedCategory}
        onSelect={handleCategoryChange}
      />
      <Text style={styles.sectionTitle}>{uk.news.latest}</Text>
    </View>
  );

  const renderFooter = () => {
    if (isLoadingMore) {
      return (
        <View style={styles.loadingMore}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      );
    }
    return null;
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.skeletonContainer}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📰</Text>
        <Text style={styles.emptyText}>{uk.news.noNews}</Text>
      </View>
    );
  };

  if (error && articles.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{uk.news.title}</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadNews(true)}>
            <Text style={styles.retryButtonText}>{uk.common.retry}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{uk.news.title}</Text>
      </View>
      <FlatList
        data={articles}
        renderItem={({ item }) => (
          <NewsCard article={item} onPress={() => handleArticlePress(item)} />
        )}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  carouselContainer: {
    marginBottom: 8,
  },
  carouselItem: {
    width: width - 32,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  carouselImage: {
    width: '100%',
    height: CAROUSEL_HEIGHT,
  },
  carouselOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  carouselTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  carouselMeta: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  categoryBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.border,
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: theme.colors.primary,
  },
  categoryFilterContainer: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  categoryFilterContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoryChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  categoryChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  newsCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  newsCardImage: {
    width: 120,
    height: 120,
  },
  newsCardContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  newsCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  newsCardCategory: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },
  newsCardDate: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  newsCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  newsCardDescription: {
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 16,
  },
  newsCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  newsCardMeta: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  placeholderImage: {
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 48,
  },
  placeholderImageSmall: {
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderTextSmall: {
    fontSize: 32,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  skeletonContainer: {
    paddingHorizontal: 16,
  },
  skeletonCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  skeletonImage: {
    width: 120,
    height: 120,
    backgroundColor: theme.colors.border,
  },
  skeletonContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  skeletonLine: {
    height: 12,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonLineShort: {
    width: '60%',
  },
  skeletonLineMedium: {
    width: '80%',
  },
});

export default NewsListScreen;
