import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { theme } from '../config/theme';
import { User } from '../types';
import {
  LoginScreen,
  HomeScreen,
  PlotDetailScreen,
  MapScreen,
  ChatListScreen,
  ChatScreen,
  ProfileScreen,
} from '../screens';

// Navigation theme
const navigationTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: theme.colors.primary,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.text,
    border: theme.colors.border,
    notification: theme.colors.primary,
  },
};

// Tab icon component
const TabIcon: React.FC<{ name: string; focused: boolean }> = ({ name, focused }) => {
  const getIcon = () => {
    switch (name) {
      case 'Home':
        return '🏠';
      case 'Map':
        return '🗺️';
      case 'Messages':
        return '💬';
      case 'Profile':
        return '👤';
      default:
        return '•';
    }
  };

  return (
    <View style={styles.tabIcon}>
      <Text style={[styles.tabIconText, focused && styles.tabIconFocused]}>
        {getIcon()}
      </Text>
    </View>
  );
};

// Stack navigators
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Home stack
const HomeStack: React.FC = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: theme.colors.surface },
      headerTintColor: theme.colors.text,
      headerTitleStyle: { fontWeight: '600' },
    }}
  >
    <Stack.Screen 
      name="HomeList" 
      component={HomeScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="PlotDetail" 
      component={PlotDetailScreen}
      options={{ title: 'Plot Details' }}
    />
  </Stack.Navigator>
);

// Map stack
const MapStack: React.FC = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: theme.colors.surface },
      headerTintColor: theme.colors.text,
      headerTitleStyle: { fontWeight: '600' },
    }}
  >
    <Stack.Screen 
      name="MapView" 
      component={MapScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="PlotDetail" 
      component={PlotDetailScreen}
      options={{ title: 'Plot Details' }}
    />
  </Stack.Navigator>
);

// Chat stack
interface ChatStackProps {
  userId: string;
}

const ChatStack: React.FC<ChatStackProps> = ({ userId }) => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: theme.colors.surface },
      headerTintColor: theme.colors.text,
      headerTitleStyle: { fontWeight: '600' },
    }}
  >
    <Stack.Screen 
      name="ChatList"
      options={{ headerShown: false }}
    >
      {(props) => <ChatListScreen {...props} userId={userId} />}
    </Stack.Screen>
    <Stack.Screen 
      name="Chat"
      options={{ title: 'Chat' }}
    >
      {(props) => <ChatScreen {...props} userId={userId} />}
    </Stack.Screen>
  </Stack.Navigator>
);

// Main tab navigator
interface MainTabsProps {
  user: User;
  onSignOut: () => void;
}

const MainTabs: React.FC<MainTabsProps> = ({ user, onSignOut }) => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      tabBarActiveTintColor: theme.colors.primary,
      tabBarInactiveTintColor: theme.colors.textMuted,
      tabBarStyle: {
        backgroundColor: theme.colors.surface,
        borderTopColor: theme.colors.border,
      },
      headerShown: false,
    })}
  >
    <Tab.Screen name="Home" component={HomeStack} />
    <Tab.Screen name="Map" component={MapStack} />
    <Tab.Screen name="Messages">
      {() => <ChatStack userId={user.id} />}
    </Tab.Screen>
    <Tab.Screen name="Profile">
      {() => <ProfileScreen user={user} onSignOut={onSignOut} />}
    </Tab.Screen>
  </Tab.Navigator>
);

// Auth stack
interface AuthStackProps {
  onLogin: (phoneNumber: string, otp: string) => Promise<void>;
}

const AuthStack: React.FC<AuthStackProps> = ({ onLogin }) => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login">
      {() => <LoginScreen onLogin={onLogin} />}
    </Stack.Screen>
  </Stack.Navigator>
);

// Main app navigator
interface AppNavigatorProps {
  isAuthenticated: boolean;
  user: User | null;
  onLogin: (phoneNumber: string, otp: string) => Promise<void>;
  onSignOut: () => void;
}

export const AppNavigator: React.FC<AppNavigatorProps> = ({
  isAuthenticated,
  user,
  onLogin,
  onSignOut,
}) => {
  return (
    <NavigationContainer theme={navigationTheme}>
      {isAuthenticated && user ? (
        <MainTabs user={user} onSignOut={onSignOut} />
      ) : (
        <AuthStack onLogin={onLogin} />
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconText: {
    fontSize: 20,
    opacity: 0.6,
  },
  tabIconFocused: {
    opacity: 1,
  },
});
