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
  TextInput,
  Modal,
} from 'react-native';
import { theme } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import { LandPlot } from '../types';
import { formatPriceUAH, formatArea } from '../utils/currency';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

interface AdminScreenProps {
  navigation: any;
}

type TabStatus = 'pending' | 'approved' | 'rejected';

const TABS: { key: TabStatus; label: string }[] = [
  { key: 'pending', label: 'На модерації' },
  { key: 'approved', label: 'Активні' },
  { key: 'rejected', label: 'Відхилені' },
];

export const AdminScreen: React.FC<AdminScreenProps> = ({ navigation }) => {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabStatus>('pending');
  const [plots, setPlots] = useState<LandPlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState<LandPlot | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadPlots = useCallback(async () => {
    try {
      setError(null);
      const q = query(
        collection(db, 'plots'),
        where('status', '==', activeTab),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const fetchedPlots: LandPlot[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as LandPlot;
      });
      
      setPlots(fetchedPlots);
    } catch (err: any) {
      setError(err.message || 'Не вдалося завантажити оголошення');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (isAdmin) {
      loadPlots();
    }
  }, [loadPlots, isAdmin]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadPlots();
  };

  const handleApprove = async (plot: LandPlot) => {
    Alert.alert(
      'Підтвердити оголошення',
      `Ви впевнені, що хочете підтвердити "${plot.title}"?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Підтвердити',
          onPress: async () => {
            setProcessing(true);
            try {
              const plotRef = doc(db, 'plots', plot.id);
              await updateDoc(plotRef, {
                status: 'approved',
                approvedAt: serverTimestamp(),
                approvedBy: user?.id,
                updatedAt: serverTimestamp(),
              });
              
              setPlots(prev => prev.filter(p => p.id !== plot.id));
              Alert.alert('Успіх', 'Оголошення підтверджено');
            } catch (err: any) {
              Alert.alert('Помилка', err.message || 'Не вдалося підтвердити оголошення');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const openRejectModal = (plot: LandPlot) => {
    setSelectedPlot(plot);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const handleReject = async () => {
    if (!selectedPlot) return;
    
    if (!rejectReason.trim()) {
      Alert.alert('Помилка', 'Вкажіть причину відхилення');
      return;
    }

    setProcessing(true);
    try {
      const plotRef = doc(db, 'plots', selectedPlot.id);
      await updateDoc(plotRef, {
        status: 'rejected',
        rejectReason: rejectReason.trim(),
        rejectedAt: serverTimestamp(),
        rejectedBy: user?.id,
        updatedAt: serverTimestamp(),
      });
      
      setPlots(prev => prev.filter(p => p.id !== selectedPlot.id));
      setRejectModalVisible(false);
      setSelectedPlot(null);
      Alert.alert('Успіх', 'Оголошення відхилено');
    } catch (err: any) {
      Alert.alert('Помилка', err.message || 'Не вдалося відхилити оголошення');
    } finally {
      setProcessing(false);
    }
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

  const renderPlotItem = ({ item }: { item: LandPlot }) => (
    <View style={styles.plotCard}>
      <TouchableOpacity
        onPress={() => navigation.navigate('PlotDetail', { plotId: item.id })}
      >
        <Text style={styles.plotTitle} numberOfLines={1}>
          {item.title}
        </Text>
        
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

        {item.cadastralNumber && (
          <Text style={styles.cadastralNumber}>
            Кадастр: {item.cadastralNumber}
          </Text>
        )}

        <Text style={styles.ownerInfo}>
          Власник: {item.ownerPhone}
        </Text>
      </TouchableOpacity>

      {activeTab === 'pending' && (
        <View style={styles.plotActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleApprove(item)}
            disabled={processing}
          >
            <Text style={styles.approveButtonText}>Підтвердити</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => openRejectModal(item)}
            disabled={processing}
          >
            <Text style={styles.rejectButtonText}>Відхилити</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'rejected' && item.rejectReason && (
        <View style={styles.rejectReasonContainer}>
          <Text style={styles.rejectReasonLabel}>Причина відхилення:</Text>
          <Text style={styles.rejectReasonText}>{item.rejectReason}</Text>
        </View>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyTitle}>Немає оголошень</Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'pending'
          ? 'Немає оголошень на модерації'
          : `Немає оголошень зі статусом "${TABS.find(t => t.key === activeTab)?.label}"`}
      </Text>
    </View>
  );

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedIcon}>🔒</Text>
          <Text style={styles.accessDeniedTitle}>Доступ заборонено</Text>
          <Text style={styles.accessDeniedText}>
            Ця сторінка доступна тільки адміністраторам
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Адмін панель</Text>
        <Text style={styles.subtitle}>Модерація оголошень</Text>
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
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyTitle}>Помилка</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Спробувати знову</Text>
          </TouchableOpacity>
        </View>
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

      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Відхилити оголошення</Text>
            <Text style={styles.modalSubtitle}>
              {selectedPlot?.title}
            </Text>
            
            <TextInput
              style={styles.reasonInput}
              placeholder="Вкажіть причину відхилення..."
              placeholderTextColor={theme.colors.textMuted}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setRejectModalVisible(false)}
                disabled={processing}
              >
                <Text style={styles.modalCancelButtonText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalRejectButton}
                onPress={handleReject}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color={theme.colors.text} />
                ) : (
                  <Text style={styles.modalRejectButtonText}>Відхилити</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginTop: 2,
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
  plotTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
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
  cadastralNumber: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.xs,
  },
  ownerInfo: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  plotActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  approveButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: theme.colors.error,
  },
  rejectButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  rejectReasonContainer: {
    backgroundColor: theme.colors.error + '10',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.sm,
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
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.lg,
  },
  retryButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  accessDeniedIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.lg,
  },
  accessDeniedTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  accessDeniedText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  modalSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.md,
  },
  reasonInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
  },
  modalRejectButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.error,
    alignItems: 'center',
  },
  modalRejectButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
});
