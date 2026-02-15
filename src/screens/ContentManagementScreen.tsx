import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import { NewsArticle, NewsStatus, NewsCategory, NewsAuthorRole } from '../types';
import {
  getAllNewsForAdmin,
  createNewsArticle,
  updateNewsArticle,
  publishArticle,
  unpublishArticle,
  archiveArticle,
  toggleFeatured,
  uploadNewsImage,
  getAllNewsCategories,
  getNewsCategoryLabel,
  CreateNewsInput,
  UpdateNewsInput,
} from '../services/newsService';
import { uk } from '../localization/uk';

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_CONTENT_LENGTH = 50000;

interface ArticleFormData {
  title: string;
  shortDescription: string;
  content: string;
  category: NewsCategory;
  tags: string;
  coverImageUrl: string;
  isFeatured: boolean;
}

const initialFormData: ArticleFormData = {
  title: '',
  shortDescription: '',
  content: '',
  category: 'other',
  tags: '',
  coverImageUrl: '',
  isFeatured: false,
};

const StatusBadge: React.FC<{ status: NewsStatus }> = ({ status }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'published':
        return theme.colors.success;
      case 'draft':
        return theme.colors.warning;
      case 'archived':
        return theme.colors.textMuted;
      default:
        return theme.colors.textMuted;
    }
  };

  const getStatusLabel = () => {
    return uk.news.admin.status[status] || status;
  };

  return (
    <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
      <Text style={styles.statusBadgeText}>{getStatusLabel()}</Text>
    </View>
  );
};

interface ArticleCardProps {
  article: NewsArticle;
  onEdit: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onArchive: () => void;
  onToggleFeatured: () => void;
}

const ArticleCard: React.FC<ArticleCardProps> = ({
  article,
  onEdit,
  onPublish,
  onUnpublish,
  onArchive,
  onToggleFeatured,
}) => {
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <View style={styles.articleCard}>
      <View style={styles.articleCardHeader}>
        {article.coverImageUrl ? (
          <Image
            source={{ uri: article.coverImageUrl }}
            style={styles.articleThumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.articleThumbnail, styles.placeholderThumbnail]}>
            <Text style={styles.placeholderText}>📰</Text>
          </View>
        )}
        <View style={styles.articleInfo}>
          <View style={styles.articleMeta}>
            <StatusBadge status={article.status} />
            {article.isFeatured && (
              <View style={styles.featuredBadge}>
                <Text style={styles.featuredBadgeText}>⭐</Text>
              </View>
            )}
          </View>
          <Text style={styles.articleTitle} numberOfLines={2}>
            {article.title}
          </Text>
          <Text style={styles.articleCategory}>
            {getNewsCategoryLabel(article.category)}
          </Text>
          <Text style={styles.articleDate}>
            {formatDate(article.createdAt)}
          </Text>
        </View>
      </View>

      <View style={styles.articleActions}>
        <TouchableOpacity style={styles.actionButton} onPress={onEdit}>
          <Text style={styles.actionButtonText}>{uk.common.edit}</Text>
        </TouchableOpacity>

        {article.status === 'draft' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.publishButton]}
            onPress={onPublish}
          >
            <Text style={styles.actionButtonTextLight}>
              {uk.news.admin.publish}
            </Text>
          </TouchableOpacity>
        )}

        {article.status === 'published' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.unpublishButton]}
            onPress={onUnpublish}
          >
            <Text style={styles.actionButtonText}>
              {uk.news.admin.unpublish}
            </Text>
          </TouchableOpacity>
        )}

        {article.status !== 'archived' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.archiveButton]}
            onPress={onArchive}
          >
            <Text style={styles.actionButtonText}>{uk.news.admin.archive}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.actionButton} onPress={onToggleFeatured}>
          <Text style={styles.actionButtonText}>
            {article.isFeatured
              ? uk.news.admin.unmarkFeatured
              : uk.news.admin.markFeatured}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface ArticleEditorModalProps {
  visible: boolean;
  article: NewsArticle | null;
  onClose: () => void;
  onSave: (data: ArticleFormData, isNew: boolean) => Promise<void>;
  isSaving: boolean;
}

const ArticleEditorModal: React.FC<ArticleEditorModalProps> = ({
  visible,
  article,
  onClose,
  onSave,
  isSaving,
}) => {
  const [formData, setFormData] = useState<ArticleFormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof ArticleFormData, string>>>({});
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    if (article) {
      setFormData({
        title: article.title,
        shortDescription: article.shortDescription,
        content: article.content,
        category: article.category,
        tags: article.tags.join(', '),
        coverImageUrl: article.coverImageUrl || '',
        isFeatured: article.isFeatured,
      });
    } else {
      setFormData(initialFormData);
    }
    setErrors({});
  }, [article, visible]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ArticleFormData, string>> = {};

    if (!formData.title.trim()) {
      newErrors.title = uk.news.admin.validation.titleRequired;
    } else if (formData.title.length > MAX_TITLE_LENGTH) {
      newErrors.title = uk.news.admin.validation.titleTooLong;
    }

    if (!formData.shortDescription.trim()) {
      newErrors.shortDescription = uk.news.admin.validation.descriptionRequired;
    } else if (formData.shortDescription.length > MAX_DESCRIPTION_LENGTH) {
      newErrors.shortDescription = uk.news.admin.validation.descriptionTooLong;
    }

    if (!formData.content.trim()) {
      newErrors.content = uk.news.admin.validation.contentRequired;
    } else if (formData.content.length > MAX_CONTENT_LENGTH) {
      newErrors.content = uk.news.admin.validation.contentTooLong;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (validate()) {
      await onSave(formData, !article);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploadingImage(true);
        try {
          const articleId = article?.id || `temp_${Date.now()}`;
          const url = await uploadNewsImage(
            result.assets[0].uri,
            articleId,
            'cover'
          );
          setFormData((prev) => ({ ...prev, coverImageUrl: url }));
        } catch (err) {
          Alert.alert(uk.common.error, uk.news.admin.validation.imageTooLarge);
        } finally {
          setIsUploadingImage(false);
        }
      }
    } catch (err) {
      Alert.alert(uk.common.error, uk.errors.general);
    }
  };

  const categories = getAllNewsCategories();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} disabled={isSaving}>
            <Text style={styles.modalCancelText}>{uk.common.cancel}</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {article ? uk.news.admin.editArticle : uk.news.admin.createArticle}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Text style={styles.modalSaveText}>{uk.common.save}</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>{uk.news.admin.fields.title} *</Text>
            <TextInput
              style={[styles.formInput, errors.title && styles.formInputError]}
              value={formData.title}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, title: text }))
              }
              placeholder={uk.news.admin.fields.title}
              placeholderTextColor={theme.colors.textMuted}
              maxLength={MAX_TITLE_LENGTH}
            />
            {errors.title && (
              <Text style={styles.errorText}>{errors.title}</Text>
            )}
            <Text style={styles.charCount}>
              {formData.title.length}/{MAX_TITLE_LENGTH}
            </Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>
              {uk.news.admin.fields.shortDescription} *
            </Text>
            <TextInput
              style={[
                styles.formInput,
                styles.formTextArea,
                errors.shortDescription && styles.formInputError,
              ]}
              value={formData.shortDescription}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, shortDescription: text }))
              }
              placeholder={uk.news.admin.fields.shortDescription}
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={3}
              maxLength={MAX_DESCRIPTION_LENGTH}
            />
            {errors.shortDescription && (
              <Text style={styles.errorText}>{errors.shortDescription}</Text>
            )}
            <Text style={styles.charCount}>
              {formData.shortDescription.length}/{MAX_DESCRIPTION_LENGTH}
            </Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>{uk.news.admin.fields.content} *</Text>
            <TextInput
              style={[
                styles.formInput,
                styles.formTextAreaLarge,
                errors.content && styles.formInputError,
              ]}
              value={formData.content}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, content: text }))
              }
              placeholder={uk.news.admin.fields.content}
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={10}
              maxLength={MAX_CONTENT_LENGTH}
            />
            {errors.content && (
              <Text style={styles.errorText}>{errors.content}</Text>
            )}
            <Text style={styles.charCount}>
              {formData.content.length}/{MAX_CONTENT_LENGTH}
            </Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>{uk.news.admin.fields.category}</Text>
            <View style={styles.categorySelector}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  style={[
                    styles.categoryOption,
                    formData.category === cat.value && styles.categoryOptionActive,
                  ]}
                  onPress={() =>
                    setFormData((prev) => ({ ...prev, category: cat.value }))
                  }
                >
                  <Text
                    style={[
                      styles.categoryOptionText,
                      formData.category === cat.value &&
                        styles.categoryOptionTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>{uk.news.admin.fields.tags}</Text>
            <TextInput
              style={styles.formInput}
              value={formData.tags}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, tags: text }))
              }
              placeholder="тег1, тег2, тег3"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>{uk.news.admin.fields.coverImage}</Text>
            <TouchableOpacity
              style={styles.imagePickerButton}
              onPress={handlePickImage}
              disabled={isUploadingImage}
            >
              {isUploadingImage ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : formData.coverImageUrl ? (
                <Image
                  source={{ uri: formData.coverImageUrl }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.imagePickerText}>+ Додати зображення</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() =>
                setFormData((prev) => ({ ...prev, isFeatured: !prev.isFeatured }))
              }
            >
              <View
                style={[
                  styles.checkbox,
                  formData.isFeatured && styles.checkboxChecked,
                ]}
              >
                {formData.isFeatured && (
                  <Text style={styles.checkboxCheck}>✓</Text>
                )}
              </View>
              <Text style={styles.checkboxLabel}>
                {uk.news.admin.fields.featured}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

export const ContentManagementScreen: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<NewsStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [editingArticle, setEditingArticle] = useState<NewsArticle | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canAccess = user && (user.role === 'admin' || (user as any).role === 'manager');

  const loadArticles = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const response = await getAllNewsForAdmin(
        statusFilter || undefined,
        undefined,
        searchQuery || undefined
      );
      setArticles(response.articles);
    } catch (err) {
      Alert.alert(uk.common.error, uk.errors.network);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    if (canAccess) {
      loadArticles();
    }
  }, [canAccess, statusFilter]);

  const handleSearch = () => {
    loadArticles(true);
  };

  const handleCreateNew = () => {
    setEditingArticle(null);
    setIsEditorVisible(true);
  };

  const handleEdit = (article: NewsArticle) => {
    setEditingArticle(article);
    setIsEditorVisible(true);
  };

  const handleSave = async (data: ArticleFormData, isNew: boolean) => {
    if (!user) return;

    setIsSaving(true);
    try {
      const tags = data.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      if (isNew) {
        const input: CreateNewsInput = {
          title: data.title,
          shortDescription: data.shortDescription,
          content: data.content,
          category: data.category,
          tags,
          coverImageUrl: data.coverImageUrl || undefined,
          isFeatured: data.isFeatured,
          status: 'draft',
          authorId: user.id,
          authorName: user.displayName || user.email || 'Адміністратор',
          authorRole: (user.role === 'admin' ? 'admin' : 'manager') as NewsAuthorRole,
        };
        await createNewsArticle(input);
      } else if (editingArticle) {
        const input: UpdateNewsInput = {
          title: data.title,
          shortDescription: data.shortDescription,
          content: data.content,
          category: data.category,
          tags,
          coverImageUrl: data.coverImageUrl || undefined,
          isFeatured: data.isFeatured,
        };
        await updateNewsArticle(editingArticle.id, input);
      }

      setIsEditorVisible(false);
      loadArticles(true);
    } catch (err) {
      Alert.alert(uk.common.error, uk.errors.general);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async (articleId: string) => {
    try {
      await publishArticle(articleId);
      loadArticles(true);
    } catch (err) {
      Alert.alert(uk.common.error, uk.errors.general);
    }
  };

  const handleUnpublish = async (articleId: string) => {
    try {
      await unpublishArticle(articleId);
      loadArticles(true);
    } catch (err) {
      Alert.alert(uk.common.error, uk.errors.general);
    }
  };

  const handleArchive = async (articleId: string) => {
    Alert.alert(
      uk.news.admin.archive,
      'Ви впевнені, що хочете архівувати цю статтю?',
      [
        { text: uk.common.cancel, style: 'cancel' },
        {
          text: uk.common.confirm,
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveArticle(articleId);
              loadArticles(true);
            } catch (err) {
              Alert.alert(uk.common.error, uk.errors.general);
            }
          },
        },
      ]
    );
  };

  const handleToggleFeatured = async (articleId: string, currentValue: boolean) => {
    try {
      await toggleFeatured(articleId, !currentValue);
      loadArticles(true);
    } catch (err) {
      Alert.alert(uk.common.error, uk.errors.general);
    }
  };

  if (!canAccess) {
    return (
      <View style={styles.accessDenied}>
        <Text style={styles.accessDeniedIcon}>🔒</Text>
        <Text style={styles.accessDeniedText}>{uk.errors.forbidden}</Text>
      </View>
    );
  }

  const statusFilters: { value: NewsStatus | null; label: string }[] = [
    { value: null, label: uk.filters.all },
    { value: 'draft', label: uk.news.admin.status.draft },
    { value: 'published', label: uk.news.admin.status.published },
    { value: 'archived', label: uk.news.admin.status.archived },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{uk.news.admin.title}</Text>
        <TouchableOpacity style={styles.createButton} onPress={handleCreateNew}>
          <Text style={styles.createButtonText}>+ {uk.news.admin.createArticle}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={uk.common.search}
          placeholderTextColor={theme.colors.textMuted}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {statusFilters.map((filter) => (
            <TouchableOpacity
              key={filter.value || 'all'}
              style={[
                styles.filterChip,
                statusFilter === filter.value && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(filter.value)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === filter.value && styles.filterChipTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={articles}
          renderItem={({ item }) => (
            <ArticleCard
              article={item}
              onEdit={() => handleEdit(item)}
              onPublish={() => handlePublish(item.id)}
              onUnpublish={() => handleUnpublish(item.id)}
              onArchive={() => handleArchive(item.id)}
              onToggleFeatured={() => handleToggleFeatured(item.id, item.isFeatured)}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={isRefreshing}
          onRefresh={() => loadArticles(true)}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyText}>{uk.empty.news}</Text>
            </View>
          }
        />
      )}

      <ArticleEditorModal
        visible={isEditorVisible}
        article={editingArticle}
        onClose={() => setIsEditorVisible(false)}
        onSave={handleSave}
        isSaving={isSaving}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
  },
  searchInput: {
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    marginHorizontal: 4,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  articleCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  articleCardHeader: {
    flexDirection: 'row',
    padding: 12,
  },
  articleThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  placeholderThumbnail: {
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 32,
  },
  articleInfo: {
    flex: 1,
    marginLeft: 12,
  },
  articleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  featuredBadge: {
    marginLeft: 8,
  },
  featuredBadgeText: {
    fontSize: 14,
  },
  articleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  articleCategory: {
    fontSize: 12,
    color: theme.colors.primary,
    marginBottom: 2,
  },
  articleDate: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  articleActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: theme.colors.background,
    marginRight: 8,
    marginBottom: 4,
  },
  actionButtonText: {
    fontSize: 12,
    color: theme.colors.text,
  },
  actionButtonTextLight: {
    fontSize: 12,
    color: '#fff',
  },
  publishButton: {
    backgroundColor: theme.colors.success,
  },
  unpublishButton: {
    backgroundColor: theme.colors.warning,
  },
  archiveButton: {
    backgroundColor: theme.colors.error,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
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
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  accessDeniedIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  accessDeniedText: {
    fontSize: 18,
    color: theme.colors.textMuted,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  modalCancelText: {
    fontSize: 16,
    color: theme.colors.textMuted,
  },
  modalSaveText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: 16,
  },
  formInputError: {
    borderColor: theme.colors.error,
  },
  formTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  formTextAreaLarge: {
    height: 200,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    color: theme.colors.error,
    marginTop: 4,
  },
  charCount: {
    fontSize: 10,
    color: theme.colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoryOptionActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryOptionText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  categoryOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  imagePickerButton: {
    height: 150,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imagePickerText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.border,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkboxCheck: {
    color: '#fff',
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    color: theme.colors.text,
  },
});

export default ContentManagementScreen;
