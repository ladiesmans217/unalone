import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, Text, View, Button, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Import contexts and screens
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { RegisterScreen } from './src/screens/auth/RegisterScreen';
import { EditProfileScreen } from './src/screens/profile/EditProfileScreen';
import { PhoneVerificationScreen } from './src/screens/profile/PhoneVerificationScreen';
import { ReportUserScreen } from './src/screens/safety/ReportUserScreen';
import { BlockedUsersScreen } from './src/screens/safety/BlockedUsersScreen';
import { SafetySettingsScreen } from './src/screens/safety/SafetySettingsScreen';
import FriendsScreen from './src/screens/profile/FriendsScreen';

// Import hotspot screens (via index to get named re-exports)
import { 
  HotspotMapScreen,
  HotspotListScreen,
  CreateHotspotScreen,
  HotspotDetailsScreen,
  EditHotspotScreen,
  ChatRoomScreen,
} from './src/screens/hotspots';
import AIAssistantScreen from './src/screens/assistant/AIAssistantScreen';

import { RootStackParamList, AuthStackParamList } from './src/types';
import { APP_CONFIG } from './src/utils/constants';

// Create navigators
const Stack = createStackNavigator<RootStackParamList>();
const AuthStack = createStackNavigator<AuthStackParamList>();

// Authentication flow navigator
function AuthNavigator() {
  return (
    <AuthStack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

// Main home screen (authenticated)
function HomeScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  
  return (
    <View style={styles.container}>
      <Text style={styles.text}>🏠 Welcome, {user?.nickname}!</Text>
      <Text style={styles.subtitle}>You're successfully logged in to Unalone</Text>
      <Text style={styles.userInfo}>Email: {user?.email}</Text>
      <Text style={styles.userInfo}>Real Name: {user?.realName}</Text>
  <Text style={styles.userInfo}>Level: {user?.level ?? 1}</Text>
  <Text style={styles.userInfo}>Points: {user?.points ?? 0}</Text>
      
      <View style={styles.buttonContainer}>
        {/* NEW HOTSPOT FEATURES - Main Navigation */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>🚀 NEW: Location Features</Text>
          <Button
            title="🗺️ Hotspot Map (with Clustering!)"
            onPress={() => navigation.navigate('HotspotMap')}
            color={APP_CONFIG.COLORS.PRIMARY}
          />
          <Button
            title="📍 Find Hotspots"
            onPress={() => navigation.navigate('HotspotList')}
            color={APP_CONFIG.COLORS.PRIMARY}
          />
          <Button
            title="➕ Create Hotspot"
            onPress={() => navigation.navigate('CreateHotspot')}
            color={APP_CONFIG.COLORS.SUCCESS}
          />
        </View>

        {/* Profile Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>👤 Profile</Text>
          <Button
            title="Edit Profile"
            onPress={() => navigation.navigate('EditProfile')}
            color={APP_CONFIG.COLORS.PRIMARY}
          />
          <Button
            title="Friends"
            onPress={() => navigation.navigate('Friends')}
            color={APP_CONFIG.COLORS.PRIMARY}
          />
          
          {user?.isPhoneVerified ? (
            <Button
              title="✓ Phone Verified"
              onPress={() => {}}
              color={APP_CONFIG.COLORS.SUCCESS}
              disabled
            />
          ) : (
            <Button
              title="Verify Phone"
              onPress={() => navigation.navigate('PhoneVerification')}
              color={APP_CONFIG.COLORS.WARNING}
            />
          )}
        </View>
        
        {/* Safety Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>🔒 Safety</Text>
          <Button
            title="Safety Settings"
            onPress={() => navigation.navigate('SafetySettings')}
            color={APP_CONFIG.COLORS.WARNING}
          />
          
          <Button
            title="Blocked Users"
            onPress={() => navigation.navigate('BlockedUsers')}
            color={APP_CONFIG.COLORS.ERROR}
          />
          
          <Button
            title="Test Report User"
            onPress={() => navigation.navigate('ReportUser', { userId: 'test123', userName: 'TestUser' })}
            color={APP_CONFIG.COLORS.TEXT_SECONDARY}
          />
        </View>
        
        <Button
          title="Logout"
          onPress={logout}
          color={APP_CONFIG.COLORS.TEXT_SECONDARY}
        />
      </View>
      
      {/* Floating AI button */}
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AIAssistant')}>
        <Ionicons name="chatbubbles" size={26} color="#fff" />
      </TouchableOpacity>

      <StatusBar style="auto" />
    </View>
  );
}

// Main navigation component
function AppNavigator() {
  const { isLoggedIn, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isLoggedIn ? (
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen 
            name="Home" 
            component={HomeScreen} 
            options={{ title: 'Unalone - Home' }}
          />
          
          {/* NEW: Hotspot Screens with Geospatial Optimization */}
          <Stack.Screen 
            name="HotspotMap" 
            component={HotspotMapScreen} 
            options={{ title: '🗺️ Hotspot Map (Optimized)' }}
          />
          <Stack.Screen 
            name="HotspotList" 
            component={HotspotListScreen} 
            options={{ title: '📍 Find Hotspots' }}
          />
          <Stack.Screen 
            name="CreateHotspot" 
            component={CreateHotspotScreen} 
            options={{ title: '➕ Create Hotspot' }}
          />
          <Stack.Screen 
            name="HotspotDetails" 
            component={HotspotDetailsScreen} 
            options={{ title: 'Hotspot Details' }}
          />
          <Stack.Screen 
            name="EditHotspot" 
            component={EditHotspotScreen} 
            options={{ title: 'Edit Hotspot' }}
          />
          <Stack.Screen 
            name="ChatRoom" 
            component={ChatRoomScreen} 
            options={{ title: 'Chat' }}
          />
          <Stack.Screen 
            name="AIAssistant" 
            component={AIAssistantScreen} 
            options={{ title: 'AI Assistant' }}
          />
          
          {/* Profile Screens */}
          <Stack.Screen 
            name="EditProfile" 
            component={EditProfileScreen} 
            options={{ title: 'Edit Profile' }}
          />
          <Stack.Screen 
            name="Friends" 
            component={FriendsScreen} 
            options={{ title: 'Friends' }}
          />
          <Stack.Screen 
            name="PhoneVerification" 
            component={PhoneVerificationScreen} 
            options={{ title: 'Phone Verification' }}
          />
          
          {/* Safety Screens */}
          <Stack.Screen 
            name="SafetySettings" 
            component={SafetySettingsScreen} 
            options={{ title: 'Safety Settings' }}
          />
          <Stack.Screen 
            name="BlockedUsers" 
            component={BlockedUsersScreen} 
            options={{ title: 'Blocked Users' }}
          />
          <Stack.Screen 
            name="ReportUser" 
            component={ReportUserScreen} 
            options={{ title: 'Report User' }}
          />
        </Stack.Navigator>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}

// Root app component
export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: APP_CONFIG.COLORS.TEXT_PRIMARY,
  },
  subtitle: {
    fontSize: 16,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 10,
  },
  userInfo: {
    fontSize: 14,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    marginBottom: 5,
  },
  buttonContainer: {
    marginTop: 20,
    width: '90%',
    gap: 15,
  },
  sectionContainer: {
    width: '100%',
    marginBottom: 10,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: APP_CONFIG.COLORS.TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND_LIGHT || '#f0f0f0',
    borderRadius: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND,
  },
  loadingText: {
    fontSize: 16,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: APP_CONFIG.COLORS.SECONDARY,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  // icon is used, keep style for potential accessibility text
  fabText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});
