import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Platform,
  Switch,
  ActivityIndicator
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, UrlTile, Region } from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { theme } from '../config/theme';
import { FilterModal } from '../components';
import { LandPlot, PlotFilters } from '../types';

interface MapScreenProps {
  navigation: any;
}

const { width, height } = Dimensions.get('window');

// Ukraine center coordinates (Kyiv)
const UKRAINE_CENTER = {
  latitude: 48.3794,
  longitude: 31.1656,
  latitudeDelta: 8.0,
  longitudeDelta: 8.0,
};

const INITIAL_REGION = UKRAINE_CENTER;

export const MapScreen: React.FC<MapScreenProps> = ({ navigation }) => {
  const [plots, setPlots] = useState<LandPlot[]>([]);
  const [filteredPlots, setFilteredPlots] = useState<LandPlot[]>([]);
  const [filters, setFilters] = useState<PlotFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState<LandPlot | null>(null);
  const [showCadastralOverlay, setShowCadastralOverlay] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [regions, setRegions] = useState<string[]>([]);
  const mapRef = useRef<MapView>(null);

  // Subscribe to Firestore plots collection in real-time
  useEffect(() => {
    const plotsRef = collection(db, 'plots');
    const q = query(plotsRef, where('status', '==', 'approved'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedPlots: LandPlot[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as LandPlot;
      });
      
      setPlots(loadedPlots);
      setFilteredPlots(loadedPlots);
      
      // Extract unique regions from loaded plots
      const uniqueRegions = [...new Set(loadedPlots.map(p => p.region).filter(Boolean))];
      setRegions(uniqueRegions);
      
      setIsLoading(false);
      
      // Auto-fit map to markers if there are plots
      if (loadedPlots.length > 0 && mapRef.current) {
        const coordinates = loadedPlots.map(p => ({
          latitude: p.location.latitude,
          longitude: p.location.longitude,
        }));
        
        // Fit map to show all markers with padding
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(coordinates, {
            edgePadding: { top: 100, right: 50, bottom: 150, left: 50 },
            animated: true,
          });
        }, 500);
      }
    }, (error) => {
      console.error('Error loading plots:', error);
      setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

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

  // Memoize marker press handler for performance
  const handleMarkerPress = useCallback((plot: LandPlot) => {
    setSelectedPlot(plot);
  }, []);

  const handlePlotPress = useCallback(() => {
    if (selectedPlot) {
      navigation.navigate('PlotDetail', { plot: selectedPlot });
    }
  }, [selectedPlot, navigation]);

  const activeFiltersCount = Object.values(filters).filter(v => v !== undefined).length;

  // Custom cluster rendering for performance and styling
  const renderCluster = useCallback((cluster: any) => {
    const { id, geometry, onPress, properties } = cluster;
    const points = properties.point_count;
    
    return (
      <Marker
        key={`cluster-${id}`}
        coordinate={{
          longitude: geometry.coordinates[0],
          latitude: geometry.coordinates[1],
        }}
        onPress={onPress}
      >
        <View style={styles.clusterContainer}>
          <View style={styles.clusterMarker}>
            <Text style={styles.clusterText}>{points}</Text>
          </View>
        </View>
      </Marker>
    );
  }, []);

  // Memoize markers for performance with 1000+ plots
  const memoizedMarkers = useMemo(() => {
    return filteredPlots.map((plot) => (
      <Marker
        key={plot.id}
        identifier={plot.id}
        coordinate={{
          latitude: plot.location.latitude,
          longitude: plot.location.longitude,
        }}
        pinColor={getMarkerColor(plot.zone)}
        onPress={() => handleMarkerPress(plot)}
        tracksViewChanges={false}
      />
    ));
  }, [filteredPlots, handleMarkerPress]);

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
        <ClusteredMapView
          ref={mapRef}
          style={styles.map}
          initialRegion={INITIAL_REGION}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          clusterColor={theme.colors.primary}
          clusterTextColor={theme.colors.text}
          clusterFontFamily="System"
          radius={50}
          maxZoom={16}
          minZoom={1}
          minPoints={2}
          extent={512}
          nodeSize={64}
          renderCluster={renderCluster}
          animationEnabled={true}
          preserveClusterPressBehavior={true}
          spiderLineColor={theme.colors.border}
          superClusterRef={{ current: null }}
          mapRef={(ref: any) => { mapRef.current = ref; }}
        >
          {/* Ukrainian cadastral overlay */}
          {showCadastralOverlay && (
            <UrlTile
              urlTemplate="https://map.land.gov.ua/geowebcache/service/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=kadastr&WIDTH=256&HEIGHT=256&SRS=EPSG:3857&BBOX={minX},{minY},{maxX},{maxY}"
              maximumZ={19}
              flipY={false}
              zIndex={1}
            />
          )}
          
          {memoizedMarkers}
        </ClusteredMapView>

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
          <View style={styles.cadastralToggle}>
            <Text style={styles.legendText}>Cadastral</Text>
            <Switch
              value={showCadastralOverlay}
              onValueChange={setShowCadastralOverlay}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.text}
            />
          </View>
        </View>
      </View>

      <FilterModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={applyFilters}
        currentFilters={filters}
        regions={regions}
      />

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading plots...</Text>
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
  cadastralToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
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
  clusterContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.text,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  clusterText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
});
