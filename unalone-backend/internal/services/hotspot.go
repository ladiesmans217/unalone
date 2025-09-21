// Hotspot service for managing location-based meetup spots
package services

import (
	"errors"
	"math"
	"sort"
	"time"

	"unalone-backend/internal/models"

	"github.com/google/uuid"
)

// HotspotService handles hotspot-related operations
type HotspotService struct {
	firestoreService *FirestoreService
	userService      *UserService
}

// NewHotspotService creates a new hotspot service
func NewHotspotService(fs *FirestoreService, us *UserService) *HotspotService {
	return &HotspotService{
		firestoreService: fs,
		userService:      us,
	}
}

// CreateHotspot creates a new hotspot
func (hs *HotspotService) CreateHotspot(userID string, req *models.CreateHotspotRequest) (*models.Hotspot, error) {
	// Get user information
	user, err := hs.userService.GetUserByID(userID)
	if err != nil {
		return nil, err
	}

	// Validate scheduled time
	if req.ScheduledTime != nil && req.EndTime != nil {
		if req.EndTime.Before(*req.ScheduledTime) {
			return nil, errors.New("end time cannot be before scheduled time")
		}
	}

	// Generate hotspot ID
	hotspotID := uuid.New().String()

	// Create hotspot
	hotspot := &models.Hotspot{
		ID:                hotspotID,
		Name:              req.Name,
		Description:       req.Description,
		Category:          req.Category,
		Location:          req.Location,
		Address:           req.Address,
		CreatedBy:         userID,
		CreatedByNickname: user.Nickname,
		MaxCapacity:       req.MaxCapacity,
		CurrentOccupancy:  1, // Creator is automatically added
		IsActive:          true,
		IsPublic:          req.IsPublic,
		Tags:              req.Tags,
		ScheduledTime:     req.ScheduledTime,
		EndTime:           req.EndTime,
		ImageURL:          req.ImageURL,
		Attendees:         []string{userID}, // Creator is first attendee
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if hs.isTestMode() {
		return hs.createHotspotMock(hotspot)
	}

	// TODO: Implement Firestore storage
	return nil, errors.New("firestore implementation needed")
}

// GetHotspot retrieves a hotspot by ID
func (hs *HotspotService) GetHotspot(hotspotID string) (*models.Hotspot, error) {
	if hs.isTestMode() {
		return hs.getHotspotMock(hotspotID)
	}

	// TODO: Implement Firestore retrieval
	return nil, errors.New("firestore implementation needed")
}

// UpdateHotspot updates an existing hotspot
func (hs *HotspotService) UpdateHotspot(userID, hotspotID string, req *models.UpdateHotspotRequest) (*models.Hotspot, error) {
	// Get existing hotspot
	hotspot, err := hs.GetHotspot(hotspotID)
	if err != nil {
		return nil, err
	}

	// Check if user is the creator
	if hotspot.CreatedBy != userID {
		return nil, errors.New("only the creator can update this hotspot")
	}

	// Update fields if provided
	if req.Name != nil {
		hotspot.Name = *req.Name
	}
	if req.Description != nil {
		hotspot.Description = *req.Description
	}
	if req.Category != nil {
		hotspot.Category = *req.Category
	}
	if req.Location != nil {
		hotspot.Location = *req.Location
	}
	if req.Address != nil {
		hotspot.Address = *req.Address
	}
	if req.MaxCapacity != nil {
		if *req.MaxCapacity < hotspot.CurrentOccupancy {
			return nil, errors.New("max capacity cannot be less than current occupancy")
		}
		hotspot.MaxCapacity = *req.MaxCapacity
	}
	if req.IsPublic != nil {
		hotspot.IsPublic = *req.IsPublic
	}
	if req.Tags != nil {
		hotspot.Tags = req.Tags
	}
	if req.ScheduledTime != nil {
		hotspot.ScheduledTime = req.ScheduledTime
	}
	if req.EndTime != nil {
		hotspot.EndTime = req.EndTime
	}
	if req.ImageURL != nil {
		hotspot.ImageURL = *req.ImageURL
	}
	if req.IsActive != nil {
		hotspot.IsActive = *req.IsActive
	}

	// Validate scheduled time
	if hotspot.ScheduledTime != nil && hotspot.EndTime != nil {
		if hotspot.EndTime.Before(*hotspot.ScheduledTime) {
			return nil, errors.New("end time cannot be before scheduled time")
		}
	}

	hotspot.UpdatedAt = time.Now()

	if hs.isTestMode() {
		return hs.updateHotspotMock(hotspot)
	}

	// TODO: Implement Firestore update
	return nil, errors.New("firestore implementation needed")
}

// DeleteHotspot deletes a hotspot
func (hs *HotspotService) DeleteHotspot(userID, hotspotID string) error {
	// Get existing hotspot
	hotspot, err := hs.GetHotspot(hotspotID)
	if err != nil {
		return err
	}

	// Check if user is the creator
	if hotspot.CreatedBy != userID {
		return errors.New("only the creator can delete this hotspot")
	}

	if hs.isTestMode() {
		return hs.deleteHotspotMock(hotspotID)
	}

	// TODO: Implement Firestore deletion
	return errors.New("firestore implementation needed")
}

// JoinHotspot adds a user to a hotspot
func (hs *HotspotService) JoinHotspot(userID, hotspotID string) (*models.Hotspot, error) {
	// Get hotspot
	hotspot, err := hs.GetHotspot(hotspotID)
	if err != nil {
		return nil, err
	}

	// Check if hotspot is active
	if !hotspot.IsActive {
		return nil, errors.New("hotspot is not active")
	}

	// Check if user is already in the hotspot
	for _, attendeeID := range hotspot.Attendees {
		if attendeeID == userID {
			return nil, errors.New("user is already in this hotspot")
		}
	}

	// Check capacity
	if hotspot.MaxCapacity > 0 && hotspot.CurrentOccupancy >= hotspot.MaxCapacity {
		return nil, errors.New("hotspot is at maximum capacity")
	}

	// Add user to attendees
	hotspot.Attendees = append(hotspot.Attendees, userID)
	hotspot.CurrentOccupancy = len(hotspot.Attendees)
	hotspot.UpdatedAt = time.Now()

	if hs.isTestMode() {
		return hs.updateHotspotMock(hotspot)
	}

	// TODO: Implement Firestore update
	return nil, errors.New("firestore implementation needed")
}

// LeaveHotspot removes a user from a hotspot
func (hs *HotspotService) LeaveHotspot(userID, hotspotID string) (*models.Hotspot, error) {
	// Get hotspot
	hotspot, err := hs.GetHotspot(hotspotID)
	if err != nil {
		return nil, err
	}

	// Check if user is in the hotspot
	userIndex := -1
	for i, attendeeID := range hotspot.Attendees {
		if attendeeID == userID {
			userIndex = i
			break
		}
	}

	if userIndex == -1 {
		return nil, errors.New("user is not in this hotspot")
	}

	// Remove user from attendees
	hotspot.Attendees = append(hotspot.Attendees[:userIndex], hotspot.Attendees[userIndex+1:]...)
	hotspot.CurrentOccupancy = len(hotspot.Attendees)
	hotspot.UpdatedAt = time.Now()

	// If creator leaves and there are other attendees, transfer ownership to the first attendee
	if hotspot.CreatedBy == userID && len(hotspot.Attendees) > 0 {
		newOwner, err := hs.userService.GetUserByID(hotspot.Attendees[0])
		if err == nil {
			hotspot.CreatedBy = newOwner.ID
			hotspot.CreatedByNickname = newOwner.Nickname
		}
	}

	// If no one is left, deactivate the hotspot
	if len(hotspot.Attendees) == 0 {
		hotspot.IsActive = false
	}

	if hs.isTestMode() {
		return hs.updateHotspotMock(hotspot)
	}

	// TODO: Implement Firestore update
	return nil, errors.New("firestore implementation needed")
}

// SearchHotspots searches for hotspots based on location and filters
func (hs *HotspotService) SearchHotspots(req *models.HotspotSearchRequest) (*models.HotspotSearchResponse, error) {
	if hs.isTestMode() {
		return hs.searchHotspotsMock(req)
	}

	// TODO: Implement Firestore geospatial search
	return nil, errors.New("firestore implementation needed")
}

// GetUserHotspots gets hotspots created by a user
func (hs *HotspotService) GetUserHotspots(userID string) ([]*models.Hotspot, error) {
	if hs.isTestMode() {
		return hs.getUserHotspotsMock(userID)
	}

	// TODO: Implement Firestore query
	return nil, errors.New("firestore implementation needed")
}

// calculateDistance calculates the distance between two points in kilometers
func (hs *HotspotService) calculateDistance(lat1, lon1, lat2, lon2 float64) float64 {
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

// isTestMode checks if we're running in test mode
func (hs *HotspotService) isTestMode() bool {
	return hs.firestoreService.client == nil
}

// Mock storage for testing
var mockHotspots = make(map[string]*models.Hotspot)

func (hs *HotspotService) createHotspotMock(hotspot *models.Hotspot) (*models.Hotspot, error) {
	mockHotspots[hotspot.ID] = hotspot
	return hotspot, nil
}

func (hs *HotspotService) getHotspotMock(hotspotID string) (*models.Hotspot, error) {
	hotspot, exists := mockHotspots[hotspotID]
	if !exists {
		return nil, errors.New("hotspot not found")
	}
	return hotspot, nil
}

func (hs *HotspotService) updateHotspotMock(hotspot *models.Hotspot) (*models.Hotspot, error) {
	mockHotspots[hotspot.ID] = hotspot
	return hotspot, nil
}

func (hs *HotspotService) deleteHotspotMock(hotspotID string) error {
	delete(mockHotspots, hotspotID)
	return nil
}

func (hs *HotspotService) getUserHotspotsMock(userID string) ([]*models.Hotspot, error) {
	var userHotspots []*models.Hotspot
	for _, hotspot := range mockHotspots {
		if hotspot.CreatedBy == userID {
			userHotspots = append(userHotspots, hotspot)
		}
	}
	return userHotspots, nil
}

func (hs *HotspotService) searchHotspotsMock(req *models.HotspotSearchRequest) (*models.HotspotSearchResponse, error) {
	var results []models.HotspotWithDistance

	for _, hotspot := range mockHotspots {
		// Calculate distance
		distance := hs.calculateDistance(
			req.Latitude, req.Longitude,
			hotspot.Location.Latitude, hotspot.Location.Longitude,
		)

		// Check if within radius
		if distance > req.Radius {
			continue
		}

		// Apply filters
		if req.Category != nil && hotspot.Category != *req.Category {
			continue
		}

		if req.IsActive != nil && hotspot.IsActive != *req.IsActive {
			continue
		}

		if req.HasAvailableSpots != nil && *req.HasAvailableSpots {
			if hotspot.MaxCapacity > 0 && hotspot.CurrentOccupancy >= hotspot.MaxCapacity {
				continue
			}
		}

		// Check tags
		if len(req.Tags) > 0 {
			hasTag := false
			for _, reqTag := range req.Tags {
				for _, hotspotTag := range hotspot.Tags {
					if reqTag == hotspotTag {
						hasTag = true
						break
					}
				}
				if hasTag {
					break
				}
			}
			if !hasTag {
				continue
			}
		}

		// Check time filters
		if req.StartTime != nil && hotspot.ScheduledTime != nil {
			if hotspot.ScheduledTime.Before(*req.StartTime) {
				continue
			}
		}

		if req.EndTime != nil && hotspot.EndTime != nil {
			if hotspot.EndTime.After(*req.EndTime) {
				continue
			}
		}

		results = append(results, models.HotspotWithDistance{
			Hotspot:  *hotspot,
			Distance: distance,
		})
	}

	// Sort by distance
	sort.Slice(results, func(i, j int) bool {
		return results[i].Distance < results[j].Distance
	})

	// Apply pagination
	total := len(results)
	start := req.Offset
	end := start + req.Limit

	if start > total {
		start = total
	}
	if end > total {
		end = total
	}

	paginatedResults := results[start:end]
	hasMore := end < total

	return &models.HotspotSearchResponse{
		Hotspots: paginatedResults,
		Total:    total,
		HasMore:  hasMore,
	}, nil
}
