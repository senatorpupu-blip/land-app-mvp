import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  Share,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { theme } from '../config/theme';
import { NewsArticle } from '../types';
import {
  getNewsById,
  incrementViewCount,
  getNewsCategoryLabel,
} from '../services/newsService';
import { uk } from '../localization/uk';

const { width } = Dimensions.get('window');

interface RouteParams {
  articleId: string;
}

const GalleryViewer: React.FC<{ images: string[] }> = ({ images }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) return null;

  return (
    <View style={styles.galleryContainer}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setActiveIndex(index);
        }}
      >
        {images.map((uri, index) => (
          <Image
            key={index}
            source={{ uri }}
            style={styles.galleryImage}
            resizeMode="cover"
          />
        ))}
      </ScrollView>
      {images.length > 1 && (
        <View style={styles.galleryPagination}>
          <Text style={styles.galleryPaginationText}>
            {activeIndex + 1} / {images.length}
          </Text>
        </View>
      )}
    </View>
  );
};

export const NewsDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { articleId } = route.params as RouteParams;

  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadArticle();
  }, [articleId]);

  const loadArticle = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await getNewsById(articleId);
      if (data) {
        setArticle(data);
        incrementViewCount(articleId).catch(() => {});
      } else {
        setError(uk.errors.notFound);
      }
    } catch (err) {
      setError(uk.errors.network);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    if (!article) return;

    try {
      await Share.share({
        title: article.title,
        message: `${article.title}\n\n${article.shortDescription}`,
      });
    } catch (err) {
      // Ignore share errors
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>{uk.common.loading}</Text>
      </View>
    );
  }

  if (error || !article) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>😔</Text>
        <Text style={styles.errorText}>{error || uk.errors.notFound}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadArticle}>
          <Text style={styles.retryButtonText}>{uk.common.retry}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>{uk.common.back}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.headerButtonText}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
          <Text style={styles.headerButtonText}>↗</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {article.coverImageUrl && (
          <Image
            source={{ uri: article.coverImageUrl }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        )}

        <View style={styles.content}>
          <View style={styles.metaRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>
                {getNewsCategoryLabel(article.category)}
              </Text>
            </View>
            <Text style={styles.readingTime}>
              {article.readingTime} {uk.news.readingTime}
            </Text>
          </View>

          <Text style={styles.title}>{article.title}</Text>

          <View style={styles.authorRow}>
            <View style={styles.authorInfo}>
              <View style={styles.authorAvatar}>
                <Text style={styles.authorAvatarText}>
                  {article.authorName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.authorName}>{article.authorName}</Text>
                <Text style={styles.authorRole}>
                  {article.authorRole === 'admin'
                    ? uk.profile.role.admin
                    : uk.profile.role.manager}
                </Text>
              </View>
            </View>
            <View style={styles.dateInfo}>
              {article.publishedAt && (
                <>
                  <Text style={styles.dateText}>
                    {formatDate(article.publishedAt)}
                  </Text>
                  <Text style={styles.timeText}>
                    {formatTime(article.publishedAt)}
                  </Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.statsRow}>
            <Text style={styles.statsText}>
              👁 {article.viewsCount} {uk.news.views}
            </Text>
          </View>

          <Text style={styles.shortDescription}>{article.shortDescription}</Text>

          <View style={styles.divider} />

          <Text style={styles.articleContent}>{article.content}</Text>

          {article.galleryImages && article.galleryImages.length > 0 && (
            <>
              <View style={styles.divider} />
              <GalleryViewer images={article.galleryImages} />
            </>
          )}

          {article.tags && article.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {article.tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Text style={styles.shareButtonText}>{uk.news.share}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonText: {
    fontSize: 20,
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  coverImage: {
    width: '100%',
    height: 300,
  },
  content: {
    padding: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  readingTime: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    lineHeight: 32,
    marginBottom: 16,
  },
  authorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  authorAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  authorRole: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  dateInfo: {
    alignItems: 'flex-end',
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  timeText: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  statsRow: {
    marginBottom: 16,
  },
  statsText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  shortDescription: {
    fontSize: 16,
    color: theme.colors.text,
    fontStyle: 'italic',
    lineHeight: 24,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 16,
  },
  articleContent: {
    fontSize: 16,
    color: theme.colors.text,
    lineHeight: 26,
  },
  galleryContainer: {
    marginVertical: 16,
  },
  galleryImage: {
    width: width - 32,
    height: 200,
    borderRadius: 8,
  },
  galleryPagination: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  galleryPaginationText: {
    fontSize: 12,
    color: '#fff',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
  },
  tag: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tagText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  shareButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 20,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
});

export default NewsDetailScreen;
