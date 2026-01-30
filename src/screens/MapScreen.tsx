import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Platform
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { theme } from '../config/theme';
import { FilterModal } from '../components';
import { LandPlot, PlotFilters } from '../types';

interface MapScreenProps {
  navigation: any;
}

const { width, height } = Dimensions.get('window');

// Mock data - same as HomeScreen
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
    location: { latitude: 40.7189, longitude: -74.001, address: '456 Oak Ave' },
    cadastralNumber: '12:34:567890:456',
    cadastralVerified: false,
    photos: ['https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400'],
    ownerId: '2',
    ownerPhone: '+1234567891',
    isInvestmentPlot: false,
    isCreditAvailable: true,
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
    location: { latitude: 40.7084, longitude: -74.012, address: '789 River Rd' },
    cadastralNumber: '12:34:567890:789',
    cadastralVerified: true,
    photos: ['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400'],
    ownerId: '3',
    ownerPhone: '+1234567892',
    isInvestmentPlot: true,
    isCreditAvailable: false,
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
    location: { latitude: 40.7214, longitude: -74.008, address: '321 Hill St' },
    cadastralNumber: '12:34:567890:321',
    cadastralVerified: false,
    photos: ['https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400'],
    ownerId: '4',
    ownerPhone: '+1234567893',
    isInvestmentPlot: false,
    isCreditAvailable: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const REGIONS = ['North Valley', 'East Hills', 'South River', 'West Mountains'];

const INITIAL_REGION = {
  latitude: 40.7128,
  longitude: -74.006,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export const MapScreen: React.FC<MapScreenProps> = ({ navigation }) => {
  const [plots, setPlots] = useState<LandPlot[]>(MOCK_PLOTS);
  const [filteredPlots, setFilteredPlots] = useState<LandPlot[]>(MOCK_PLOTS);
  const [filters, setFilters] = useState<PlotFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState<LandPlot | null>(null);
  const mapRef = useRef<MapView>(null);

  const applyFilters = (newFilters: PlotFilters) => {
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
  };

  const getMarkerColor = (zone: string) => {
    switch (zone) {
      case 'A':
        return theme.colors.zoneA;
      case 'B':
        return theme.colors.zoneB;
      case 'C':
        return theme.colors.zoneC;
      default:
        return theme.colors.primary;
    }
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });
  };

  const handleMarkerPress = (plot: LandPlot) => {
    setSelectedPlot(plot);
  };

  const handlePlotPress = () => {
    if (selectedPlot) {
      navigation.navigate('PlotDetail', { plot: selectedPlot });
    }
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== undefined).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Map View</Text>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Text style={styles.filterButtonText}>
            Filters {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={INITIAL_REGION}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        >
          {filteredPlots.map((plot) => (
            <Marker
              key={plot.id}
              coordinate={{
                latitude: plot.location.latitude,
                longitude: plot.location.longitude,
              }}
              pinColor={getMarkerColor(plot.zone)}
              onPress={() => handleMarkerPress(plot)}
            />
          ))}
        </MapView>

        {/* Selected Plot Card */}
        {selectedPlot && (
          <TouchableOpacity 
            style={styles.selectedCard}
            onPress={handlePlotPress}
            activeOpacity={0.9}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {selectedPlot.title}
                </Text>
                <View style={[
                  styles.zoneBadge, 
                  { backgroundColor: getMarkerColor(selectedPlot.zone) }
                ]}>
                  <Text style={styles.zoneText}>Zone {selectedPlot.zone}</Text>
                </View>
              </View>
              <Text style={styles.cardRegion}>{selectedPlot.region}</Text>
              <View style={styles.cardDetails}>
                <Text style={styles.cardArea}>{selectedPlot.area} sotkas</Text>
                <Text style={styles.cardPrice}>{formatPrice(selectedPlot.totalPrice)}</Text>
              </View>
              <Text style={styles.tapHint}>Tap to view details</Text>
            </View>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setSelectedPlot(null)}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.zoneA }]} />
            <Text style={styles.legendText}>Zone A</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.zoneB }]} />
            <Text style={styles.legendText}>Zone B</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.zoneC }]} />
            <Text style={styles.legendText}>Zone C</Text>
          </View>
        </View>
      </View>

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
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: width,
    height: '100%',
  },
  selectedCard: {
    position: 'absolute',
    bottom: theme.spacing.lg,
    left: theme.spacing.md,
    right: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cardContent: {
    flex: 1,
    padding: theme.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  cardTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    marginRight: theme.spacing.sm,
  },
  zoneBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  zoneText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
  },
  cardRegion: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.sm,
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardArea: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  cardPrice: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  tapHint: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    marginTop: theme.spacing.sm,
  },
  closeButton: {
    padding: theme.spacing.md,
    justifyContent: 'flex-start',
  },
  closeButtonText: {
    color: theme.colors.textMuted,
    fontSize: 24,
    lineHeight: 24,
  },
  legend: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: theme.spacing.sm,
  },
  legendText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xs,
  },
});
