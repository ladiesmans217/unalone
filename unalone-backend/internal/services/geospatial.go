// Geospatial service for advanced location-based queries and clustering
package services

import (
	"fmt"
	"log"
	"math"
	"sort"
	"time"

	"unalone-backend/internal/models"
)

// GeospatialService handles advanced geospatial operations
type GeospatialService struct {
	redisService     *RedisService
	firestoreService *FirestoreService
	userService      *UserService
}

// NewGeospatialService creates a new geospatial service
func NewGeospatialService(rs *RedisService, fs *FirestoreService, us *UserService) *GeospatialService {
	return &GeospatialService{
		redisService:     rs,
		firestoreService: fs,
		userService:      us,
	}
}

// === Optimized Search Methods ===

// SearchHotspotsOptimized performs an optimized geospatial search with clustering
func (gs *GeospatialService) SearchHotspotsOptimized(req *models.OptimizedHotspotSearchRequest) (*models.HotspotSearchResultOptimized, error) {
	startTime := time.Now()
	var cacheHit bool

	// Step 1: Try cache first
	if gs.redisService.IsAvailable() {
		if req.Clustering.Mode != models.ClusteringModeNone {
			cachedClusters, err := gs.redisService.GetCachedClusterResults(
				req.GeospatialQuery.Center.Latitude,
				req.GeospatialQuery.Center.Longitude,
				req.GeospatialQuery.Radius,
				req.GeospatialQuery.ZoomLevel,
			)
			if err == nil && cachedClusters != nil {
				cacheHit = true
				return &models.HotspotSearchResultOptimized{
					Clusters:     cachedClusters,
					Hotspots:     []models.HotspotWithDistance{},
					TotalCount:   len(cachedClusters),
					ClusterCount: len(cachedClusters),
					HasMore:      false,
					QueryTime:    time.Since(startTime).Milliseconds(),
					CacheHit:     cacheHit,
					ZoomLevel:    req.GeospatialQuery.ZoomLevel,
				}, nil
			}
		} else {
			cachedHotspots, err := gs.redisService.GetCachedHotspots(
				req.GeospatialQuery.Center.Latitude,
				req.GeospatialQuery.Center.Longitude,
				req.GeospatialQuery.Radius,
			)
			if err == nil && cachedHotspots != nil {
				cacheHit = true
				hotspots := gs.convertToHotspotsWithDistance(cachedHotspots, req.GeospatialQuery.Center)
				return &models.HotspotSearchResultOptimized{
					Clusters:     []models.HotspotCluster{},
					Hotspots:     hotspots,
					TotalCount:   len(hotspots),
					ClusterCount: 0,
					HasMore:      false,
					QueryTime:    time.Since(startTime).Milliseconds(),
					CacheHit:     cacheHit,
					ZoomLevel:    req.GeospatialQuery.ZoomLevel,
				}, nil
			}
		}
	}

	// Step 2: Query database with optimizations
	hotspots, err := gs.queryHotspotsOptimized(req)
	if err != nil {
		return nil, err
	}

	// Step 3: Apply clustering if requested
	var clusters []models.HotspotCluster
	var individualHotspots []models.HotspotWithDistance

	if req.Clustering.Mode != models.ClusteringModeNone && len(hotspots) > req.Clustering.MinClusterSize {
		clusters = gs.clusterHotspots(hotspots, req.Clustering, req.GeospatialQuery.ZoomLevel)

		// Cache clusters if Redis is available
		if gs.redisService.IsAvailable() {
			gs.redisService.CacheClusterResults(
				req.GeospatialQuery.Center.Latitude,
				req.GeospatialQuery.Center.Longitude,
				req.GeospatialQuery.Radius,
				req.GeospatialQuery.ZoomLevel,
				clusters,
				5*time.Minute,
			)
		}
	} else {
		individualHotspots = hotspots

		// Cache individual hotspots if Redis is available
		if gs.redisService.IsAvailable() {
			hotspotPointers := make([]*models.Hotspot, len(hotspots))
			for i, h := range hotspots {
				hotspotPointers[i] = &h.Hotspot
			}
			gs.redisService.CacheHotspots(
				req.GeospatialQuery.Center.Latitude,
				req.GeospatialQuery.Center.Longitude,
				req.GeospatialQuery.Radius,
				hotspotPointers,
				5*time.Minute,
			)
		}
	}

	// Step 4: Build result
	result := &models.HotspotSearchResultOptimized{
		Clusters:     clusters,
		Hotspots:     individualHotspots,
		TotalCount:   len(hotspots),
		ClusterCount: len(clusters),
		HasMore:      len(hotspots) >= req.Pagination.Limit,
		QueryTime:    time.Since(startTime).Milliseconds(),
		CacheHit:     cacheHit,
		ZoomLevel:    req.GeospatialQuery.ZoomLevel,
	}

	return result, nil
}

// === Database Query Optimization ===

// queryHotspotsOptimized performs optimized database queries
func (gs *GeospatialService) queryHotspotsOptimized(req *models.OptimizedHotspotSearchRequest) ([]models.HotspotWithDistance, error) {
	// Use Redis geospatial index for initial filtering if available
	var candidateIDs []string
	var err error

	if gs.redisService.IsAvailable() {
		candidateIDs, err = gs.redisService.GetNearbyHotspotIDs(
			req.GeospatialQuery.Center.Latitude,
			req.GeospatialQuery.Center.Longitude,
			req.GeospatialQuery.Radius,
		)
		if err != nil {
			log.Printf("Redis geospatial query failed: %v", err)
		}
	}

	// Fallback to traditional search if Redis is not available or returned no results
	if len(candidateIDs) == 0 {
		return gs.traditionalGeospatialSearch(req)
	}

	// Query specific hotspots by ID (more efficient than geospatial query)
	hotspots, err := gs.getHotspotsByIDs(candidateIDs)
	if err != nil {
		return nil, err
	}

	// Apply additional filters
	filteredHotspots := gs.applyFilters(hotspots, req.Filters)

	// Calculate distances and sort
	hotspotsWithDistance := gs.convertToHotspotsWithDistance(filteredHotspots, req.GeospatialQuery.Center)

	// Apply distance filter
	finalHotspots := gs.filterByDistance(hotspotsWithDistance, req.GeospatialQuery.Radius)

	// Sort by distance
	sort.Slice(finalHotspots, func(i, j int) bool {
		return finalHotspots[i].Distance < finalHotspots[j].Distance
	})

	// Apply pagination
	start := req.Pagination.Offset
	end := start + req.Pagination.Limit
	if end > len(finalHotspots) {
		end = len(finalHotspots)
	}
	if start > len(finalHotspots) {
		start = len(finalHotspots)
	}

	return finalHotspots[start:end], nil
}

// traditionalGeospatialSearch performs traditional database geospatial search
func (gs *GeospatialService) traditionalGeospatialSearch(req *models.OptimizedHotspotSearchRequest) ([]models.HotspotWithDistance, error) {
	// This would implement the traditional Firestore geospatial query
	// For now, use the existing search logic from hotspot service
	searchReq := &models.HotspotSearchRequest{
		Latitude:          req.GeospatialQuery.Center.Latitude,
		Longitude:         req.GeospatialQuery.Center.Longitude,
		Radius:            req.GeospatialQuery.Radius,
		Limit:             req.Pagination.Limit,
		Offset:            req.Pagination.Offset,
		Category:          getFirstCategory(req.Filters.Categories),
		IsActive:          req.Filters.IsActive,
		HasAvailableSpots: req.Filters.HasAvailableSpots,
		Tags:              req.Filters.Tags,
		StartTime:         getTimeFilterStart(req.Filters.TimeFilter),
		EndTime:           getTimeFilterEnd(req.Filters.TimeFilter),
	}

	// Use mock search for now (in production, this would use Firestore)
	return gs.searchHotspotsMock(searchReq)
}

// === Clustering Algorithms ===

// clusterHotspots applies clustering algorithm based on configuration
func (gs *GeospatialService) clusterHotspots(hotspots []models.HotspotWithDistance, config models.ClusterConfig, zoomLevel int) []models.HotspotCluster {
	switch config.Mode {
	case models.ClusteringModeGrid:
		return gs.gridBasedClustering(hotspots, config, zoomLevel)
	case models.ClusteringModeDistance:
		return gs.distanceBasedClustering(hotspots, config, zoomLevel)
	case models.ClusteringModeKMeans:
		return gs.kMeansClustering(hotspots, config, zoomLevel)
	case models.ClusteringModeAuto:
		return gs.autoClustering(hotspots, config, zoomLevel)
	default:
		return []models.HotspotCluster{}
	}
}

// gridBasedClustering implements grid-based clustering
func (gs *GeospatialService) gridBasedClustering(hotspots []models.HotspotWithDistance, config models.ClusterConfig, zoomLevel int) []models.HotspotCluster {
	gridSize := gs.calculateOptimalGridSize(zoomLevel, config.GridSize)
	gridMap := make(map[string][]models.HotspotWithDistance)

	// Group hotspots by grid cells
	for _, hotspot := range hotspots {
		gridKey := gs.getGridKey(hotspot.Hotspot.Location, gridSize)
		gridMap[gridKey] = append(gridMap[gridKey], hotspot)
	}

	var clusters []models.HotspotCluster
	clusterID := 0

	for _, gridHotspots := range gridMap {
		if len(gridHotspots) >= config.MinClusterSize {
			cluster := gs.createClusterFromHotspots(gridHotspots, fmt.Sprintf("grid_%d", clusterID), zoomLevel)
			clusters = append(clusters, cluster)
			clusterID++
		}
	}

	return clusters
}

// distanceBasedClustering implements distance-based clustering
func (gs *GeospatialService) distanceBasedClustering(hotspots []models.HotspotWithDistance, config models.ClusterConfig, zoomLevel int) []models.HotspotCluster {
	maxDistance := gs.calculateOptimalClusterDistance(zoomLevel)
	var clusters []models.HotspotCluster
	used := make([]bool, len(hotspots))
	clusterID := 0

	for i, hotspot := range hotspots {
		if used[i] {
			continue
		}

		var clusterHotspots []models.HotspotWithDistance
		clusterHotspots = append(clusterHotspots, hotspot)
		used[i] = true

		// Find nearby hotspots
		for j, other := range hotspots {
			if used[j] || i == j {
				continue
			}

			distance := gs.calculateDistance(
				hotspot.Hotspot.Location.Latitude,
				hotspot.Hotspot.Location.Longitude,
				other.Hotspot.Location.Latitude,
				other.Hotspot.Location.Longitude,
			)

			if distance <= maxDistance && len(clusterHotspots) < config.MaxClusterSize {
				clusterHotspots = append(clusterHotspots, other)
				used[j] = true
			}
		}

		// Create cluster if we have enough hotspots
		if len(clusterHotspots) >= config.MinClusterSize {
			cluster := gs.createClusterFromHotspots(clusterHotspots, fmt.Sprintf("dist_%d", clusterID), zoomLevel)
			clusters = append(clusters, cluster)
			clusterID++
		}
	}

	return clusters
}

// kMeansClustering implements K-means clustering algorithm
func (gs *GeospatialService) kMeansClustering(hotspots []models.HotspotWithDistance, config models.ClusterConfig, zoomLevel int) []models.HotspotCluster {
	// Simplified K-means implementation
	k := gs.calculateOptimalK(len(hotspots), zoomLevel)
	if k <= 1 || len(hotspots) < config.MinClusterSize {
		return []models.HotspotCluster{}
	}

	// Initialize centroids
	centroids := gs.initializeCentroids(hotspots, k)
	maxIterations := 10

	for iteration := 0; iteration < maxIterations; iteration++ {
		// Assign hotspots to nearest centroid
		assignments := make([]int, len(hotspots))
		for i, hotspot := range hotspots {
			minDist := math.MaxFloat64
			for j, centroid := range centroids {
				dist := gs.calculateDistance(
					hotspot.Hotspot.Location.Latitude,
					hotspot.Hotspot.Location.Longitude,
					centroid.Latitude,
					centroid.Longitude,
				)
				if dist < minDist {
					minDist = dist
					assignments[i] = j
				}
			}
		}

		// Update centroids
		newCentroids := make([]models.HotspotLocation, k)
		counts := make([]int, k)

		for i, hotspot := range hotspots {
			cluster := assignments[i]
			newCentroids[cluster].Latitude += hotspot.Hotspot.Location.Latitude
			newCentroids[cluster].Longitude += hotspot.Hotspot.Location.Longitude
			counts[cluster]++
		}

		// Calculate new centroid positions
		converged := true
		for i := 0; i < k; i++ {
			if counts[i] > 0 {
				newLat := newCentroids[i].Latitude / float64(counts[i])
				newLon := newCentroids[i].Longitude / float64(counts[i])

				if math.Abs(newLat-centroids[i].Latitude) > 0.0001 || math.Abs(newLon-centroids[i].Longitude) > 0.0001 {
					converged = false
				}

				centroids[i].Latitude = newLat
				centroids[i].Longitude = newLon
			}
		}

		if converged {
			break
		}
	}

	// Create final clusters
	clusterGroups := make([][]models.HotspotWithDistance, k)
	for _, hotspot := range hotspots {
		cluster := 0
		minDist := math.MaxFloat64
		for j, centroid := range centroids {
			dist := gs.calculateDistance(
				hotspot.Hotspot.Location.Latitude,
				hotspot.Hotspot.Location.Longitude,
				centroid.Latitude,
				centroid.Longitude,
			)
			if dist < minDist {
				minDist = dist
				cluster = j
			}
		}
		clusterGroups[cluster] = append(clusterGroups[cluster], hotspot)
	}

	var clusters []models.HotspotCluster
	for i, group := range clusterGroups {
		if len(group) >= config.MinClusterSize {
			cluster := gs.createClusterFromHotspots(group, fmt.Sprintf("kmeans_%d", i), zoomLevel)
			clusters = append(clusters, cluster)
		}
	}

	return clusters
}

// autoClustering automatically selects the best clustering algorithm
func (gs *GeospatialService) autoClustering(hotspots []models.HotspotWithDistance, config models.ClusterConfig, zoomLevel int) []models.HotspotCluster {
	// Choose algorithm based on data characteristics
	if len(hotspots) < 20 {
		config.Mode = models.ClusteringModeDistance
		return gs.distanceBasedClustering(hotspots, config, zoomLevel)
	} else if len(hotspots) < 100 {
		config.Mode = models.ClusteringModeGrid
		return gs.gridBasedClustering(hotspots, config, zoomLevel)
	} else {
		config.Mode = models.ClusteringModeKMeans
		return gs.kMeansClustering(hotspots, config, zoomLevel)
	}
}

// === Helper Methods ===

// calculateOptimalGridSize calculates optimal grid size based on zoom level
func (gs *GeospatialService) calculateOptimalGridSize(zoomLevel int, configuredSize float64) float64 {
	if configuredSize > 0 {
		return configuredSize
	}

	// Adaptive grid size based on zoom level
	switch {
	case zoomLevel <= 5:
		return 50.0 // 50km
	case zoomLevel <= 10:
		return 10.0 // 10km
	case zoomLevel <= 15:
		return 2.0 // 2km
	default:
		return 0.5 // 500m
	}
}

// calculateOptimalClusterDistance calculates optimal clustering distance
func (gs *GeospatialService) calculateOptimalClusterDistance(zoomLevel int) float64 {
	switch {
	case zoomLevel <= 5:
		return 25.0 // 25km
	case zoomLevel <= 10:
		return 5.0 // 5km
	case zoomLevel <= 15:
		return 1.0 // 1km
	default:
		return 0.2 // 200m
	}
}

// calculateOptimalK calculates optimal number of clusters for K-means
func (gs *GeospatialService) calculateOptimalK(numHotspots, zoomLevel int) int {
	// Use elbow method approximation
	k := int(math.Sqrt(float64(numHotspots) / 2))

	// Adjust based on zoom level
	if zoomLevel > 15 {
		k = k * 2 // More clusters for high zoom
	} else if zoomLevel < 10 {
		k = k / 2 // Fewer clusters for low zoom
	}

	if k < 2 {
		k = 2
	}
	if k > numHotspots/3 {
		k = numHotspots / 3
	}

	return k
}

// getGridKey generates a grid key for a location
func (gs *GeospatialService) getGridKey(location models.HotspotLocation, gridSize float64) string {
	// Convert to grid coordinates
	gridLat := math.Floor(location.Latitude/gridSize) * gridSize
	gridLon := math.Floor(location.Longitude/gridSize) * gridSize

	return fmt.Sprintf("%.4f,%.4f", gridLat, gridLon)
}

// initializeCentroids initializes K-means centroids using K-means++ method
func (gs *GeospatialService) initializeCentroids(hotspots []models.HotspotWithDistance, k int) []models.HotspotLocation {
	centroids := make([]models.HotspotLocation, k)

	// First centroid is random
	centroids[0] = hotspots[0].Hotspot.Location

	// Select remaining centroids using K-means++
	for i := 1; i < k; i++ {
		maxDist := 0.0
		var farthest models.HotspotLocation

		for _, hotspot := range hotspots {
			minDistToCentroid := math.MaxFloat64

			// Find distance to nearest existing centroid
			for j := 0; j < i; j++ {
				dist := gs.calculateDistance(
					hotspot.Hotspot.Location.Latitude,
					hotspot.Hotspot.Location.Longitude,
					centroids[j].Latitude,
					centroids[j].Longitude,
				)
				if dist < minDistToCentroid {
					minDistToCentroid = dist
				}
			}

			// Select the point farthest from existing centroids
			if minDistToCentroid > maxDist {
				maxDist = minDistToCentroid
				farthest = hotspot.Hotspot.Location
			}
		}

		centroids[i] = farthest
	}

	return centroids
}

// createClusterFromHotspots creates a cluster from a group of hotspots
func (gs *GeospatialService) createClusterFromHotspots(hotspots []models.HotspotWithDistance, clusterID string, zoomLevel int) models.HotspotCluster {
	if len(hotspots) == 0 {
		return models.HotspotCluster{}
	}

	// Calculate center (centroid)
	var sumLat, sumLon float64
	var totalOccupancy, maxCapacity int
	var categories []string
	categorySet := make(map[string]bool)
	hotspotIDs := make([]string, len(hotspots))

	for i, hotspot := range hotspots {
		sumLat += hotspot.Hotspot.Location.Latitude
		sumLon += hotspot.Hotspot.Location.Longitude
		totalOccupancy += hotspot.Hotspot.CurrentOccupancy
		maxCapacity += hotspot.Hotspot.MaxCapacity
		hotspotIDs[i] = hotspot.Hotspot.ID

		// Collect unique categories
		categoryStr := string(hotspot.Hotspot.Category)
		if !categorySet[categoryStr] {
			categorySet[categoryStr] = true
			categories = append(categories, categoryStr)
		}
	}

	centerLat := sumLat / float64(len(hotspots))
	centerLon := sumLon / float64(len(hotspots))

	// Calculate bounding box
	minLat, maxLat := hotspots[0].Hotspot.Location.Latitude, hotspots[0].Hotspot.Location.Latitude
	minLon, maxLon := hotspots[0].Hotspot.Location.Longitude, hotspots[0].Hotspot.Location.Longitude

	for _, hotspot := range hotspots {
		lat, lon := hotspot.Hotspot.Location.Latitude, hotspot.Hotspot.Location.Longitude
		if lat < minLat {
			minLat = lat
		}
		if lat > maxLat {
			maxLat = lat
		}
		if lon < minLon {
			minLon = lon
		}
		if lon > maxLon {
			maxLon = lon
		}
	}

	// Calculate radius (max distance from center to any hotspot)
	radius := 0.0
	for _, hotspot := range hotspots {
		dist := gs.calculateDistance(centerLat, centerLon, hotspot.Hotspot.Location.Latitude, hotspot.Hotspot.Location.Longitude)
		if dist > radius {
			radius = dist
		}
	}

	return models.HotspotCluster{
		ID: clusterID,
		CenterLocation: models.HotspotLocation{
			Latitude:  centerLat,
			Longitude: centerLon,
		},
		BoundingBox: models.BoundingBox{
			NorthEast: models.HotspotLocation{
				Latitude:  maxLat,
				Longitude: maxLon,
			},
			SouthWest: models.HotspotLocation{
				Latitude:  minLat,
				Longitude: minLon,
			},
		},
		HotspotCount:   len(hotspots),
		TotalOccupancy: totalOccupancy,
		MaxCapacity:    maxCapacity,
		Categories:     categories,
		ZoomLevel:      zoomLevel,
		Radius:         radius,
		Hotspots:       hotspotIDs,
	}
}

// === Utility Methods ===

// calculateDistance calculates the distance between two points using the Haversine formula
func (gs *GeospatialService) calculateDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371 // Earth's radius in kilometers

	lat1Rad := lat1 * math.Pi / 180
	lat2Rad := lat2 * math.Pi / 180
	deltaLat := (lat2 - lat1) * math.Pi / 180
	deltaLon := (lon2 - lon1) * math.Pi / 180

	a := math.Sin(deltaLat/2)*math.Sin(deltaLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*
			math.Sin(deltaLon/2)*math.Sin(deltaLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return R * c
}

// convertToHotspotsWithDistance converts hotspots to hotspots with distance
func (gs *GeospatialService) convertToHotspotsWithDistance(hotspots []*models.Hotspot, center models.HotspotLocation) []models.HotspotWithDistance {
	result := make([]models.HotspotWithDistance, len(hotspots))
	for i, hotspot := range hotspots {
		distance := gs.calculateDistance(
			center.Latitude,
			center.Longitude,
			hotspot.Location.Latitude,
			hotspot.Location.Longitude,
		)
		result[i] = models.HotspotWithDistance{
			Hotspot:  *hotspot,
			Distance: distance,
		}
	}
	return result
}

// filterByDistance filters hotspots by distance
func (gs *GeospatialService) filterByDistance(hotspots []models.HotspotWithDistance, maxDistance float64) []models.HotspotWithDistance {
	var filtered []models.HotspotWithDistance
	for _, hotspot := range hotspots {
		if hotspot.Distance <= maxDistance {
			filtered = append(filtered, hotspot)
		}
	}
	return filtered
}

// applyFilters applies various filters to hotspots
func (gs *GeospatialService) applyFilters(hotspots []*models.Hotspot, filters models.SearchFilters) []*models.Hotspot {
	var filtered []*models.Hotspot

	for _, hotspot := range hotspots {
		// Category filter
		if len(filters.Categories) > 0 {
			categoryMatch := false
			for _, cat := range filters.Categories {
				if hotspot.Category == cat {
					categoryMatch = true
					break
				}
			}
			if !categoryMatch {
				continue
			}
		}

		// Active filter
		if filters.IsActive != nil && hotspot.IsActive != *filters.IsActive {
			continue
		}

		// Available spots filter
		if filters.HasAvailableSpots != nil && *filters.HasAvailableSpots {
			if hotspot.MaxCapacity > 0 && hotspot.CurrentOccupancy >= hotspot.MaxCapacity {
				continue
			}
		}

		// Capacity filters
		if filters.MinCapacity != nil && hotspot.MaxCapacity < *filters.MinCapacity {
			continue
		}
		if filters.MaxCapacity != nil && hotspot.MaxCapacity > *filters.MaxCapacity {
			continue
		}

		// Public filter
		if filters.IsPublic != nil && hotspot.IsPublic != *filters.IsPublic {
			continue
		}

		// Tags filter (at least one tag must match)
		if len(filters.Tags) > 0 {
			tagMatch := false
			for _, filterTag := range filters.Tags {
				for _, hotspotTag := range hotspot.Tags {
					if filterTag == hotspotTag {
						tagMatch = true
						break
					}
				}
				if tagMatch {
					break
				}
			}
			if !tagMatch {
				continue
			}
		}

		filtered = append(filtered, hotspot)
	}

	return filtered
}

// === Mock Methods (for testing without Firestore) ===

// getHotspotsByIDs retrieves hotspots by their IDs (mock implementation)
func (gs *GeospatialService) getHotspotsByIDs(ids []string) ([]*models.Hotspot, error) {
	// In a real implementation, this would query Firestore by document IDs
	// For now, we'll return empty results since we don't have access to the mock storage
	var hotspots []*models.Hotspot
	return hotspots, nil
}

// searchHotspotsMock performs mock search (simplified version)
func (gs *GeospatialService) searchHotspotsMock(req *models.HotspotSearchRequest) ([]models.HotspotWithDistance, error) {
	// In a real implementation, this would query Firestore with geospatial filters
	// For now, we'll return empty results
	var results []models.HotspotWithDistance
	return results, nil
}

// getFirstCategory returns the first category from a slice
func getFirstCategory(categories []models.HotspotCategory) *models.HotspotCategory {
	if len(categories) > 0 {
		return &categories[0]
	}
	return nil
}

// Helper functions for time filters
func getTimeFilterStart(tf *models.TimeFilter) *time.Time {
	if tf == nil {
		return nil
	}
	return tf.StartTime
}

func getTimeFilterEnd(tf *models.TimeFilter) *time.Time {
	if tf == nil {
		return nil
	}
	return tf.EndTime
}
