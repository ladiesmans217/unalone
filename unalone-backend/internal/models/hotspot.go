// Hotspot models for location-based meetup functionality
package models

import "time"

// HotspotLocation represents geographic coordinates for hotspots
type HotspotLocation struct {
	Latitude  float64 `firestore:"latitude" json:"latitude" binding:"required"`
	Longitude float64 `firestore:"longitude" json:"longitude" binding:"required"`
}

// HotspotAddress represents a physical address for hotspots
type HotspotAddress struct {
	Street     string `firestore:"street" json:"street"`
	City       string `firestore:"city" json:"city" binding:"required"`
	Region     string `firestore:"region" json:"region"`
	Country    string `firestore:"country" json:"country" binding:"required"`
	PostalCode string `firestore:"postal_code" json:"postal_code"`
}

// HotspotCategory represents the type of hotspot
type HotspotCategory string

const (
	CategoryCafe          HotspotCategory = "cafe"
	CategoryRestaurant    HotspotCategory = "restaurant"
	CategoryPark          HotspotCategory = "park"
	CategoryGym           HotspotCategory = "gym"
	CategoryLibrary       HotspotCategory = "library"
	CategoryBeach         HotspotCategory = "beach"
	CategoryBar           HotspotCategory = "bar"
	CategoryEvent         HotspotCategory = "event"
	CategoryStudy         HotspotCategory = "study"
	CategorySports        HotspotCategory = "sports"
	CategoryShopping      HotspotCategory = "shopping"
	CategoryEntertainment HotspotCategory = "entertainment"
	CategoryOther         HotspotCategory = "other"
)

// Hotspot represents a location where users can meet
type Hotspot struct {
	ID                string          `firestore:"id" json:"id"`
	Name              string          `firestore:"name" json:"name"`
	Description       string          `firestore:"description" json:"description"`
	Category          HotspotCategory `firestore:"category" json:"category"`
	Location          HotspotLocation `firestore:"location" json:"location"`
	Address           HotspotAddress  `firestore:"address" json:"address"`
	CreatedBy         string          `firestore:"created_by" json:"created_by"`
	CreatedByNickname string          `firestore:"created_by_nickname" json:"created_by_nickname"`
	MaxCapacity       int             `firestore:"max_capacity" json:"max_capacity"`
	CurrentOccupancy  int             `firestore:"current_occupancy" json:"current_occupancy"`
	IsActive          bool            `firestore:"is_active" json:"is_active"`
	IsPublic          bool            `firestore:"is_public" json:"is_public"`
	Tags              []string        `firestore:"tags" json:"tags"`
	ScheduledTime     *time.Time      `firestore:"scheduled_time" json:"scheduled_time,omitempty"`
	EndTime           *time.Time      `firestore:"end_time" json:"end_time,omitempty"`
	ImageURL          string          `firestore:"image_url" json:"image_url"`
	Attendees         []string        `firestore:"attendees" json:"attendees"`
	CreatedAt         time.Time       `firestore:"created_at" json:"created_at"`
	UpdatedAt         time.Time       `firestore:"updated_at" json:"updated_at"`
}

// CreateHotspotRequest represents the request to create a new hotspot
type CreateHotspotRequest struct {
	Name          string          `json:"name" binding:"required,min=3,max=100"`
	Description   string          `json:"description" binding:"required,min=10,max=500"`
	Category      HotspotCategory `json:"category" binding:"required,oneof=cafe restaurant park gym library beach bar event study sports shopping entertainment other"`
	Location      HotspotLocation `json:"location" binding:"required"`
	Address       HotspotAddress  `json:"address" binding:"required"`
	MaxCapacity   int             `json:"max_capacity" binding:"min=1,max=1000"`
	IsPublic      bool            `json:"is_public"`
	Tags          []string        `json:"tags" binding:"max=10"`
	ScheduledTime *time.Time      `json:"scheduled_time"`
	EndTime       *time.Time      `json:"end_time"`
	ImageURL      string          `json:"image_url" binding:"omitempty,url"`
}

// UpdateHotspotRequest represents the request to update a hotspot
type UpdateHotspotRequest struct {
	Name          *string          `json:"name" binding:"omitempty,min=3,max=100"`
	Description   *string          `json:"description" binding:"omitempty,min=10,max=500"`
	Category      *HotspotCategory `json:"category" binding:"omitempty,oneof=cafe restaurant park gym library beach bar event study sports shopping entertainment other"`
	Location      *HotspotLocation `json:"location"`
	Address       *HotspotAddress  `json:"address"`
	MaxCapacity   *int             `json:"max_capacity" binding:"omitempty,min=1,max=1000"`
	IsPublic      *bool            `json:"is_public"`
	Tags          []string         `json:"tags" binding:"omitempty,max=10"`
	ScheduledTime *time.Time       `json:"scheduled_time"`
	EndTime       *time.Time       `json:"end_time"`
	ImageURL      *string          `json:"image_url" binding:"omitempty,url"`
	IsActive      *bool            `json:"is_active"`
}

// JoinHotspotRequest represents the request to join a hotspot
type JoinHotspotRequest struct {
	HotspotID string `json:"hotspot_id" binding:"required"`
}

// HotspotSearchRequest represents search parameters for hotspots
type HotspotSearchRequest struct {
	Latitude          float64          `json:"latitude" binding:"required"`
	Longitude         float64          `json:"longitude" binding:"required"`
	Radius            float64          `json:"radius" binding:"min=0.1,max=100"` // kilometers
	Category          *HotspotCategory `json:"category"`
	IsActive          *bool            `json:"is_active"`
	HasAvailableSpots *bool            `json:"has_available_spots"`
	Tags              []string         `json:"tags"`
	StartTime         *time.Time       `json:"start_time"`
	EndTime           *time.Time       `json:"end_time"`
	Limit             int              `json:"limit" binding:"omitempty,min=1,max=100"`
	Offset            int              `json:"offset" binding:"min=0"`
}

// HotspotSearchResponse represents the response for hotspot search
type HotspotSearchResponse struct {
	Hotspots []HotspotWithDistance `json:"hotspots"`
	Total    int                   `json:"total"`
	HasMore  bool                  `json:"has_more"`
}

// HotspotWithDistance includes distance information
type HotspotWithDistance struct {
	Hotspot  Hotspot `json:"hotspot"`
	Distance float64 `json:"distance"` // in kilometers
}

// HotspotActivity represents user activity at a hotspot
type HotspotActivity struct {
	ID        string                 `firestore:"id" json:"id"`
	HotspotID string                 `firestore:"hotspot_id" json:"hotspot_id"`
	UserID    string                 `firestore:"user_id" json:"user_id"`
	Action    string                 `firestore:"action" json:"action"` // joined, left, created, updated
	Timestamp time.Time              `firestore:"timestamp" json:"timestamp"`
	Metadata  map[string]interface{} `firestore:"metadata" json:"metadata,omitempty"`
}

// HotspotStats represents statistics for a hotspot
type HotspotStats struct {
	HotspotID      string         `json:"hotspot_id"`
	TotalVisits    int            `json:"total_visits"`
	UniqueVisitors int            `json:"unique_visitors"`
	AverageRating  float64        `json:"average_rating"`
	TotalRatings   int            `json:"total_ratings"`
	PopularTimes   map[string]int `json:"popular_times"` // hour -> count
}

// === Geospatial Optimization Models ===

// HotspotCluster represents a group of nearby hotspots
type HotspotCluster struct {
	ID             string          `json:"id"`
	CenterLocation HotspotLocation `json:"center_location"`
	BoundingBox    BoundingBox     `json:"bounding_box"`
	HotspotCount   int             `json:"hotspot_count"`
	TotalOccupancy int             `json:"total_occupancy"`
	MaxCapacity    int             `json:"max_capacity"`
	Categories     []string        `json:"categories"`
	ZoomLevel      int             `json:"zoom_level"`
	Radius         float64         `json:"radius_km"`
	Hotspots       []string        `json:"hotspot_ids,omitempty"` // Only included when expanded
}

// BoundingBox represents a rectangular area on the map
type BoundingBox struct {
	NorthEast HotspotLocation `json:"north_east"`
	SouthWest HotspotLocation `json:"south_west"`
}

// GeospatialQuery represents optimized geospatial search parameters
type GeospatialQuery struct {
	Center           HotspotLocation   `json:"center"`
	Radius           float64           `json:"radius_km"`
	BoundingBox      *BoundingBox      `json:"bounding_box,omitempty"`
	ZoomLevel        int               `json:"zoom_level"`
	ClusteringMode   ClusteringMode    `json:"clustering_mode"`
	MaxResults       int               `json:"max_results"`
	Categories       []HotspotCategory `json:"categories,omitempty"`
	TimeFilter       *TimeFilter       `json:"time_filter,omitempty"`
	Geohash          string            `json:"geohash,omitempty"`
	GeohashPrecision int               `json:"geohash_precision"`
}

// ClusteringMode defines how hotspots should be clustered
type ClusteringMode string

const (
	ClusteringModeNone     ClusteringMode = "none"
	ClusteringModeGrid     ClusteringMode = "grid"
	ClusteringModeDistance ClusteringMode = "distance"
	ClusteringModeKMeans   ClusteringMode = "kmeans"
	ClusteringModeAuto     ClusteringMode = "auto"
)

// TimeFilter represents time-based filtering for hotspots
type TimeFilter struct {
	StartTime  *time.Time `json:"start_time,omitempty"`
	EndTime    *time.Time `json:"end_time,omitempty"`
	DaysOfWeek []string   `json:"days_of_week,omitempty"` // monday, tuesday, etc.
	TimeOfDay  string     `json:"time_of_day,omitempty"`  // morning, afternoon, evening, night
}

// HotspotSearchResultOptimized represents optimized search results with clustering
type HotspotSearchResultOptimized struct {
	Clusters      []HotspotCluster      `json:"clusters"`
	Hotspots      []HotspotWithDistance `json:"individual_hotspots"`
	TotalCount    int                   `json:"total_count"`
	ClusterCount  int                   `json:"cluster_count"`
	HasMore       bool                  `json:"has_more"`
	NextPageToken string                `json:"next_page_token,omitempty"`
	QueryTime     int64                 `json:"query_time_ms"`
	CacheHit      bool                  `json:"cache_hit"`
	ZoomLevel     int                   `json:"zoom_level"`
}

// GeospatialIndex represents an index entry for efficient lookups
type GeospatialIndex struct {
	HotspotID   string          `json:"hotspot_id"`
	Location    HotspotLocation `json:"location"`
	Geohash     string          `json:"geohash"`
	Category    HotspotCategory `json:"category"`
	IsActive    bool            `json:"is_active"`
	Occupancy   int             `json:"occupancy"`
	MaxCapacity int             `json:"max_capacity"`
	LastUpdated time.Time       `json:"last_updated"`
}

// PerformanceMetrics tracks geospatial query performance
type PerformanceMetrics struct {
	QueryType       string    `json:"query_type"`
	QueryTime       int64     `json:"query_time_ms"`
	ResultCount     int       `json:"result_count"`
	CacheHit        bool      `json:"cache_hit"`
	DatabaseQueries int       `json:"database_queries"`
	Timestamp       time.Time `json:"timestamp"`
	ZoomLevel       int       `json:"zoom_level"`
	Radius          float64   `json:"radius_km"`
}

// === Enhanced Request/Response Models ===

// OptimizedHotspotSearchRequest represents an optimized search request
type OptimizedHotspotSearchRequest struct {
	GeospatialQuery GeospatialQuery `json:"geospatial_query"`
	Filters         SearchFilters   `json:"filters"`
	Pagination      Pagination      `json:"pagination"`
	Clustering      ClusterConfig   `json:"clustering"`
}

// SearchFilters represents various filtering options
type SearchFilters struct {
	Categories        []HotspotCategory `json:"categories,omitempty"`
	IsActive          *bool             `json:"is_active,omitempty"`
	HasAvailableSpots *bool             `json:"has_available_spots,omitempty"`
	Tags              []string          `json:"tags,omitempty"`
	MinCapacity       *int              `json:"min_capacity,omitempty"`
	MaxCapacity       *int              `json:"max_capacity,omitempty"`
	TimeFilter        *TimeFilter       `json:"time_filter,omitempty"`
	CreatedBy         string            `json:"created_by,omitempty"`
	IsPublic          *bool             `json:"is_public,omitempty"`
}

// Pagination represents pagination parameters
type Pagination struct {
	Limit     int    `json:"limit"`
	Offset    int    `json:"offset"`
	PageToken string `json:"page_token,omitempty"`
	SortBy    string `json:"sort_by,omitempty"`    // distance, created_at, occupancy
	SortOrder string `json:"sort_order,omitempty"` // asc, desc
}

// ClusterConfig represents clustering configuration
type ClusterConfig struct {
	Mode            ClusteringMode `json:"mode"`
	MinClusterSize  int            `json:"min_cluster_size"`
	MaxClusterSize  int            `json:"max_cluster_size"`
	GridSize        float64        `json:"grid_size_km,omitempty"`
	ZoomLevel       int            `json:"zoom_level"`
	IncludeHotspots bool           `json:"include_hotspot_details"`
}
