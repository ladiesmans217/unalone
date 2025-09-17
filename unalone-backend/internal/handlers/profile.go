// Profile handlers for user profile management
package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"unalone-backend/internal/models"
	"unalone-backend/internal/services"
)

// ProfileHandler handles profile-related endpoints
type ProfileHandler struct {
	profileService           *services.ProfileService
	phoneVerificationService *services.PhoneVerificationService
}

// NewProfileHandler creates a new profile handler
func NewProfileHandler(ps *services.ProfileService, pvs *services.PhoneVerificationService) *ProfileHandler {
	return &ProfileHandler{
		profileService:           ps,
		phoneVerificationService: pvs,
	}
}

// UpdateProfile updates the current user's profile
func (ph *ProfileHandler) UpdateProfile(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}

	var req models.UpdateProfileRequest

	// Bind JSON request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Invalid request format"))
		return
	}

	// Update profile
	user, err := ph.profileService.UpdateProfile(userID.(string), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage(err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse(user, "Profile updated successfully"))
}

// SendPhoneVerification sends phone verification code
func (ph *ProfileHandler) SendPhoneVerification(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}

	var req models.PhoneVerificationRequest

	// Bind JSON request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Invalid request format"))
		return
	}

	// Send verification code
	err := ph.phoneVerificationService.SendVerificationCode(userID.(string), req.PhoneNumber)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponseWithMessage(err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse(nil, "Verification code sent successfully"))
}

// VerifyPhone verifies phone number with code
func (ph *ProfileHandler) VerifyPhone(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}

	var req models.VerifyPhoneRequest

	// Bind JSON request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Invalid request format"))
		return
	}

	// Verify phone code
	err := ph.phoneVerificationService.VerifyPhoneCode(userID.(string), req.PhoneNumber, req.Code)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage(err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse(nil, "Phone number verified successfully"))
}

// UpdateProfileImage updates user's profile image
func (ph *ProfileHandler) UpdateProfileImage(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}

	// TODO: Implement image upload to cloud storage
	// For now, we'll accept an image URL
	type ImageUpdateRequest struct {
		ImageURL string `json:"image_url" binding:"required,url"`
	}

	var req ImageUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Invalid request format"))
		return
	}

	// Update profile image
	_, err := ph.profileService.UpdateProfileImage(userID.(string), req.ImageURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponseWithMessage(err.Error()))
		return
	}

	response := models.ProfileImageUploadResponse{
		ImageURL: req.ImageURL,
		Message:  "Profile image updated successfully",
	}

	c.JSON(http.StatusOK, models.SuccessResponse(response, "Profile image updated successfully"))
}

// GetSettings retrieves user settings
func (ph *ProfileHandler) GetSettings(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}

	// Get settings
	settings, err := ph.profileService.GetUserSettings(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponseWithMessage(err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse(settings, "Settings retrieved successfully"))
}

// UpdateSettings updates user settings
func (ph *ProfileHandler) UpdateSettings(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}

	var req models.UpdateSettingsRequest

	// Bind JSON request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Invalid request format"))
		return
	}

	// Update settings
	settings, err := ph.profileService.UpdateUserSettings(userID.(string), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage(err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse(settings, "Settings updated successfully"))
}

// BlockUser blocks a user
func (ph *ProfileHandler) BlockUser(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}

	var req models.BlockUserRequest

	// Bind JSON request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Invalid request format"))
		return
	}

	// Block user
	err := ph.profileService.BlockUser(userID.(string), req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage(err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse(nil, "User blocked successfully"))
}

// UnblockUser unblocks a user
func (ph *ProfileHandler) UnblockUser(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}

	var req models.BlockUserRequest

	// Bind JSON request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Invalid request format"))
		return
	}

	// Unblock user
	err := ph.profileService.UnblockUser(userID.(string), req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage(err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse(nil, "User unblocked successfully"))
}

// ReportUser reports a user
func (ph *ProfileHandler) ReportUser(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}

	var req models.UserReportRequest

	// Bind JSON request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Invalid request format"))
		return
	}

	// Report user
	err := ph.profileService.ReportUser(userID.(string), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage(err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse(nil, "User reported successfully"))
}
