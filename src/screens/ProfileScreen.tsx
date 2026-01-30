import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView,
  TouchableOpacity,
  Alert
} from 'react-native';
import { theme } from '../config/theme';
import { Button } from '../components';
import { User } from '../types';

interface ProfileScreenProps {
  user: User | null;
  onSignOut: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ user, onSignOut }) => {
  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: onSignOut },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.phoneNumber?.charAt(1) || 'U'}
            </Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.label}>Phone Number</Text>
          <Text style={styles.value}>{user?.phoneNumber || 'Not available'}</Text>
        </View>

        {user?.displayName && (
          <View style={styles.infoSection}>
            <Text style={styles.label}>Display Name</Text>
            <Text style={styles.value}>{user.displayName}</Text>
          </View>
        )}

        <View style={styles.infoSection}>
          <Text style={styles.label}>Member Since</Text>
          <Text style={styles.value}>
            {user?.createdAt 
              ? new Date(user.createdAt).toLocaleDateString() 
              : 'Not available'}
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            title="Sign Out"
            variant="outline"
            onPress={handleSignOut}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Land Plots MVP</Text>
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: theme.colors.background,
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
  },
  infoSection: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.xs,
  },
  value: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
  },
  actions: {
    marginTop: theme.spacing.xl,
  },
  footer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  versionText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    marginTop: theme.spacing.xs,
  },
});
