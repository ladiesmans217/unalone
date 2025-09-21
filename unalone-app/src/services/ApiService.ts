// API Service for handling HTTP requests to the backend
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG } from '../utils/constants';
import { ApiResponse } from '../types';

class ApiService {
  private baseURL: string = APP_CONFIG.API_BASE_URL;

  // Get stored auth token
  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  // Create headers with auth token if available
  private async createHeaders(): Promise<HeadersInit> {
    const token = await this.getAuthToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  // Generic HTTP request method
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const headers = await this.createHeaders();
      const url = `${this.baseURL}${endpoint}`;

      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      // Gracefully handle empty responses (e.g., 204 No Content)
      const contentType = response.headers.get('content-type') || '';
      let body: any = null;
      if (response.status !== 204) {
        if (contentType.includes('application/json')) {
          try {
            body = await response.json();
          } catch (e) {
            // Fallback to text to preserve diagnostics
            const txt = await response.text();
            body = { message: txt };
          }
        } else {
          // Non-JSON response; read as text to avoid SyntaxError
          const txt = await response.text();
          body = { message: txt };
        }
      }

      if (!response.ok) {
        return {
          success: false,
          message: (body && (body.message || body.error)) || `Request failed (${response.status})` ,
          errors: (body && (body.errors || (body.error ? [body.error] : []))) || [],
        };
      }

      return {
        success: true,
        data: body?.data ?? body ?? undefined,
        message: (body && (body.message || 'Success')) || 'Success',
      } as ApiResponse<T>;
    } catch (error) {
      // Use warn to avoid noisy red overlays in development for transient network issues
      console.warn('API Request Error:', error);
      return {
        success: false,
        message: 'Network request failed. Check API base URL or connectivity.',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // HTTP Methods
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Save auth token to storage
  async saveAuthToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN, token);
    } catch (error) {
      console.error('Error saving auth token:', error);
    }
  }

  // Remove auth token from storage
  async removeAuthToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      console.error('Error removing auth token:', error);
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();
