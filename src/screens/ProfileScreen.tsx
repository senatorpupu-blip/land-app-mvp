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
  isAdmin?: boolean;
  navigation?: any;
}

const ROLE_LABELS: Record<string, string> = {
  buyer: 'Покупець',
  seller: 'Продавець',
  admin: 'Адміністратор',
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ 
  user, 
  onSignOut, 
  isAdmin,
  navigation 
}) => {
  const handleSignOut = () => {
    Alert.alert(
      'Вийти',
      'Ви впевнені, що хочете вийти?',
      [
        { text: 'Скасувати', style: 'cancel' },
        { text: 'Вийти', style: 'destructive', onPress: onSignOut },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Профіль</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.displayName?.charAt(0) || user?.phoneNumber?.charAt(1) || user?.email?.charAt(0) || 'U'}
            </Text>
          </View>
          {user?.role && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{ROLE_LABELS[user.role] || user.role}</Text>
            </View>
          )}
        </View>

        {user?.phoneNumber && (
          <View style={styles.infoSection}>
            <Text style={styles.label}>Номер телефону</Text>
            <Text style={styles.value}>{user.phoneNumber}</Text>
          </View>
        )}

        {user?.email && (
          <View style={styles.infoSection}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user.email}</Text>
          </View>
        )}

        {user?.displayName && (
          <View style={styles.infoSection}>
            <Text style={styles.label}>Ім'я</Text>
            <Text style={styles.value}>{user.displayName}</Text>
          </View>
        )}

        <View style={styles.infoSection}>
          <Text style={styles.label}>Дата реєстрації</Text>
          <Text style={styles.value}>
            {user?.createdAt 
              ? new Date(user.createdAt).toLocaleDateString('uk-UA') 
              : 'Не вказано'}
          </Text>
        </View>

        {isAdmin && (
          <TouchableOpacity 
            style={styles.adminButton}
            onPress={() => navigation?.navigate('Admin')}
          >
            <Text style={styles.adminButtonText}>Адмін панель</Text>
          </TouchableOpacity>
        )}

        <View style={styles.actions}>
          <Button
            title="Вийти"
            variant="outline"
            onPress={handleSignOut}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Land Plots MVP</Text>
        <Text style={styles.versionText}>Версія 1.0.0</Text>
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
  roleBadge: {
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.primary + '30',
    borderRadius: theme.borderRadius.sm,
  },
  roleText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
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
  adminButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  adminButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
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
