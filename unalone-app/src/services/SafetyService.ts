// Safety service for handling user safety operations
import { apiService } from './ApiService';

export interface SafetyReport {
  id: string;
  reported_user_id: string;
  reporter_id: string;
  reason: string;
  description: string;
  status: 'pending' | 'reviewed' | 'resolved';
  created_at: string;
}

export interface BlockedUser {
  id: string;
  nickname: string;
  profile_image_url?: string;
  blocked_at: string;
}

export interface ContentModerationRequest {
  content_id: string;
  content_type: 'message' | 'profile' | 'post';
  content: string;
  reason: string;
}

export interface SafetySettings {
  auto_moderate_content: boolean;
  block_explicit_content: boolean;
  require_phone_verification: boolean;
  minimum_account_age_days: number;
  enable_ai_content_filtering: boolean;
}

class SafetyService {
  // Report content for moderation
  async reportContent(request: ContentModerationRequest) {
    const response = await apiService.post('/safety/content/report', request);
    
    if (response.success) {
      return response.message;
    }
    
    throw new Error(response.message || 'Failed to report content');
  }

  // Get blocked users list
  async getBlockedUsers(): Promise<BlockedUser[]> {
    const response = await apiService.get<BlockedUser[]>('/safety/blocked');
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to get blocked users');
  }

  // Get user's safety reports
  async getUserReports(): Promise<SafetyReport[]> {
    const response = await apiService.get<SafetyReport[]>('/safety/reports');
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to get reports');
  }

  // Get safety settings
  async getSafetySettings(): Promise<SafetySettings> {
    const response = await apiService.get<SafetySettings>('/profile/settings');
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to get safety settings');
  }

  // Update safety settings
  async updateSafetySettings(settings: Partial<SafetySettings>): Promise<SafetySettings> {
    const response = await apiService.put<SafetySettings>('/profile/settings', settings);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to update safety settings');
  }

  // Check if content is safe (AI moderation)
  async checkContentSafety(content: string, contentType: 'message' | 'profile' | 'post') {
    const response = await apiService.post('/safety/content/check', {
      content,
      content_type: contentType,
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to check content safety');
  }

  // Emergency report (high priority)
  async emergencyReport(userId: string, description: string) {
    const response = await apiService.post('/safety/emergency', {
      reported_user_id: userId,
      description,
    });
    
    if (response.success) {
      return response.message;
    }
    
    throw new Error(response.message || 'Failed to submit emergency report');
  }

  // Get safety guidelines
  async getSafetyGuidelines() {
    const response = await apiService.get('/safety/guidelines');
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to get safety guidelines');
  }

  // Validate user interaction (check if user is blocked, etc.)
  async validateUserInteraction(targetUserId: string) {
    const response = await apiService.get(`/safety/validate/${targetUserId}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return { canInteract: true, reason: null };
  }
}

// Export singleton instance
export const safetyService = new SafetyService();
