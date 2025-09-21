// Hotspot service for managing location-based meetup spots
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './ApiService';
import { 
  Hotspot, 
  CreateHotspotRequest, 
  UpdateHotspotRequest, 
  HotspotSearchFilters,
  LocationCoordinates,
  OptimizedSearchRequest,
  OptimizedSearchResponse,
  HotspotCluster,
  ClusteringMode,
  HotspotWithDistance
} from '../types';

export interface HotspotSearchResponse {
  hotspots: HotspotWithDistance[];
  total: number;
  hasMore: boolean;
}

// Use HotspotWithDistance from '../types'

export interface ViewportBounds {
  northEast: LocationCoordinates;
  southWest: LocationCoordinates;
}

class HotspotService {
  private readonly CACHE_KEY = 'hotspots_cache';
  private readonly CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
  private cache: Map<string, { data: Hotspot; timestamp: number }> = new Map();

  // Create a new hotspot
  async createHotspot(hotspotData: CreateHotspotRequest): Promise<Hotspot> {
  // Backend route is '/api/v1/hotspots/' (note trailing slash). Some React Native fetch
  // versions have trouble with 30x redirects on POST, so call the exact path.
  const payload = this.toBackendCreateRequest(hotspotData);
  const response = await apiService.post<any>('/hotspots/', payload);
    
    if (response.success && response.data) {
      const normalized = this.normalizeHotspot(response.data);
      // Add to cache
      this.addToCache(normalized);
      return normalized;
    }
    
    throw new Error(response.message || 'Failed to create hotspot');
  }

  // Get hotspot by ID
  async getHotspot(id: string, useCache: boolean = true): Promise<Hotspot> {
    // Check cache first
    if (useCache) {
      const cached = this.getFromCache(id);
      if (cached) return cached;
    }

    const response = await apiService.get<any>(`/hotspots/${id}`);
    
    if (response.success && response.data) {
      const normalized = this.normalizeHotspot(response.data);
      this.addToCache(normalized);
      return normalized;
    }
    
    throw new Error(response.message || 'Failed to get hotspot');
  }

  // Update hotspot
  async updateHotspot(id: string, updates: UpdateHotspotRequest): Promise<Hotspot> {
    const payload = this.toBackendUpdateRequest(updates);
    const response = await apiService.put<any>(`/hotspots/${id}`, payload);
    
    if (response.success && response.data) {
      const normalized = this.normalizeHotspot(response.data);
      this.addToCache(normalized);
      return normalized;
    }
    
    throw new Error(response.message || 'Failed to update hotspot');
  }

  // Delete hotspot
  async deleteHotspot(id: string): Promise<void> {
    const response = await apiService.delete(`/hotspots/${id}`);
    
    if (response.success) {
      this.removeFromCache(id);
      return;
    }
    
    throw new Error(response.message || 'Failed to delete hotspot');
  }

  // Search hotspots with viewport optimization (legacy method)
  async searchHotspots(
    location: LocationCoordinates,
    filters: HotspotSearchFilters = {},
    viewport?: ViewportBounds
  ): Promise<HotspotSearchResponse> {
    const params = new URLSearchParams({
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
      radius: (filters.radius || 10).toString(),
      limit: (filters.limit || 50).toString(),
      offset: (filters.offset || 0).toString(),
    });

    // Add optional filters
    if (filters.category) params.append('category', filters.category);
    if (filters.isActive !== undefined) params.append('is_active', filters.isActive.toString());
    if (filters.hasAvailableSpots !== undefined) params.append('has_available_spots', filters.hasAvailableSpots.toString());

    const response = await apiService.get<HotspotSearchResponse>(`/hotspots/search?${params}`);
    
    if (response.success && response.data) {
      // Normalize list to app types
      const normalizedList = (response.data.hotspots || []).map(h => this.normalizeHotspotWithDistance(h as any));

      // Cache normalized hotspots
      normalizedList.forEach(item => {
        this.addToCache(item.hotspot);
      });

      // If viewport is provided, filter results to viewport bounds
      const finalList = viewport ? this.filterByViewport(normalizedList, viewport) : normalizedList;

      return {
        hotspots: finalList,
        total: response.data.total,
        hasMore: response.data.hasMore,
      };
    }
    
    throw new Error(response.message || 'Failed to search hotspots');
  }

  // NEW OPTIMIZED SEARCH METHOD
  async searchHotspotsOptimized(
    location: LocationCoordinates,
    zoomLevel: number,
    filters: HotspotSearchFilters = {},
    clusteringMode: ClusteringMode = 'auto',
    viewport?: ViewportBounds
  ): Promise<OptimizedSearchResponse> {
    // Check cache first for optimized results
    const cacheKey = `optimized_${location.latitude}_${location.longitude}_${zoomLevel}_${clusteringMode}`;
    const cached = this.getOptimizedFromCache(cacheKey);
    if (cached) return cached;

    // Build optimized search request (camelCase for app types)
    const request: OptimizedSearchRequest = {
      geospatialQuery: {
        center: location,
        radius: filters.radius || 10,
        boundingBox: viewport,
        zoomLevel,
        clusteringMode,
        maxResults: filters.limit || 100,
        categories: filters.category ? [filters.category] : [],
      },
      filters: {
        categories: filters.category ? [filters.category] : [],
        isActive: filters.isActive,
        hasAvailableSpots: filters.hasAvailableSpots,
        tags: filters.tags || [],
        isPublic: true,
      },
      pagination: {
        limit: filters.limit || 50,
        offset: filters.offset || 0,
        sortBy: 'distance',
        sortOrder: 'asc',
      },
      clustering: {
        mode: clusteringMode,
        minClusterSize: this.getMinClusterSize(zoomLevel),
        maxClusterSize: this.getMaxClusterSize(zoomLevel),
        gridSize: this.getGridSize(zoomLevel),
        zoomLevel,
        includeHotspots: zoomLevel > 15, // Include individual hotspots at high zoom
      },
    };

    // Convert request to backend snake_case schema
    const payload = this.toBackendOptimizedRequest(request);

    const response = await apiService.post<any>('/hotspots/search/optimized', payload);
    
    if (response.success && response.data) {
      // Normalize backend response keys to app types
      const normalizedRaw = this.normalizeOptimizedResponse(response.data);

      // Ensure hotspots array items are normalized to { hotspot, distance }
      const normalized: OptimizedSearchResponse = {
        ...normalizedRaw,
        hotspots: (normalizedRaw.hotspots || []).map(h => this.normalizeHotspotWithDistance(h as any)),
      };

      // Cache the optimized results
      this.addOptimizedToCache(cacheKey, normalized);
      
      // Cache individual hotspots for later use (null-safe)
      (normalized.hotspots || []).forEach(item => {
        this.addToCache(item.hotspot);
      });

      return normalized;
    }
    
    throw new Error(response.message || 'Failed to perform optimized search');
  }
  // Map app request (camelCase) to backend expected snake_case payload
  private toBackendOptimizedRequest(req: OptimizedSearchRequest): any {
    const bbox = req.geospatialQuery.boundingBox
      ? {
          north_east: {
            latitude: req.geospatialQuery.boundingBox.northEast.latitude,
            longitude: req.geospatialQuery.boundingBox.northEast.longitude,
          },
          south_west: {
            latitude: req.geospatialQuery.boundingBox.southWest.latitude,
            longitude: req.geospatialQuery.boundingBox.southWest.longitude,
          },
        }
      : undefined;

    const timeFilter = req.filters.timeFilter
      ? {
          start_time: req.filters.timeFilter.startTime,
          end_time: req.filters.timeFilter.endTime,
          days_of_week: req.filters.timeFilter.daysOfWeek,
          time_of_day: req.filters.timeFilter.timeOfDay,
        }
      : undefined;

    return {
      geospatial_query: {
        center: {
          latitude: req.geospatialQuery.center.latitude,
          longitude: req.geospatialQuery.center.longitude,
        },
        radius_km: req.geospatialQuery.radius,
        bounding_box: bbox,
        zoom_level: req.geospatialQuery.zoomLevel,
        clustering_mode: req.geospatialQuery.clusteringMode,
        max_results: req.geospatialQuery.maxResults,
        categories: req.geospatialQuery.categories,
      },
      filters: {
        categories: req.filters.categories,
        is_active: req.filters.isActive,
        has_available_spots: req.filters.hasAvailableSpots,
        tags: req.filters.tags,
        min_capacity: req.filters.minCapacity,
        max_capacity: req.filters.maxCapacity,
        time_filter: timeFilter,
        created_by: req.filters.createdBy,
        is_public: req.filters.isPublic,
      },
      pagination: {
        limit: req.pagination.limit,
        offset: req.pagination.offset,
        page_token: req.pagination.pageToken,
        sort_by: req.pagination.sortBy,
        sort_order: req.pagination.sortOrder,
      },
      clustering: {
        mode: req.clustering.mode,
        min_cluster_size: req.clustering.minClusterSize,
        max_cluster_size: req.clustering.maxClusterSize,
        grid_size_km: req.clustering.gridSize,
        zoom_level: req.clustering.zoomLevel,
        include_hotspot_details: req.clustering.includeHotspots,
      },
    };
  }

  // Normalize backend optimized response (snake_case) to app types (camelCase)
  private normalizeOptimizedResponse(raw: any): OptimizedSearchResponse {
    const mapCluster = (c: any): HotspotCluster => ({
      id: c.id,
      centerLocation: c.center_location || c.centerLocation,
      boundingBox: c.bounding_box
        ? {
            northEast: c.bounding_box.north_east,
            southWest: c.bounding_box.south_west,
          }
        : c.boundingBox,
      hotspotCount: c.hotspot_count ?? c.hotspotCount ?? 0,
      totalOccupancy: c.total_occupancy ?? c.totalOccupancy ?? 0,
      maxCapacity: c.max_capacity ?? c.maxCapacity ?? 0,
      categories: c.categories ?? [],
      zoomLevel: c.zoom_level ?? c.zoomLevel ?? 0,
      radius: c.radius_km ?? c.radius ?? 0,
      hotspotIds: c.hotspot_ids ?? c.hotspotIds,
    });

    const hotspots = raw.hotspots ?? raw.individual_hotspots ?? [];
    const clusters = (raw.clusters ?? []).map(mapCluster);

    return {
      clusters,
      hotspots,
      totalCount: raw.total_count ?? raw.totalCount ?? hotspots.length,
      clusterCount: raw.cluster_count ?? raw.clusterCount ?? clusters.length,
      hasMore: raw.has_more ?? raw.hasMore ?? false,
      nextPageToken: raw.next_page_token ?? raw.nextPageToken,
      queryTime: raw.query_time_ms ?? raw.queryTime ?? 0,
      cacheHit: raw.cache_hit ?? raw.cacheHit ?? false,
      zoomLevel: raw.zoom_level ?? raw.zoomLevel ?? 0,
    };
  }

  // Get cache stats from backend
  async getCacheStats(): Promise<any> {
    const response = await apiService.get<any>('/hotspots/cache/stats');
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to get cache stats');
  }

  // Get nearby hotspots (convenience method)
  async getNearbyHotspots(
    location: LocationCoordinates,
    radius: number = 5
  ): Promise<HotspotWithDistance[]> {
    const params = new URLSearchParams({
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
      radius: radius.toString(),
    });

    const response = await apiService.get<any>(`/hotspots/nearby?${params}`);
    
    if (response.success && response.data) {
      const normalized = this.normalizeLegacySearchResponse(response.data);
      const list = normalized.hotspots || [];
      list.forEach(item => {
        this.addToCache(item.hotspot);
      });
      return list;
    }
    
    throw new Error(response.message || 'Failed to get nearby hotspots');
  }

  // Get user's hotspots
  async getUserHotspots(): Promise<Hotspot[]> {
    const response = await apiService.get<Hotspot[]>('/hotspots/my');
    
    if (response.success && response.data) {
      const listRaw = (response.data as unknown as any[]) || [];
      const list = listRaw.map(this.normalizeHotspot);
      list.forEach(h => this.addToCache(h));
      return list;
    }
    
    throw new Error(response.message || 'Failed to get user hotspots');
  }

  // Join a hotspot
  async joinHotspot(id: string): Promise<Hotspot> {
    const response = await apiService.post<Hotspot>(`/hotspots/${id}/join`);
    
    if (response.success && response.data) {
      const normalized = this.normalizeHotspot(response.data);
      this.addToCache(normalized);
      return normalized;
    }
    
    throw new Error(response.message || 'Failed to join hotspot');
  }

  // Leave a hotspot
  async leaveHotspot(id: string): Promise<Hotspot> {
    const response = await apiService.post<Hotspot>(`/hotspots/${id}/leave`);
    
    if (response.success && response.data) {
      const normalized = this.normalizeHotspot(response.data);
      this.addToCache(normalized);
      return normalized;
    }
    throw new Error(response.message || 'Failed to leave hotspot');
  }
  // Convert backend snake_case hotspot to app camelCase Hotspot
  private normalizeHotspot = (raw: any): Hotspot => {
    // Location and address keys are already mostly camelCase-friendly (latitude/longitude)
    const loc = raw.location || raw.Location || {};
    const addr = raw.address || raw.Address || {};
    return {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      category: raw.category,
      location: {
        latitude: loc.latitude,
        longitude: loc.longitude,
      },
      address: {
        street: addr.street,
        city: addr.city,
        region: addr.region,
        country: addr.country,
        postalCode: addr.postal_code ?? addr.postalCode,
      },
  createdBy: raw.created_by ?? raw.createdBy,
  createdByNickname: (raw.created_by_nickname ?? raw.createdByNickname ?? '').toString(),
      maxCapacity: raw.max_capacity ?? raw.maxCapacity,
      currentOccupancy: raw.current_occupancy ?? raw.currentOccupancy ?? 0,
      isActive: raw.is_active ?? raw.isActive ?? true,
      isPublic: raw.is_public ?? raw.isPublic ?? true,
      tags: raw.tags ?? [],
      scheduledTime: raw.scheduled_time ?? raw.scheduledTime,
      endTime: raw.end_time ?? raw.endTime,
      imageUrl: raw.image_url ?? raw.imageUrl,
      attendees: raw.attendees ?? [],
      createdAt: raw.created_at ?? raw.createdAt,
      updatedAt: raw.updated_at ?? raw.updatedAt,
    };
  };

  private normalizeHotspotWithDistance = (raw: any): HotspotWithDistance => {
    return {
      hotspot: this.normalizeHotspot(raw.hotspot ?? raw.Hotspot ?? raw),
      distance: raw.distance ?? 0,
    };
  };

  private normalizeLegacySearchResponse = (raw: any): HotspotSearchResponse => {
    const list = (raw.hotspots ?? raw.individual_hotspots ?? []).map(this.normalizeHotspotWithDistance);
    return {
      hotspots: list,
      total: raw.total ?? raw.total_count ?? list.length,
      hasMore: raw.has_more ?? raw.hasMore ?? false,
    };
  };

  // Map app create/update requests to backend snake_case schema
  private toBackendCreateRequest(req: CreateHotspotRequest): any {
    return {
      name: req.name,
      description: req.description,
      category: req.category,
      location: {
        latitude: req.location.latitude,
        longitude: req.location.longitude,
      },
      address: {
        street: req.address.street,
        city: req.address.city,
        region: req.address.region,
        country: req.address.country,
        postal_code: req.address.postalCode,
      },
      max_capacity: req.maxCapacity,
      is_public: req.isPublic,
      tags: req.tags,
      scheduled_time: req.scheduledTime,
      end_time: req.endTime,
      image_url: req.imageUrl,
    };
  }

  private toBackendUpdateRequest(req: UpdateHotspotRequest): any {
    const out: any = {};
    if (req.name !== undefined) out.name = req.name;
    if (req.description !== undefined) out.description = req.description;
    if (req.category !== undefined) out.category = req.category;
    if (req.location !== undefined) {
      out.location = { latitude: req.location.latitude, longitude: req.location.longitude };
    }
    if (req.address !== undefined) {
      out.address = {
        street: req.address.street,
        city: req.address.city,
        region: req.address.region,
        country: req.address.country,
        postal_code: (req.address as any).postalCode ?? undefined,
      };
    }
    if (req.maxCapacity !== undefined) out.max_capacity = req.maxCapacity;
    if (req.isPublic !== undefined) out.is_public = req.isPublic;
    if (req.tags !== undefined) out.tags = req.tags;
    if (req.scheduledTime !== undefined) out.scheduled_time = req.scheduledTime;
    if (req.endTime !== undefined) out.end_time = req.endTime;
    if ((req as any).isActive !== undefined) out.is_active = (req as any).isActive;
    if (req.imageUrl !== undefined) out.image_url = req.imageUrl;
    return out;
  }

  // Cache management
  private addToCache(hotspot: Hotspot): void {
    this.cache.set(hotspot.id, {
      data: hotspot,
      timestamp: Date.now(),
    });
  }

  private getFromCache(id: string): Hotspot | null {
    const cached = this.cache.get(id);
    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.CACHE_EXPIRY) {
      this.cache.delete(id);
      return null;
    }

    return cached.data;
  }

  private removeFromCache(id: string): void {
    this.cache.delete(id);
  }

  // Clear all cache
  clearCache(): void {
    this.cache.clear();
  }

  // Filter hotspots by viewport bounds (for performance)
  private filterByViewport(
    hotspots: HotspotWithDistance[],
    viewport: ViewportBounds
  ): HotspotWithDistance[] {
    return hotspots.filter(item => {
      const { latitude, longitude } = item.hotspot.location;
      return (
        latitude >= viewport.southWest.latitude &&
        latitude <= viewport.northEast.latitude &&
        longitude >= viewport.southWest.longitude &&
        longitude <= viewport.northEast.longitude
      );
    });
  }

  // === Optimized Cache Management ===
  
  private optimizedCache: Map<string, { data: OptimizedSearchResponse; timestamp: number }> = new Map();
  
  private addOptimizedToCache(key: string, data: OptimizedSearchResponse): void {
    this.optimizedCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  private getOptimizedFromCache(key: string): OptimizedSearchResponse | null {
    const cached = this.optimizedCache.get(key);
    if (!cached) return null;

    // Check if cache is expired (2 minute expiry for optimized results)
    if (Date.now() - cached.timestamp > 2 * 60 * 1000) {
      this.optimizedCache.delete(key);
      return null;
    }

    return cached.data;
  }

  // === Clustering Configuration Helpers ===
  
  private getMinClusterSize(zoomLevel: number): number {
    if (zoomLevel <= 8) return 5;   // Country/state level
    if (zoomLevel <= 12) return 3;  // City level
    if (zoomLevel <= 15) return 2;  // District level
    return 1; // Street level
  }

  private getMaxClusterSize(zoomLevel: number): number {
    if (zoomLevel <= 8) return 500;   // Country/state level
    if (zoomLevel <= 12) return 100;  // City level
    if (zoomLevel <= 15) return 50;   // District level
    return 20; // Street level
  }

  private getGridSize(zoomLevel: number): number {
    if (zoomLevel <= 8) return 100;   // 100km grid
    if (zoomLevel <= 12) return 25;   // 25km grid
    if (zoomLevel <= 15) return 5;    // 5km grid
    return 1; // 1km grid
  }

  // Persistent cache methods for offline support
  async saveCacheToDisk(): Promise<void> {
    try {
      const cacheData = Array.from(this.cache.entries()).map(([id, cached]) => ({
        id,
        data: cached.data,
        timestamp: cached.timestamp,
      }));
      
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Failed to save cache to disk:', error);
    }
  }

  async loadCacheFromDisk(): Promise<void> {
    try {
      const cacheData = await AsyncStorage.getItem(this.CACHE_KEY);
      if (cacheData) {
        const parsed = JSON.parse(cacheData);
        parsed.forEach((item: any) => {
          // Only load non-expired cache entries
          if (Date.now() - item.timestamp <= this.CACHE_EXPIRY) {
            this.cache.set(item.id, {
              data: item.data,
              timestamp: item.timestamp,
            });
          }
        });
      }
    } catch (error) {
      console.error('Failed to load cache from disk:', error);
    }
  }

  // Calculate distance between two points (utility method)
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

// Export singleton instance
export const hotspotService = new HotspotService();
