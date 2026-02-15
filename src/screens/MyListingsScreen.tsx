import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { theme } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import { LandPlot } from '../types';
import { getPlotsByOwnerAndStatus, softDeletePlot, updatePlot } from '../services/plots';
import { formatPriceUAH, formatArea } from '../utils/currency';

interface MyListingsScreenProps {
  navigation: any;
}

type TabStatus = 'all' | 'pending' | 'approved' | 'rejected';

const TABS: { key: TabStatus; label: string }[] = [
  { key: 'all', label: 'Всі' },
  { key: 'pending', label: 'На модерації' },
  { key: 'approved', label: 'Активні' },
  { key: 'rejected', label: 'Відхилені' },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Чернетка', color: theme.colors.textMuted },
  pending: { label: 'На модерації', color: '#FFA500' },
  approved: { label: 'Активна', color: '#4CAF50' },
  rejected: { label: 'Відхилена', color: theme.colors.error },
  deleted: { label: 'Видалена', color: theme.colors.textMuted },
};

export const MyListingsScreen: React.FC<MyListingsScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabStatus>('all');
  const [plots, setPlots] = useState<LandPlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlots = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);
      const status = activeTab === 'all' ? undefined : activeTab;
      const fetchedPlots = await getPlotsByOwnerAndStatus(user.id, status as any);
      setPlots(fetchedPlots);
    } catch (err: any) {
      setError(err.message || 'Не вдалося завантажити оголошення');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    loadPlots();
  }, [loadPlots]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadPlots();
  };

  const handleDelete = (plot: LandPlot) => {
    Alert.alert(
      'Видалити оголошення',
      `Ви впевнені, що хочете видалити "${plot.title}"?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            try {
              await softDeletePlot(plot.id);
              setPlots(prev => prev.filter(p => p.id !== plot.id));
              Alert.alert('Успіх', 'Оголошення видалено');
            } catch (err: any) {
              Alert.alert('Помилка', err.message || 'Не вдалося видалити оголошення');
            }
          },
        },
      ]
    );
  };

  const handleEdit = (plot: LandPlot) => {
    navigation.navigate('EditPlot', { plotId: plot.id });
  };

  const renderTab = ({ item }: { item: typeof TABS[0] }) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === item.key && styles.tabActive]}
      onPress={() => {
        setActiveTab(item.key);
        setLoading(true);
      }}
    >
      <Text style={[styles.tabText, activeTab === item.key && styles.tabTextActive]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  const renderPlotItem = ({ item }: { item: LandPlot }) => {
    const statusInfo = STATUS_LABELS[item.status] || STATUS_LABELS.pending;

    return (
      <TouchableOpacity
        style={styles.plotCard}
        onPress={() => navigation.navigate('PlotDetail', { plotId: item.id })}
      >
        <View style={styles.plotHeader}>
          <Text style={styles.plotTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        <View style={styles.plotInfo}>
          <Text style={styles.plotRegion}>{item.region}</Text>
          <Text style={styles.plotArea}>{formatArea(item.area)}</Text>
        </View>

        <View style={styles.plotPricing}>
          <Text style={styles.plotPrice}>{formatPriceUAH(item.totalPrice)}</Text>
          <Text style={styles.plotPricePerSotka}>
            {formatPriceUAH(item.pricePerSotka)}/сотка
          </Text>
        </View>

        {item.status === 'rejected' && item.pricing?.marketStatus && (
          <View style={styles.rejectReasonContainer}>
            <Text style={styles.rejectReasonLabel}>Причина відхилення:</Text>
            <Text style={styles.rejectReasonText}>
              {item.pricing.marketStatus || 'Не вказано'}
            </Text>
          </View>
        )}

        <View style={styles.plotActions}>
          {item.status !== 'deleted' && (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleEdit(item)}
              >
                <Text style={styles.actionButtonText}>Редагувати</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleDelete(item)}
              >
                <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                  Видалити
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyTitle}>Немає оголошень</Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'all'
          ? 'Ви ще не створили жодного оголошення'
          : `Немає оголошень зі статусом "${TABS.find(t => t.key === activeTab)?.label}"`}
      </Text>
      {activeTab === 'all' && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('AddPlot')}
        >
          <Text style={styles.createButtonText}>Створити оголошення</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>⚠️</Text>
      <Text style={styles.emptyTitle}>Помилка</Text>
      <Text style={styles.emptySubtitle}>{error}</Text>
      <TouchableOpacity style={styles.createButton} onPress={handleRefresh}>
        <Text style={styles.createButtonText}>Спробувати знову</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Мої оголошення</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddPlot')}
        >
          <Text style={styles.addButtonText}>+ Додати</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={TABS}
        renderItem={renderTab}
        keyExtractor={(item) => item.key}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Завантаження...</Text>
        </View>
      ) : error ? (
        renderErrorState()
      ) : (
        <FlatList
          data={plots}
          renderItem={renderPlotItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
      )}
    </SafeAreaView>
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
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  addButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  tabsContainer: {
    maxHeight: 50,
  },
  tabsContent: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  tab: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
    marginRight: theme.spacing.sm,
  },
  tabActive: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  tabTextActive: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  listContent: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  plotCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  plotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  plotTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  statusText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
  },
  plotInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  plotRegion: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  plotArea: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  plotPricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  plotPrice: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  plotPricePerSotka: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  rejectReasonContainer: {
    backgroundColor: theme.colors.error + '10',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.sm,
  },
  rejectReasonLabel: {
    color: theme.colors.error,
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    marginBottom: 2,
  },
  rejectReasonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  plotActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  actionButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: theme.colors.error + '20',
  },
  deleteButtonText: {
    color: theme.colors.error,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    marginTop: theme.spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  emptySubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  createButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
});
