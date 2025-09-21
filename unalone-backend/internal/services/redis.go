// Redis service for geospatial caching and optimization
package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"unalone-backend/internal/models"

	"github.com/go-redis/redis/v8"
)

type RedisService struct {
	client *redis.Client
	ctx    context.Context
}

// NewRedisService creates a new Redis service instance
func NewRedisService(ctx context.Context) (*RedisService, error) {
	// Redis configuration from environment variables
	redisHost := os.Getenv("REDIS_HOST")
	redisPort := os.Getenv("REDIS_PORT")
	redisPassword := os.Getenv("REDIS_PASSWORD")
	redisDB := os.Getenv("REDIS_DB")

	// Default values for development
	if redisHost == "" {
		redisHost = "localhost"
	}
	if redisPort == "" {
		redisPort = "6379"
	}
	if redisDB == "" {
		redisDB = "0"
	}

	db, err := strconv.Atoi(redisDB)
	if err != nil {
		db = 0
	}

	// Create Redis client
	rdb := redis.NewClient(&redis.Options{
		Addr:         fmt.Sprintf("%s:%s", redisHost, redisPort),
		Password:     redisPassword,
		DB:           db,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     10,
		PoolTimeout:  30 * time.Second,
	})

	// Test connection
	_, err = rdb.Ping(ctx).Result()
	if err != nil {
		log.Printf("Redis connection failed: %v. Running without cache.", err)
		return &RedisService{client: nil, ctx: ctx}, nil
	}

	log.Println("Redis connected successfully")
	return &RedisService{client: rdb, ctx: ctx}, nil
}

// IsAvailable checks if Redis is available
func (rs *RedisService) IsAvailable() bool {
	return rs.client != nil
}

// Close closes the Redis connection
func (rs *RedisService) Close() error {
	if rs.client != nil {
		return rs.client.Close()
	}
	return nil
}

// === Geospatial Caching Methods ===

// CacheHotspots caches hotspots for a specific region
func (rs *RedisService) CacheHotspots(lat, lon, radius float64, hotspots []*models.Hotspot, ttl time.Duration) error {
	if !rs.IsAvailable() {
		return nil
	}

	key := rs.getRegionKey(lat, lon, radius)
	data, err := json.Marshal(hotspots)
	if err != nil {
		return err
	}

	return rs.client.Set(rs.ctx, key, data, ttl).Err()
}

// GetCachedHotspots retrieves cached hotspots for a region
func (rs *RedisService) GetCachedHotspots(lat, lon, radius float64) ([]*models.Hotspot, error) {
	if !rs.IsAvailable() {
		return nil, nil
	}

	key := rs.getRegionKey(lat, lon, radius)
	data, err := rs.client.Get(rs.ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil // Cache miss
		}
		return nil, err
	}

	var hotspots []*models.Hotspot
	err = json.Unmarshal([]byte(data), &hotspots)
	return hotspots, err
}

// CacheClusterResults caches clustering results for different zoom levels
func (rs *RedisService) CacheClusterResults(lat, lon, radius float64, zoomLevel int, clusters []models.HotspotCluster, ttl time.Duration) error {
	if !rs.IsAvailable() {
		return nil
	}

	key := rs.getClusterKey(lat, lon, radius, zoomLevel)
	data, err := json.Marshal(clusters)
	if err != nil {
		return err
	}

	return rs.client.Set(rs.ctx, key, data, ttl).Err()
}

// GetCachedClusterResults retrieves cached clustering results
func (rs *RedisService) GetCachedClusterResults(lat, lon, radius float64, zoomLevel int) ([]models.HotspotCluster, error) {
	if !rs.IsAvailable() {
		return nil, nil
	}

	key := rs.getClusterKey(lat, lon, radius, zoomLevel)
	data, err := rs.client.Get(rs.ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil // Cache miss
		}
		return nil, err
	}

	var clusters []models.HotspotCluster
	err = json.Unmarshal([]byte(data), &clusters)
	return clusters, err
}

// === Geospatial Operations ===

// AddHotspotToGeoIndex adds a hotspot to the geospatial index
func (rs *RedisService) AddHotspotToGeoIndex(hotspot *models.Hotspot) error {
	if !rs.IsAvailable() {
		return nil
	}

	key := "hotspots:geo"
	return rs.client.GeoAdd(rs.ctx, key, &redis.GeoLocation{
		Name:      hotspot.ID,
		Longitude: hotspot.Location.Longitude,
		Latitude:  hotspot.Location.Latitude,
	}).Err()
}

// RemoveHotspotFromGeoIndex removes a hotspot from the geospatial index
func (rs *RedisService) RemoveHotspotFromGeoIndex(hotspotID string) error {
	if !rs.IsAvailable() {
		return nil
	}

	key := "hotspots:geo"
	return rs.client.ZRem(rs.ctx, key, hotspotID).Err()
}

// GetNearbyHotspotIDs gets nearby hotspot IDs from the geospatial index
func (rs *RedisService) GetNearbyHotspotIDs(lat, lon, radiusKm float64) ([]string, error) {
	if !rs.IsAvailable() {
		return nil, nil
	}

	key := "hotspots:geo"
	locations, err := rs.client.GeoRadius(rs.ctx, key, lon, lat, &redis.GeoRadiusQuery{
		Radius:      radiusKm,
		Unit:        "km",
		WithCoord:   false,
		WithDist:    false,
		WithGeoHash: false,
		Count:       1000, // Limit results
		Sort:        "ASC",
	}).Result()

	if err != nil {
		return nil, err
	}

	ids := make([]string, len(locations))
	for i, loc := range locations {
		ids[i] = loc.Name
	}

	return ids, nil
}

// === Cache Invalidation ===

// InvalidateRegionCache invalidates cache for a specific region
func (rs *RedisService) InvalidateRegionCache(lat, lon, radius float64) error {
	if !rs.IsAvailable() {
		return nil
	}

	// Invalidate all zoom levels for this region
	for zoomLevel := 1; zoomLevel <= 20; zoomLevel++ {
		clusterKey := rs.getClusterKey(lat, lon, radius, zoomLevel)
		rs.client.Del(rs.ctx, clusterKey)
	}

	// Invalidate region cache
	regionKey := rs.getRegionKey(lat, lon, radius)
	return rs.client.Del(rs.ctx, regionKey).Err()
}

// InvalidateHotspotCache invalidates all cache related to a hotspot
func (rs *RedisService) InvalidateHotspotCache(hotspot *models.Hotspot) error {
	if !rs.IsAvailable() {
		return nil
	}

	// Remove from geo index
	err := rs.RemoveHotspotFromGeoIndex(hotspot.ID)
	if err != nil {
		log.Printf("Failed to remove hotspot from geo index: %v", err)
	}

	// Invalidate surrounding regions (approximate)
	radiusesToInvalidate := []float64{1, 5, 10, 25, 50}
	for _, radius := range radiusesToInvalidate {
		rs.InvalidateRegionCache(hotspot.Location.Latitude, hotspot.Location.Longitude, radius)
	}

	return nil
}

// === Performance Monitoring ===

// GetCacheStats returns cache performance statistics
func (rs *RedisService) GetCacheStats() (map[string]interface{}, error) {
	if !rs.IsAvailable() {
		return map[string]interface{}{
			"available": false,
		}, nil
	}

	info, err := rs.client.Info(rs.ctx, "stats").Result()
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"available":    true,
		"info":         info,
		"total_keys":   rs.client.DBSize(rs.ctx).Val(),
		"memory_usage": rs.client.MemoryUsage(rs.ctx, "hotspots:geo").Val(),
	}, nil
}

// === Helper Methods ===

// getRegionKey generates a cache key for a specific region
func (rs *RedisService) getRegionKey(lat, lon, radius float64) string {
	// Round coordinates to reduce cache key variations
	latRounded := fmt.Sprintf("%.4f", lat)
	lonRounded := fmt.Sprintf("%.4f", lon)
	radiusRounded := fmt.Sprintf("%.1f", radius)

	return fmt.Sprintf("hotspots:region:%s,%s:%s", latRounded, lonRounded, radiusRounded)
}

// getClusterKey generates a cache key for clustering results
func (rs *RedisService) getClusterKey(lat, lon, radius float64, zoomLevel int) string {
	latRounded := fmt.Sprintf("%.4f", lat)
	lonRounded := fmt.Sprintf("%.4f", lon)
	radiusRounded := fmt.Sprintf("%.1f", radius)

	return fmt.Sprintf("hotspots:clusters:%s,%s:%s:z%d", latRounded, lonRounded, radiusRounded, zoomLevel)
}

// === Geohash Utilities ===

// EncodeGeohash encodes latitude and longitude into a geohash
func (rs *RedisService) EncodeGeohash(lat, lon float64, precision int) string {
	// Simple geohash implementation for basic geographical hashing
	// In production, you might want to use a more robust geohash library
	return fmt.Sprintf("gh_%d_%d_%d", int(lat*1000000), int(lon*1000000), precision)
}

// GetGeohashNeighbors returns neighboring geohash cells for better coverage
func (rs *RedisService) GetGeohashNeighbors(geohash string) []string {
	// This is a simplified implementation
	// In production, implement proper geohash neighbor calculation
	return []string{
		geohash + "_n",  // north
		geohash + "_s",  // south
		geohash + "_e",  // east
		geohash + "_w",  // west
		geohash + "_ne", // northeast
		geohash + "_nw", // northwest
		geohash + "_se", // southeast
		geohash + "_sw", // southwest
	}
}
