import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  StyleSheet, 
  TouchableOpacity,
  ScrollView 
} from 'react-native';
import { theme } from '../config/theme';
import { PlotFilters } from '../types';
import { Input } from './Input';
import { Button } from './Button';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: PlotFilters) => void;
  currentFilters: PlotFilters;
  regions: string[];
}

export const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  onClose,
  onApply,
  currentFilters,
  regions,
}) => {
  const [filters, setFilters] = useState<PlotFilters>(currentFilters);

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const handleReset = () => {
    setFilters({});
  };

  const zones: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Filters</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <Text style={styles.sectionTitle}>Price Range</Text>
            <View style={styles.row}>
              <Input
                placeholder="Min"
                keyboardType="numeric"
                value={filters.minPrice?.toString() || ''}
                onChangeText={(text) => 
                  setFilters({ ...filters, minPrice: text ? parseInt(text) : undefined })
                }
                containerStyle={styles.halfInput}
              />
              <Input
                placeholder="Max"
                keyboardType="numeric"
                value={filters.maxPrice?.toString() || ''}
                onChangeText={(text) => 
                  setFilters({ ...filters, maxPrice: text ? parseInt(text) : undefined })
                }
                containerStyle={styles.halfInput}
              />
            </View>

            <Text style={styles.sectionTitle}>Zone</Text>
            <View style={styles.zoneContainer}>
              <TouchableOpacity
                style={[
                  styles.zoneButton,
                  !filters.zone && styles.zoneButtonActive,
                ]}
                onPress={() => setFilters({ ...filters, zone: undefined })}
              >
                <Text style={[
                  styles.zoneButtonText,
                  !filters.zone && styles.zoneButtonTextActive,
                ]}>All</Text>
              </TouchableOpacity>
              {zones.map((zone) => (
                <TouchableOpacity
                  key={zone}
                  style={[
                    styles.zoneButton,
                    filters.zone === zone && styles.zoneButtonActive,
                  ]}
                  onPress={() => setFilters({ ...filters, zone })}
                >
                  <Text style={[
                    styles.zoneButtonText,
                    filters.zone === zone && styles.zoneButtonTextActive,
                  ]}>Zone {zone}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Region</Text>
            <View style={styles.regionContainer}>
              <TouchableOpacity
                style={[
                  styles.regionButton,
                  !filters.region && styles.regionButtonActive,
                ]}
                onPress={() => setFilters({ ...filters, region: undefined })}
              >
                <Text style={[
                  styles.regionButtonText,
                  !filters.region && styles.regionButtonTextActive,
                ]}>All Regions</Text>
              </TouchableOpacity>
              {regions.map((region) => (
                <TouchableOpacity
                  key={region}
                  style={[
                    styles.regionButton,
                    filters.region === region && styles.regionButtonActive,
                  ]}
                  onPress={() => setFilters({ ...filters, region })}
                >
                  <Text style={[
                    styles.regionButtonText,
                    filters.region === region && styles.regionButtonTextActive,
                  ]}>{region}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title="Reset"
              variant="outline"
              onPress={handleReset}
              style={styles.footerButton}
            />
            <Button
              title="Apply"
              onPress={handleApply}
              style={styles.footerButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '80%',
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
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
  },
  closeButton: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.md,
  },
  content: {
    padding: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  zoneContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  zoneButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  zoneButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  zoneButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  zoneButtonTextActive: {
    color: theme.colors.background,
    fontWeight: '600',
  },
  regionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  regionButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  regionButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  regionButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  regionButtonTextActive: {
    color: theme.colors.background,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  footerButton: {
    flex: 1,
  },
});
