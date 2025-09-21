// Hotspot handlers for REST API endpoints
package handlers

import (
	"net/http"
	"strconv"

	"unalone-backend/internal/models"
	"unalone-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// HotspotHandler handles hotspot-related endpoints
type HotspotHandler struct {
	hotspotService    *services.HotspotService
	geospatialService *services.GeospatialService
	gamification      *services.GamificationService
}

// NewHotspotHandler creates a new hotspot handler
func NewHotspotHandler(hs *services.HotspotService, gs *services.GeospatialService, gam *services.GamificationService) *HotspotHandler {
	return &HotspotHandler{
		hotspotService:    hs,
		geospatialService: gs,
		gamification:      gam,
	}
}

// CreateHotspot creates a new hotspot
func (hh *HotspotHandler) CreateHotspot(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}

	var req models.CreateHotspotRequest

	// Bind JSON request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Invalid request format: "+err.Error()))
		return
	}

	// Create hotspot
	hotspot, err := hh.hotspotService.CreateHotspot(userID.(string), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage(err.Error()))
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse(hotspot, "Hotspot created successfully"))
}

// GetHotspot retrieves a hotspot by ID
func (hh *HotspotHandler) GetHotspot(c *gin.Context) {
	hotspotID := c.Param("id")
	if hotspotID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Hotspot ID is required"))
		return
	}

	hotspot, err := hh.hotspotService.GetHotspot(hotspotID)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponseWithMessage(err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse(hotspot, "Hotspot retrieved successfully"))
}

// UpdateHotspot updates an existing hotspot
func (hh *HotspotHandler) UpdateHotspot(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}

	hotspotID := c.Param("id")
	if hotspotID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Hotspot ID is required"))
		return
	}

	var req models.UpdateHotspotRequest

	// Bind JSON request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Invalid request format: "+err.Error()))
		return
	}

	// Update hotspot
	hotspot, err := hh.hotspotService.UpdateHotspot(userID.(string), hotspotID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage(err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse(hotspot, "Hotspot updated successfully"))
}

// DeleteHotspot deletes a hotspot
func (hh *HotspotHandler) DeleteHotspot(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}

	hotspotID := c.Param("id")
	if hotspotID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Hotspot ID is required"))
		return
	}

	// Delete hotspot
	err := hh.hotspotService.DeleteHotspot(userID.(string), hotspotID)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage(err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse(nil, "Hotspot deleted successfully"))
}

// JoinHotspot adds the current user to a hotspot
func (hh *HotspotHandler) JoinHotspot(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}

	hotspotID := c.Param("id")
	if hotspotID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Hotspot ID is required"))
		return
	}

	// Join hotspot
	hotspot, err := hh.hotspotService.JoinHotspot(userID.(string), hotspotID)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage(err.Error()))
		return
	}

	// Award points for joining a hotspot (best-effort)
	if hh.gamification != nil {
		_, _, _ = hh.gamification.AwardForHotspotJoin(userID.(string))
	}

	c.JSON(http.StatusOK, models.SuccessResponse(hotspot, "Joined hotspot successfully"))
}

// LeaveHotspot removes the current user from a hotspot
func (hh *HotspotHandler) LeaveHotspot(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}

	hotspotID := c.Param("id")
	if hotspotID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Hotspot ID is required"))
		return
	}

	// Leave hotspot
	hotspot, err := hh.hotspotService.LeaveHotspot(userID.(string), hotspotID)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage(err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse(hotspot, "Left hotspot successfully"))
}

// SearchHotspots searches for hotspots based on location and filters
func (hh *HotspotHandler) SearchHotspots(c *gin.Context) {
	var req models.HotspotSearchRequest

	// Parse query parameters
	if latStr := c.Query("latitude"); latStr != "" {
		if lat, err := strconv.ParseFloat(latStr, 64); err == nil {
			req.Latitude = lat
		} else {
			c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Invalid latitude"))
			return
		}
	} else {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Latitude is required"))
		return
	}

	if lonStr := c.Query("longitude"); lonStr != "" {
		if lon, err := strconv.ParseFloat(lonStr, 64); err == nil {
			req.Longitude = lon
		} else {
			c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Invalid longitude"))
			return
		}
	} else {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Longitude is required"))
		return
	}

	// Default radius to 10km if not provided
	req.Radius = 10.0
	if radiusStr := c.Query("radius"); radiusStr != "" {
		if radius, err := strconv.ParseFloat(radiusStr, 64); err == nil {
			req.Radius = radius
		}
	}

	// Optional filters
	if category := c.Query("category"); category != "" {
		cat := models.HotspotCategory(category)
		req.Category = &cat
	}

	if isActiveStr := c.Query("is_active"); isActiveStr != "" {
		if isActive, err := strconv.ParseBool(isActiveStr); err == nil {
			req.IsActive = &isActive
		}
	}

	if hasAvailableStr := c.Query("has_available_spots"); hasAvailableStr != "" {
		if hasAvailable, err := strconv.ParseBool(hasAvailableStr); err == nil {
			req.HasAvailableSpots = &hasAvailable
		}
	}

	// Pagination
	req.Limit = 20 // Default limit
	if limitStr := c.Query("limit"); limitStr != "" {
		if limit, err := strconv.Atoi(limitStr); err == nil && limit > 0 && limit <= 100 {
			req.Limit = limit
		}
	}

	req.Offset = 0 // Default offset
	if offsetStr := c.Query("offset"); offsetStr != "" {
		if offset, err := strconv.Atoi(offsetStr); err == nil && offset >= 0 {
			req.Offset = offset
		}
	}

	// Search hotspots
	response, err := hh.hotspotService.SearchHotspots(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponseWithMessage(err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse(response, "Hotspots retrieved successfully"))
}

// GetUserHotspots retrieves hotspots created by the current user
func (hh *HotspotHandler) GetUserHotspots(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}

	hotspots, err := hh.hotspotService.GetUserHotspots(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponseWithMessage(err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse(hotspots, "User hotspots retrieved successfully"))
}

// GetNearbyHotspots is a convenience endpoint that gets nearby hotspots for the current user
func (hh *HotspotHandler) GetNearbyHotspots(c *gin.Context) {
	// This endpoint could use the user's last known location or require location parameters
	// For now, we'll require location parameters similar to SearchHotspots
	var req models.HotspotSearchRequest

	// Parse required location parameters
	if latStr := c.Query("latitude"); latStr != "" {
		if lat, err := strconv.ParseFloat(latStr, 64); err == nil {
			req.Latitude = lat
		} else {
			c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Invalid latitude"))
			return
		}
	} else {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Latitude is required"))
		return
	}

	if lonStr := c.Query("longitude"); lonStr != "" {
		if lon, err := strconv.ParseFloat(lonStr, 64); err == nil {
			req.Longitude = lon
		} else {
			c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Invalid longitude"))
			return
		}
	} else {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Longitude is required"))
		return
	}

	// Default settings for nearby hotspots
	req.Radius = 5.0 // 5km radius
	isActive := true
	req.IsActive = &isActive
	req.Limit = 10

	// Search for nearby active hotspots
	response, err := hh.hotspotService.SearchHotspots(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponseWithMessage(err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse(response, "Nearby hotspots retrieved successfully"))
}

// SearchHotspotsOptimized performs optimized geospatial search with clustering
func (hh *HotspotHandler) SearchHotspotsOptimized(c *gin.Context) {
	var req models.OptimizedHotspotSearchRequest

	// Bind JSON request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Invalid request format: "+err.Error()))
		return
	}

	// Validate required fields
	if req.GeospatialQuery.Center.Latitude == 0 && req.GeospatialQuery.Center.Longitude == 0 {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Center coordinates are required"))
		return
	}

	if req.GeospatialQuery.Radius <= 0 {
		req.GeospatialQuery.Radius = 10.0 // Default 10km radius
	}

	// Set default values
	if req.Pagination.Limit <= 0 {
		req.Pagination.Limit = 50
	}
	if req.Pagination.Limit > 1000 {
		req.Pagination.Limit = 1000 // Max limit for performance
	}

	if req.GeospatialQuery.ZoomLevel <= 0 {
		req.GeospatialQuery.ZoomLevel = 10 // Default zoom level
	}

	// Set default clustering configuration
	if req.Clustering.Mode == "" {
		req.Clustering.Mode = models.ClusteringModeAuto
	}
	if req.Clustering.MinClusterSize <= 0 {
		req.Clustering.MinClusterSize = 2
	}
	if req.Clustering.MaxClusterSize <= 0 {
		req.Clustering.MaxClusterSize = 100
	}

	// Perform optimized search
	response, err := hh.geospatialService.SearchHotspotsOptimized(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponseWithMessage(err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse(response, "Optimized search completed successfully"))
}

// GetCacheStats returns cache performance statistics
func (hh *HotspotHandler) GetCacheStats(c *gin.Context) {
	// This endpoint is useful for monitoring and debugging
	stats := map[string]interface{}{
		"service": "hotspot-geospatial",
		"status":  "healthy",
	}

	// Add Redis stats if available
	if hh.geospatialService != nil {
		// For now, we'll add a placeholder
		// In a real implementation, you'd get actual cache stats from Redis
		stats["cache"] = map[string]interface{}{
			"available": true,
			"type":      "redis",
		}
	}

	c.JSON(http.StatusOK, models.SuccessResponse(stats, "Cache statistics retrieved"))
}
