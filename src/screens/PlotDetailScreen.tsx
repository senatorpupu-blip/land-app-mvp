import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Image, 
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  Linking,
  Alert
} from 'react-native';
import { theme } from '../config/theme';
import { Button } from '../components';
import { LandPlot } from '../types';

const { width } = Dimensions.get('window');

export const PlotDetailScreen = ({ route, navigation }: any) => {
  const { plot } = route.params;
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });
  };

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

  const handleContactOwner = () => {
    navigation.navigate('Chat', { 
      plotId: plot.id,
      ownerId: plot.ownerId,
      plotTitle: plot.title
    });
  };

  const handleOpenMap = () => {
    const url = `https://maps.google.com/?q=${plot.location.latitude},${plot.location.longitude}`;
    Linking.openURL(url);
  };

  const handleInvestmentRequest = () => {
    Alert.alert(
      'Investment Request',
      'Your investment request has been submitted. The owner will contact you shortly.',
      [{ text: 'OK' }]
    );
  };

  const handleCreditRequest = () => {
    Alert.alert(
      'Credit Request',
      'Your credit request has been submitted. A representative will contact you shortly.',
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Image Gallery */}
        <View style={styles.imageContainer}>
          {plot.photos && plot.photos.length > 0 ? (
            <>
              <Image 
                source={{ uri: plot.photos[currentImageIndex] }} 
                style={styles.mainImage}
                resizeMode="cover"
              />
              {plot.photos.length > 1 && (
                <View style={styles.thumbnailContainer}>
                  {plot.photos.map((photo: string, index: number) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => setCurrentImageIndex(index)}
                      style={[
                        styles.thumbnail,
                        currentImageIndex === index && styles.thumbnailActive
                      ]}
                    >
                      <Image 
                        source={{ uri: photo }} 
                        style={styles.thumbnailImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.noImage}>
              <Text style={styles.noImageText}>No images available</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          {/* Title and Zone */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{plot.title}</Text>
            <View style={[styles.zoneBadge, { backgroundColor: getZoneColor(plot.zone) }]}>
              <Text style={styles.zoneText}>Zone {plot.zone}</Text>
            </View>
          </View>

          {/* Location */}
          <TouchableOpacity onPress={handleOpenMap} style={styles.locationRow}>
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.location}>{plot.location.address}</Text>
            <Text style={styles.mapLink}>View on Map</Text>
          </TouchableOpacity>

          {/* Price Info */}
          <View style={styles.priceSection}>
            <Text style={styles.totalPrice}>{formatPrice(plot.totalPrice)}</Text>
            <View style={styles.priceDetails}>
              <Text style={styles.priceDetail}>
                {plot.area} sotkas × {formatPrice(plot.pricePerSotka)}/sotka
              </Text>
            </View>
          </View>

          {/* Badges */}
          <View style={styles.badgesRow}>
            {plot.isInvestmentPlot && (
              <View style={styles.featureBadge}>
                <Text style={styles.featureBadgeText}>Investment Plot</Text>
              </View>
            )}
            {plot.isCreditAvailable && (
              <View style={[styles.featureBadge, styles.creditBadge]}>
                <Text style={styles.featureBadgeText}>Credit Available</Text>
              </View>
            )}
          </View>

          {/* Cadastral Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cadastral Information</Text>
            <View style={styles.cadastralRow}>
              <Text style={styles.cadastralNumber}>{plot.cadastralNumber}</Text>
              <View style={[
                styles.verificationBadge,
                { backgroundColor: plot.cadastralVerified ? theme.colors.success : theme.colors.warning }
              ]}>
                <Text style={styles.verificationText}>
                  {plot.cadastralVerified ? 'Verified' : 'Not Verified'}
                </Text>
              </View>
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{plot.description}</Text>
          </View>

          {/* Region */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Region</Text>
            <Text style={styles.regionText}>{plot.region}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Button
              title="Contact Owner"
              onPress={handleContactOwner}
              style={styles.actionButton}
            />
            
            {plot.isInvestmentPlot && (
              <Button
                title="Request Investment Info"
                variant="outline"
                onPress={handleInvestmentRequest}
                style={styles.actionButton}
              />
            )}
            
            {plot.isCreditAvailable && (
              <Button
                title="Request Credit"
                variant="secondary"
                onPress={handleCreditRequest}
                style={styles.actionButton}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  imageContainer: {
    backgroundColor: theme.colors.backgroundSecondary,
  },
  mainImage: {
    width: width,
    height: 250,
  },
  noImage: {
    width: width,
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImageText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
  },
  thumbnailContainer: {
    flexDirection: 'row',
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: theme.colors.primary,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  content: {
    padding: theme.spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  title: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    marginRight: theme.spacing.sm,
  },
  zoneBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  zoneText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  locationIcon: {
    marginRight: theme.spacing.xs,
  },
  location: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
  },
  mapLink: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
  },
  priceSection: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
  },
  totalPrice: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  priceDetails: {
    flexDirection: 'row',
  },
  priceDetail: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  featureBadge: {
    backgroundColor: theme.colors.primaryDark,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  creditBadge: {
    backgroundColor: theme.colors.info,
  },
  featureBadgeText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  cadastralRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  cadastralNumber: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontFamily: 'monospace',
  },
  verificationBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  verificationText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    lineHeight: 24,
  },
  regionText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
  },
  actions: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  actionButton: {
    marginBottom: theme.spacing.sm,
  },
});
