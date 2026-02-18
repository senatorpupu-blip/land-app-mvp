import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { theme } from '../config/theme';
import { PlotCard, FilterModal } from '../components';
import { LandPlot, PlotFilters } from '../types';
import { getPlots } from '../services/plots';
import { uk } from '../localization/uk';

interface HomeScreenProps {
  navigation: any;
}

// Mock data for MVP demo
const MOCK_PLOTS: LandPlot[] = [
  {
    id: '1',
    title: 'Sunny Meadow Plot',
    description: 'Beautiful plot with mountain views',
    area: 10,
    pricePerSotka: 5000,
    totalPrice: 50000,
    zone: 'A',
    region: 'North Valley',
    location: { latitude: 40.7128, longitude: -74.006, address: '123 Main St' },
    cadastralNumber: '12:34:567890:123',
    cadastralVerified: true,
    photos: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400'],
    ownerId: '1',
    ownerPhone: '+1234567890',
    isInvestmentPlot: true,
    isCreditAvailable: true,
    status: 'approved',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    title: 'Forest Edge Land',
    description: 'Peaceful plot near the forest',
    area: 15,
    pricePerSotka: 3500,
    totalPrice: 52500,
    zone: 'B',
    region: 'East Hills',
    location: { latitude: 40.7589, longitude: -73.9851, address: '456 Oak Ave' },
    cadastralNumber: '12:34:567890:456',
    cadastralVerified: false,
    photos: ['https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400'],
    ownerId: '2',
    ownerPhone: '+1234567891',
    isInvestmentPlot: false,
    isCreditAvailable: true,
    status: 'approved',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '3',
    title: 'Riverside Property',
    description: 'Prime location by the river',
    area: 8,
    pricePerSotka: 7000,
    totalPrice: 56000,
    zone: 'A',
    region: 'South River',
    location: { latitude: 40.7484, longitude: -73.9857, address: '789 River Rd' },
    cadastralNumber: '12:34:567890:789',
    cadastralVerified: true,
    photos: ['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400'],
    ownerId: '3',
    ownerPhone: '+1234567892',
    isInvestmentPlot: true,
    isCreditAvailable: false,
    status: 'approved',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '4',
    title: 'Hilltop View',
    description: 'Panoramic views from the hilltop',
    area: 20,
    pricePerSotka: 2500,
    totalPrice: 50000,
    zone: 'C',
    region: 'West Mountains',
    location: { latitude: 40.7614, longitude: -73.9776, address: '321 Hill St' },
    cadastralNumber: '12:34:567890:321',
    cadastralVerified: false,
    photos: ['https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400'],
    ownerId: '4',
    ownerPhone: '+1234567893',
    isInvestmentPlot: false,
    isCreditAvailable: false,
    status: 'approved',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const REGIONS= ['North Valley', 'East Hills', 'South River', 'West Mountains'];

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const [plots, setPlots] = useState<LandPlot[]>(MOCK_PLOTS);
  const [filteredPlots, setFilteredPlots] = useState<LandPlot[]>(MOCK_PLOTS);
  const [filters, setFilters] = useState<PlotFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyFilters = useCallback((newFilters: PlotFilters) => {
    setFilters(newFilters);
    
    let result = [...plots];
    
    if (newFilters.minPrice !== undefined) {
      result = result.filter(p => p.totalPrice >= newFilters.minPrice!);
    }
    if (newFilters.maxPrice !== undefined) {
      result = result.filter(p => p.totalPrice <= newFilters.maxPrice!);
    }
    if (newFilters.zone) {
      result = result.filter(p => p.zone === newFilters.zone);
    }
    if (newFilters.region) {
      result = result.filter(p => p.region === newFilters.region);
    }
    
    setFilteredPlots(result);
  }, [plots]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // In production, fetch from Firebase
    // const fetchedPlots = await getPlots(filters);
    // setPlots(fetchedPlots);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const handlePlotPress = useCallback((plot: LandPlot) => {
    navigation.navigate('PlotDetail', { plot });
  }, [navigation]);

  const activeFiltersCount = Object.values(filters).filter(v => v !== undefined).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{uk.plots.title}</Text>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Text style={styles.filterButtonText}>
            {uk.filters.title} {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>{uk.common.loading}</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>{uk.common.retry}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredPlots}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <PlotCard 
              plot={item} 
              onPress={() => handlePlotPress(item)} 
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{uk.empty.plots}</Text>
              <Text style={styles.emptySubtext}>{uk.empty.search}</Text>
            </View>
          }
        />
      )}

      <FilterModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={applyFilters}
        currentFilters={filters}
        regions={REGIONS}
      />
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
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
  },
  filterButton: {
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterButtonText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
  },
  list: {
    padding: theme.spacing.md,
  },
  row: {
    justifyContent: 'space-between',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
    marginTop: theme.spacing.md,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.fontSize.md,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
  },
  retryButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  emptySubtext: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
  },
});
