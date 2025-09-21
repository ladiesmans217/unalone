// Main types file for the Unalone app
// This file contains all TypeScript interfaces and types used throughout the app

// User related types
export interface User {
  id: string;
  email: string;
  realName: string;        // Private - only visible to user themselves
  nickname: string;        // Public - visible to other users
  phoneNumber?: string;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  profileImageURL?: string;
  bio?: string;
  dateOfBirth?: string;
  gender?: string;
  interests?: string[];
  // Gamification
  points?: number;
  level?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Friends types
export interface PublicUser { id: string; nickname: string }
export interface FriendRequests { received: PublicUser[]; sent: PublicUser[] }

// Location related types
export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface Address {
  street?: string;
  city: string;
  region?: string;
  country: string;
  postalCode?: string;
}

// Hotspot related types
export interface Hotspot {
  id: string;
  name: string;
  description: string;
  category: HotspotCategory;
  location: LocationCoordinates;
  address: Address;
  createdBy: string;
  createdByNickname: string;
  maxCapacity?: number;
  currentOccupancy: number;
  isActive: boolean;
  isPublic: boolean;
  tags: string[];
  scheduledTime?: string; // ISO date string
  endTime?: string; // ISO date string
  imageUrl?: string;
  attendees: string[]; // User IDs
  createdAt: string;
  updatedAt: string;
}

export type HotspotCategory = 
  | 'cafe' 
  | 'restaurant' 
  | 'park' 
  | 'gym' 
  | 'library' 
  | 'beach' 
  | 'bar' 
  | 'event' 
  | 'study' 
  | 'sports' 
  | 'shopping' 
  | 'entertainment' 
  | 'other';

export interface CreateHotspotRequest {
  name: string;
  description: string;
  category: HotspotCategory;
  location: LocationCoordinates;
  address: Address;
  maxCapacity?: number;
  isPublic: boolean;
  tags: string[];
  scheduledTime?: Date;
  endTime?: Date;
  imageUrl?: string;
}

export interface UpdateHotspotRequest extends Partial<CreateHotspotRequest> {
  id: string;
}

export interface JoinHotspotRequest {
  hotspotId: string;
}

export interface HotspotSearchFilters {
  category?: HotspotCategory;
  radius?: number; // in kilometers
  limit?: number;
  offset?: number;
  isActive?: boolean;
  hasAvailableSpots?: boolean;
  tags?: string[];
  startTime?: Date;
  endTime?: Date;
}

// === New Optimized Geospatial Types ===

export interface HotspotCluster {
  id: string;
  centerLocation: LocationCoordinates;
  boundingBox: BoundingBox;
  hotspotCount: number;
  totalOccupancy: number;
  maxCapacity: number;
  categories: string[];
  zoomLevel: number;
  radius: number;
  hotspotIds?: string[];
}

export interface BoundingBox {
  northEast: LocationCoordinates;
  southWest: LocationCoordinates;
}

export interface OptimizedSearchRequest {
  geospatialQuery: GeospatialQuery;
  filters: SearchFilters;
  pagination: Pagination;
  clustering: ClusterConfig;
}

export interface GeospatialQuery {
  center: LocationCoordinates;
  radius: number;
  boundingBox?: BoundingBox;
  zoomLevel: number;
  clusteringMode: ClusteringMode;
  maxResults: number;
  categories?: HotspotCategory[];
  timeFilter?: TimeFilter;
}

export type ClusteringMode = 'none' | 'grid' | 'distance' | 'kmeans' | 'auto';

export interface SearchFilters {
  categories?: HotspotCategory[];
  isActive?: boolean;
  hasAvailableSpots?: boolean;
  tags?: string[];
  minCapacity?: number;
  maxCapacity?: number;
  timeFilter?: TimeFilter;
  createdBy?: string;
  isPublic?: boolean;
}

export interface TimeFilter {
  startTime?: Date;
  endTime?: Date;
  daysOfWeek?: string[];
  timeOfDay?: string;
}

export interface Pagination {
  limit: number;
  offset: number;
  pageToken?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface ClusterConfig {
  mode: ClusteringMode;
  minClusterSize: number;
  maxClusterSize: number;
  gridSize?: number;
  zoomLevel: number;
  includeHotspots: boolean;
}

export interface OptimizedSearchResponse {
  clusters: HotspotCluster[];
  hotspots: HotspotWithDistance[];
  totalCount: number;
  clusterCount: number;
  hasMore: boolean;
  nextPageToken?: string;
  queryTime: number;
  cacheHit: boolean;
  zoomLevel: number;
}

export interface HotspotWithDistance {
  hotspot: Hotspot;
  distance: number;
}

// Chat related types
export interface ChatMessage {
  id: string;
  hotspotId: string;
  userId: string;
  nickname: string; // Display name only
  content: string;
  createdAt: string; // ISO timestamp
}

// AI Assistant types
export interface AIChatSession {
  id: string;
  user_id: string; // backend uses snake_case
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  id: string;
  session_id: string;
  role: 'user' | 'ai';
  content: string;
  created_at: string;
}

// Authentication related types
export interface AuthRequest {
  email: string;
  password: string;
  real_name?: string;  // For registration
  nickname?: string;   // For registration
}

export interface AuthResponse {
  token: string;
  user: User;
  message: string;
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message: string;
  errors?: string[];
}

// Navigation types (will be extended later)
export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Register: undefined;
  Profile: undefined;
  EditProfile: undefined;
  PhoneVerification: { phoneNumber?: string };
  Settings: undefined;
  SafetySettings: undefined;
  BlockedUsers: undefined;
  ReportUser: { userId: string; userName: string };
  HotspotMap: undefined;
  HotspotList: { filters?: HotspotSearchFilters };
  HotspotDetails: { hotspotId: string };
  CreateHotspot: { location?: LocationCoordinates };
  EditHotspot: { hotspotId: string };
  ChatRoom: { hotspotId: string; hotspotName?: string };
  Friends: undefined;
  AIAssistant: undefined;
};

// Auth navigation stack
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};
