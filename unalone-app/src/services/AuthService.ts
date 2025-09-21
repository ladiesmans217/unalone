// Authentication service for handling user authentication
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './ApiService';
import { APP_CONFIG } from '../utils/constants';
import { AuthRequest, AuthResponse, User } from '../types';

class AuthService {
  // Register new user
  async register(email: string, password: string, realName: string, nickname: string): Promise<AuthResponse> {
    const requestData: AuthRequest = {
      email,
      password,
      real_name: realName,
      nickname,
    };

    const response = await apiService.post<AuthResponse>('/auth/register', requestData);
    
    if (response.success && response.data) {
      // Transform user data to match frontend types
      const transformedUser = this.transformUserData(response.data.user);
      const transformedResponse = { ...response.data, user: transformedUser };
      
      // Save token and user data
      await this.saveAuthData(response.data.token, transformedUser);
      return transformedResponse;
    }
    
    throw new Error(response.message || 'Registration failed');
  }

  // Login user
  async login(email: string, password: string): Promise<AuthResponse> {
    const requestData: AuthRequest = {
      email,
      password,
    };

    const response = await apiService.post<AuthResponse>('/auth/login', requestData);
    
    if (response.success && response.data) {
      // Transform user data to match frontend types
      const transformedUser = this.transformUserData(response.data.user);
      const transformedResponse = { ...response.data, user: transformedUser };
      
      // Save token and user data
      await this.saveAuthData(response.data.token, transformedUser);
      return transformedResponse;
    }
    
    throw new Error(response.message || 'Login failed');
  }

  // Logout user
  async logout(): Promise<void> {
    await AsyncStorage.multiRemove([
      APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN,
      APP_CONFIG.STORAGE_KEYS.USER_DATA,
    ]);
  }

  // Check if user is logged in
  async isLoggedIn(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      return !!token;
    } catch (error) {
      return false;
    }
  }

  // Get current user data
  async getCurrentUser(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem(APP_CONFIG.STORAGE_KEYS.USER_DATA);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      return null;
    }
  }

  // Transform user data from snake_case API to camelCase frontend format
  private transformUserData(userData: any): User {
    return {
      id: userData.id,
      email: userData.email,
      realName: userData.real_name || userData.realName,
      nickname: userData.nickname,
      phoneNumber: userData.phone_number || userData.phoneNumber,
      isPhoneVerified: userData.is_phone_verified || userData.isPhoneVerified || false,
      isEmailVerified: userData.is_email_verified || userData.isEmailVerified || false,
      profileImageURL: userData.profile_image_url || userData.profileImageURL,
      bio: userData.bio,
      dateOfBirth: userData.date_of_birth || userData.dateOfBirth,
      gender: userData.gender,
      interests: userData.interests || [],
      points: userData.points ?? userData.Points,
      level: userData.level ?? userData.Level,
      createdAt: new Date(userData.created_at || userData.createdAt),
      updatedAt: new Date(userData.updated_at || userData.updatedAt),
    };
  }

  // Save authentication data
  private async saveAuthData(token: string, user: User): Promise<void> {
    await AsyncStorage.multiSet([
      [APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN, token],
      [APP_CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(user)],
    ]);
  }

  // Refresh token
  async refreshToken(): Promise<string | null> {
    try {
      const response = await apiService.post<{ token: string }>('/auth/refresh');
      
      if (response.success && response.data) {
        await AsyncStorage.setItem(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN, response.data.token);
        return response.data.token;
      }
      
      return null;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }

  // Get fresh user data from backend
  async fetchCurrentUser(): Promise<User> {
    const response = await apiService.get<any>('/users/profile');
    
    if (response.success && response.data) {
      // Transform user data to match frontend types
      const transformedUser = this.transformUserData(response.data);
      
      // Update stored user data
      await AsyncStorage.setItem(APP_CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(transformedUser));
      return transformedUser;
    }
    
    throw new Error(response.message || 'Failed to get user data');
  }
}

// Export singleton instance
export const authService = new AuthService();
