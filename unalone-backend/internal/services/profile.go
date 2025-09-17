// Profile service for user profile management
package services

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"unalone-backend/internal/models"
)

// ProfileService handles user profile operations
type ProfileService struct {
	firestoreService *FirestoreService
	userService      *UserService
}

// NewProfileService creates a new profile service
func NewProfileService(fs *FirestoreService, us *UserService) *ProfileService {
	return &ProfileService{
		firestoreService: fs,
		userService:      us,
	}
}

// UpdateProfile updates user profile information
func (ps *ProfileService) UpdateProfile(userID string, req *models.UpdateProfileRequest) (*models.User, error) {
	// Validate age (must be 18+)
	if !req.DateOfBirth.IsZero() {
		age := time.Now().Year() - req.DateOfBirth.Year()
		if age < 18 {
			return nil, errors.New("user must be at least 18 years old")
		}
	}

	// Validate interests count
	if len(req.Interests) > 10 {
		return nil, errors.New("maximum 10 interests allowed")
	}

	// Check if nickname is available (if changed)
	currentUser, err := ps.userService.GetUserByID(userID)
	if err != nil {
		return nil, err
	}

	if req.Nickname != currentUser.Nickname {
		existingUser, err := ps.userService.GetUserByNickname(req.Nickname)
		if err == nil && existingUser != nil && existingUser.ID != userID {
			return nil, errors.New("nickname is already taken")
		}
	}

	// Prepare update data
	updates := map[string]interface{}{
		"real_name":     req.RealName,
		"nickname":      req.Nickname,
		"bio":           req.Bio,
		"gender":        req.Gender,
		"location":      req.Location,
		"interests":     req.Interests,
		"updated_at":    time.Now(),
	}

	if !req.DateOfBirth.IsZero() {
		updates["date_of_birth"] = req.DateOfBirth
	}

	// Update user
	return ps.userService.UpdateUser(userID, updates)
}

// UpdateProfileImage updates user's profile image URL
func (ps *ProfileService) UpdateProfileImage(userID, imageURL string) (*models.User, error) {
	updates := map[string]interface{}{
		"profile_image_url": imageURL,
		"updated_at":        time.Now(),
	}

	return ps.userService.UpdateUser(userID, updates)
}

// GetUserSettings retrieves user settings
func (ps *ProfileService) GetUserSettings(userID string) (*models.UserSettings, error) {
	if ps.isTestMode() {
		return ps.getUserSettingsMock(userID)
	}

	// TODO: Implement Firestore retrieval
	return nil, errors.New("firestore implementation needed")
}

// UpdateUserSettings updates user settings
func (ps *ProfileService) UpdateUserSettings(userID string, req *models.UpdateSettingsRequest) (*models.UserSettings, error) {
	// Validate age range
	if req.AgeRangeMin > req.AgeRangeMax {
		return nil, errors.New("minimum age cannot be greater than maximum age")
	}

	settings := &models.UserSettings{
		ID:                   uuid.New().String(),
		UserID:               userID,
		NotificationsEnabled: req.NotificationsEnabled,
		EmailNotifications:   req.EmailNotifications,
		PushNotifications:    req.PushNotifications,
		LocationSharing:      req.LocationSharing,
		ProfileVisibility:    req.ProfileVisibility,
		ShowOnlineStatus:     req.ShowOnlineStatus,
		DistanceRadius:       req.DistanceRadius,
		AgeRangeMin:          req.AgeRangeMin,
		AgeRangeMax:          req.AgeRangeMax,
		UpdatedAt:            time.Now(),
	}

	if ps.isTestMode() {
		return ps.updateUserSettingsMock(settings)
	}

	// TODO: Implement Firestore storage
	return nil, errors.New("firestore implementation needed")
}

// BlockUser blocks a user
func (ps *ProfileService) BlockUser(blockerID, blockedID string) error {
	if blockerID == blockedID {
		return errors.New("cannot block yourself")
	}

	// Get blocked user
	blocked, err := ps.userService.GetUserByID(blockedID)
	if err != nil {
		return err
	}

	// Add to blocker's blocked list
	blockedBy := blocked.BlockedBy
	for _, id := range blockedBy {
		if id == blockerID {
			return errors.New("user is already blocked")
		}
	}
	blockedBy = append(blockedBy, blockerID)

	// Update blocked user's record
	_, err = ps.userService.UpdateUser(blockedID, map[string]interface{}{
		"blocked_by":   blockedBy,
		"updated_at":   time.Now(),
	})

	return err
}

// UnblockUser unblocks a user
func (ps *ProfileService) UnblockUser(blockerID, blockedID string) error {
	// Get blocked user
	blocked, err := ps.userService.GetUserByID(blockedID)
	if err != nil {
		return err
	}

	// Remove from blocker's blocked list
	blockedBy := blocked.BlockedBy
	for i, id := range blockedBy {
		if id == blockerID {
			blockedBy = append(blockedBy[:i], blockedBy[i+1:]...)
			break
		}
	}

	// Update blocked user's record
	_, err = ps.userService.UpdateUser(blockedID, map[string]interface{}{
		"blocked_by":   blockedBy,
		"updated_at":   time.Now(),
	})

	return err
}

// ReportUser creates a user report
func (ps *ProfileService) ReportUser(reporterID string, req *models.UserReportRequest) error {
	if reporterID == req.ReportedUserID {
		return errors.New("cannot report yourself")
	}

	// Check if reported user exists
	_, err := ps.userService.GetUserByID(req.ReportedUserID)
	if err != nil {
		return errors.New("reported user not found")
	}

	// Create report
	report := &models.UserReport{
		ID:          uuid.New().String(),
		ReporterID:  reporterID,
		ReportedID:  req.ReportedUserID,
		Reason:      req.Reason,
		Description: req.Description,
		Status:      "pending",
		CreatedAt:   time.Now(),
	}

	if ps.isTestMode() {
		return ps.createReportMock(report)
	}

	// TODO: Implement Firestore storage
	return errors.New("firestore implementation needed")
}

// Mock storage for testing
var mockSettings = make(map[string]*models.UserSettings)
var mockReports = make(map[string]*models.UserReport)

func (ps *ProfileService) getUserSettingsMock(userID string) (*models.UserSettings, error) {
	settings, exists := mockSettings[userID]
	if !exists {
		// Return default settings
		return &models.UserSettings{
			ID:                   uuid.New().String(),
			UserID:               userID,
			NotificationsEnabled: true,
			EmailNotifications:   true,
			PushNotifications:    true,
			LocationSharing:      true,
			ProfileVisibility:    "public",
			ShowOnlineStatus:     true,
			DistanceRadius:       25,
			AgeRangeMin:          18,
			AgeRangeMax:          65,
			CreatedAt:            time.Now(),
			UpdatedAt:            time.Now(),
		}, nil
	}
	return settings, nil
}

func (ps *ProfileService) updateUserSettingsMock(settings *models.UserSettings) (*models.UserSettings, error) {
	// Check if settings exist, update CreatedAt if new
	if existing, exists := mockSettings[settings.UserID]; !exists {
		settings.CreatedAt = time.Now()
	} else {
		settings.CreatedAt = existing.CreatedAt
		settings.ID = existing.ID
	}
	
	mockSettings[settings.UserID] = settings
	return settings, nil
}

func (ps *ProfileService) createReportMock(report *models.UserReport) error {
	mockReports[report.ID] = report
	return nil
}

func (ps *ProfileService) isTestMode() bool {
	return ps.firestoreService.client == nil
}
