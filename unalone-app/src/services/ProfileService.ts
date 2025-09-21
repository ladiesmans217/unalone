// Profile service for handling user profile operations
import { apiService } from './ApiService';
import { APP_CONFIG } from '../utils/constants';

export interface UpdateProfileRequest {
  real_name: string;
  nickname: string;
  bio?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  location?: {
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
  };
  interests?: string[];
}

export interface PhoneVerificationRequest {
  phone_number: string;
}

export interface VerifyPhoneRequest {
  phone_number: string;
  code: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  notifications_enabled: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  location_sharing: boolean;
  profile_visibility: 'public' | 'friends' | 'private';
  show_online_status: boolean;
  distance_radius: number;
  age_range_min: number;
  age_range_max: number;
}

export interface UpdateSettingsRequest {
  notifications_enabled: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  location_sharing: boolean;
  profile_visibility: 'public' | 'friends' | 'private';
  show_online_status: boolean;
  distance_radius: number;
  age_range_min: number;
  age_range_max: number;
}

export interface ReportUserRequest {
  reported_user_id: string;
  reason: 'harassment' | 'spam' | 'inappropriate' | 'fake-profile' | 'other';
  description?: string;
}

export interface BlockUserRequest {
  user_id: string;
}

class ProfileService {
  // Update user profile
  async updateProfile(profileData: UpdateProfileRequest) {
    const response = await apiService.put('/profile/update', profileData);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Profile update failed');
  }

  // Send phone verification code
  async sendPhoneVerification(phoneNumber: string) {
    const requestData: PhoneVerificationRequest = {
      phone_number: phoneNumber,
    };

    const response = await apiService.post('/profile/phone/verify', requestData);
    
    if (response.success) {
      return response.message;
    }
    
    throw new Error(response.message || 'Failed to send verification code');
  }

  // Verify phone number with code
  async verifyPhone(phoneNumber: string, code: string) {
    const requestData: VerifyPhoneRequest = {
      phone_number: phoneNumber,
      code: code,
    };

    const response = await apiService.post('/profile/phone/confirm', requestData);
    
    if (response.success) {
      return response.message;
    }
    
    throw new Error(response.message || 'Phone verification failed');
  }

  // Update profile image
  async updateProfileImage(imageUrl: string) {
    const response = await apiService.post('/profile/image', {
      image_url: imageUrl,
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Image update failed');
  }

  // Get user settings
  async getUserSettings(): Promise<UserSettings> {
    const response = await apiService.get<UserSettings>('/profile/settings');
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to get settings');
  }

  // Update user settings
  async updateSettings(settings: UpdateSettingsRequest): Promise<UserSettings> {
    const response = await apiService.put<UserSettings>('/profile/settings', settings);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Settings update failed');
  }

  // Block user
  async blockUser(userId: string) {
    const requestData: BlockUserRequest = {
      user_id: userId,
    };

    const response = await apiService.post('/safety/block', requestData);
    
    if (response.success) {
      return response.message;
    }
    
    throw new Error(response.message || 'Failed to block user');
  }

  // Unblock user
  async unblockUser(userId: string) {
    const requestData: BlockUserRequest = {
      user_id: userId,
    };

    const response = await apiService.post('/safety/unblock', requestData);
    
    if (response.success) {
      return response.message;
    }
    
    throw new Error(response.message || 'Failed to unblock user');
  }

  // Report user
  async reportUser(reportData: ReportUserRequest) {
    const response = await apiService.post('/safety/report', reportData);
    
    if (response.success) {
      return response.message;
    }
    
    throw new Error(response.message || 'Failed to report user');
  }
}

// Export singleton instance
export const profileService = new ProfileService();
