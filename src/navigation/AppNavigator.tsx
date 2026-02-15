import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { theme } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import {
  LoginScreen,
  HomeScreen,
  PlotDetailScreen,
  MapScreen,
  ChatListScreen,
  ChatScreen,
  ProfileScreen,
  AddPlotScreen,
  MyListingsScreen,
  EditPlotScreen,
  AdminScreen,
} from '../screens';

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

const TabIcon: React.FC<{ name: string; focused: boolean }> = ({ name, focused }) => {
  const getIcon = () => {
    switch (name) {
      case 'Головна':
        return '🏠';
      case 'Карта':
        return '🗺️';
      case 'Мої':
        return '📋';
      case 'Повідомлення':
        return '💬';
      case 'Профіль':
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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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
      options={{ title: 'Деталі ділянки' }}
    />
  </Stack.Navigator>
);

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
      options={{ title: 'Деталі ділянки' }}
    />
  </Stack.Navigator>
);

const SellerStack: React.FC = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: theme.colors.surface },
      headerTintColor: theme.colors.text,
      headerTitleStyle: { fontWeight: '600' },
    }}
  >
    <Stack.Screen 
      name="MyListings" 
      component={MyListingsScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="AddPlot" 
      component={AddPlotScreen}
      options={{ title: 'Додати ділянку' }}
    />
    <Stack.Screen 
      name="EditPlot" 
      component={EditPlotScreen}
      options={{ title: 'Редагувати' }}
    />
    <Stack.Screen 
      name="PlotDetail" 
      component={PlotDetailScreen}
      options={{ title: 'Деталі ділянки' }}
    />
  </Stack.Navigator>
);

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
      options={{ title: 'Чат' }}
    >
      {(props) => <ChatScreen {...props} userId={userId} />}
    </Stack.Screen>
  </Stack.Navigator>
);

const MainTabs: React.FC = () => {
  const { user, signOut, isSeller, isAdmin } = useAuth();
  
  if (!user) return null;

  return (
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
      <Tab.Screen name="Головна" component={HomeStack} />
      <Tab.Screen name="Карта" component={MapStack} />
      {(isSeller || isAdmin) && (
        <Tab.Screen name="Мої" component={SellerStack} />
      )}
      <Tab.Screen name="Повідомлення">
        {() => <ChatStack userId={user.id} />}
      </Tab.Screen>
      <Tab.Screen name="Профіль">
        {() => <ProfileScreen user={user} onSignOut={signOut} isAdmin={isAdmin} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

const AuthStack: React.FC = () => {
  const { confirmOTP, signInEmail, signUpEmail, resetPasswordEmail } = useAuth();

  const handlePhoneLogin = async (phoneNumber: string, otp: string) => {
    await confirmOTP(phoneNumber, otp);
  };

  const handleEmailSignIn = async (email: string, password: string) => {
    await signInEmail(email, password);
  };

  const handleEmailSignUp = async (email: string, password: string) => {
    await signUpEmail(email, password);
  };

  const handleResetPassword = async (email: string) => {
    await resetPasswordEmail(email);
  };

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login">
        {() => (
          <LoginScreen 
            onPhoneLogin={handlePhoneLogin}
            onEmailSignIn={handleEmailSignIn}
            onEmailSignUp={handleEmailSignUp}
            onResetPassword={handleResetPassword}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

export const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Завантаження...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {isAuthenticated ? <MainTabs /> : <AuthStack />}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
  },
});
