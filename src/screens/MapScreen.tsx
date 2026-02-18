import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Platform,
  ActivityIndicator
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { theme } from '../config/theme';
import { FilterModal } from '../components';
import { LandPlot, PlotFilters } from '../types';
import { MapService, BoundingBox, extractUniqueRegions } from '../services/mapService';
import {
  UKRAINE_CENTER,
  regionToBoundingBox,
  getPlotCoordinates,
} from '../utils/mapUtils';
import { formatPriceUAH, formatPricePerHectareUAH, calculatePricePerHectare } from '../utils/currency';
import { uk } from '../localization/uk';

interface MapScreenProps {
  navigation: any;
}

const { width } = Dimensions.get('window');

const INITIAL_REGION = UKRAINE_CENTER;
const DEBOUNCE_MS = 400;

export const MapScreen: React.FC<MapScreenProps> = ({ navigation }) => {
  const [plots, setPlots] = useState<LandPlot[]>([]);
  const [filteredPlots, setFilteredPlots] = useState<LandPlot[]>([]);
  const [filters, setFilters] = useState<PlotFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState<LandPlot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regions, setRegions] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(true);
  
  const mapRef = useRef<MapView>(null);
  const mapServiceRef = useRef<MapService | null>(null);
  const hasInitialFit = useRef(false);

  useEffect(() => {
    const mapService = new MapService({
      onPlotsUpdate: (newPlots) => {
        setPlots(newPlots);
        setRegions(extractUniqueRegions(newPlots));
        
        if (!hasInitialFit.current && newPlots.length > 0 && mapRef.current) {
          hasInitialFit.current = true;
          const coordinates = getPlotCoordinates(newPlots);
          if (coordinates.length > 0) {
            setTimeout(() => {
              mapRef.current?.fitToCoordinates(coordinates, {
                edgePadding: { top: 100, right: 50, bottom: 150, left: 50 },
                animated: true,
              });
            }, 500);
          }
        }
      },
      onLoadingChange: setIsLoading,
      onOfflineChange: setIsOffline,
      onError: setError,
      onHasMoreChange: setHasMore,
    });

    mapServiceRef.current = mapService;
    mapService.subscribeToPlots();

    return () => {
      mapService.cleanup();
    };
  }, []);

  useEffect(() => {
    applyFilters(filters);
  }, [plots, filters]);

  const applyFilters = useCallback((newFilters: PlotFilters) => {
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

  const handleFiltersApply = useCallback((newFilters: PlotFilters) => {
    setFilters(newFilters);
  }, []);

  const handleRegionChange = useCallback((region: Region) => {
    if (!mapServiceRef.current) return;
    
    const boundingBox: BoundingBox = regionToBoundingBox(region);
    mapServiceRef.current.onRegionChange(boundingBox, DEBOUNCE_MS);
  }, []);

  const getMarkerColor = useCallback((zone: string) => {
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
  }, []);

  const handleMarkerPress = useCallback((plot: LandPlot) => {
    setSelectedPlot(plot);
  }, []);

  const handlePlotPress = useCallback(() => {
    if (selectedPlot) {
      navigation.navigate('PlotDetail', { plot: selectedPlot });
    }
  }, [selectedPlot, navigation]);

  const handleLoadMore = useCallback(() => {
    if (mapServiceRef.current && hasMore && !isLoading) {
      mapServiceRef.current.loadMorePlots();
    }
  }, [hasMore, isLoading]);

  const handleRetry = useCallback(() => {
    if (mapServiceRef.current) {
      setError(null);
      mapServiceRef.current.subscribeToPlots();
    }
  }, []);

  const activeFiltersCount = Object.values(filters).filter(v => v !== undefined).length;

  const getPricePerHectare = useCallback((plot: LandPlot): string => {
    return formatPricePerHectareUAH(plot.pricePerSotka);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{uk.map.title}</Text>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Text style={styles.filterButtonText}>
            {uk.filters.title} {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            {uk.errors.offline}
          </Text>
        </View>
      )}

      {error && !isOffline && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>{uk.common.retry}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={INITIAL_REGION}
          provider={PROVIDER_GOOGLE}
          onRegionChangeComplete={handleRegionChange}
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
              tracksViewChanges={false}
            />
          ))}
        </MapView>

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
                  <Text style={styles.zoneText}>{uk.plots.fields.zone} {selectedPlot.zone}</Text>
                </View>
              </View>
              <Text style={styles.cardRegion}>{selectedPlot.region}</Text>
              <View style={styles.cardDetails}>
                <Text style={styles.cardArea}>{selectedPlot.area} соток</Text>
                <Text style={styles.cardPrice}>{formatPriceUAH(selectedPlot.totalPrice)}</Text>
              </View>
              <Text style={styles.cardPricePerHectare}>
                {getPricePerHectare(selectedPlot)}
              </Text>
              <Text style={styles.tapHint}>{uk.plots.plotDetails}</Text>
            </View>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setSelectedPlot(null)}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.zoneA }]} />
            <Text style={styles.legendText}>{uk.plots.fields.zone} A</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.zoneB }]} />
            <Text style={styles.legendText}>{uk.plots.fields.zone} B</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.zoneC }]} />
            <Text style={styles.legendText}>{uk.plots.fields.zone} C</Text>
          </View>
        </View>

        {hasMore && !isLoading && filteredPlots.length > 0 && (
          <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore}>
            <Text style={styles.loadMoreText}>{uk.common.loading}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.plotCount}>
          <Text style={styles.plotCountText}>
            {filteredPlots.length} {uk.plots.units.sotkas === 'соток' ? 'ділянок' : 'plots'}
          </Text>
        </View>
      </View>

      <FilterModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={handleFiltersApply}
        currentFilters={filters}
        regions={regions}
      />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>{uk.common.loading}</Text>
        </View>
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
  offlineBanner: {
    backgroundColor: '#FFA500',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
  },
  offlineBannerText: {
    color: theme.colors.background,
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
  },
  errorBanner: {
    backgroundColor: '#FF4444',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorBannerText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    flex: 1,
  },
  retryButton: {
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    marginLeft: theme.spacing.sm,
  },
  retryButtonText: {
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
  cardPricePerHectare: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    marginTop: theme.spacing.xs,
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
  loadMoreButton: {
    position: 'absolute',
    bottom: theme.spacing.xl + 80,
    left: theme.spacing.md,
    right: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  loadMoreText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
  },
  plotCount: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  plotCountText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xs,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    marginTop: theme.spacing.md,
  },
});
