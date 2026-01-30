import React from 'react';
import { 
  View, 
  Text, 
  Image, 
  StyleSheet, 
  TouchableOpacity,
  Dimensions 
} from 'react-native';
import { theme } from '../config/theme';
import { LandPlot } from '../types';

interface PlotCardProps {
  plot: LandPlot;
  onPress: () => void;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - theme.spacing.md * 3) / 2;

export const PlotCard: React.FC<PlotCardProps> = ({ plot, onPress }) => {
  const getZoneColor = (zone: string) => {
    switch (zone) {
      case 'A':
        return theme.colors.zoneA;
      case 'B':
        return theme.colors.zoneB;
      case 'C':
        return theme.colors.zoneC;
      default:
        return theme.colors.textMuted;
    }
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });
  };

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        {plot.photos && plot.photos.length > 0 ? (
          <Image 
            source={{ uri: plot.photos[0] }} 
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
        <View style={[styles.zoneBadge, { backgroundColor: getZoneColor(plot.zone) }]}>
          <Text style={styles.zoneText}>Zone {plot.zone}</Text>
        </View>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{plot.title}</Text>
        <Text style={styles.region} numberOfLines={1}>{plot.region}</Text>
        
        <View style={styles.details}>
          <Text style={styles.area}>{plot.area} sotkas</Text>
          <Text style={styles.pricePerSotka}>
            {formatPrice(plot.pricePerSotka)}/sotka
          </Text>
        </View>
        
        <Text style={styles.totalPrice}>{formatPrice(plot.totalPrice)}</Text>
        
        <View style={styles.badges}>
          {plot.isInvestmentPlot && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Investment</Text>
            </View>
          )}
          {plot.isCreditAvailable && (
            <View style={[styles.badge, styles.creditBadge]}>
              <Text style={styles.badgeText}>Credit</Text>
            </View>
          )}
        </View>
        
        <View style={styles.verificationStatus}>
          <View style={[
            styles.verificationDot,
            { backgroundColor: plot.cadastralVerified ? theme.colors.success : theme.colors.warning }
          ]} />
          <Text style={styles.verificationText}>
            {plot.cadastralVerified ? 'Verified' : 'Not verified'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
  },
  imageContainer: {
    position: 'relative',
    height: 120,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  zoneBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  zoneText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
  },
  content: {
    padding: theme.spacing.sm,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  region: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.sm,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  area: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  pricePerSotka: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
  },
  totalPrice: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  badge: {
    backgroundColor: theme.colors.primaryDark,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  creditBadge: {
    backgroundColor: theme.colors.info,
  },
  badgeText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xs,
  },
  verificationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.xs,
  },
  verificationText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
  },
});
