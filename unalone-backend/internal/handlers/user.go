// User handlers for user profile management
package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"unalone-backend/internal/models"
	"unalone-backend/internal/services"
)

// UserHandler handles user-related endpoints
type UserHandler struct {
	userService *services.UserService
}

// NewUserHandler creates a new user handler
func NewUserHandler(userService *services.UserService) *UserHandler {
	return &UserHandler{
		userService: userService,
	}
}

// GetProfile returns the current user's profile
func (uh *UserHandler) GetProfile(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}

	// Get user from database
	user, err := uh.userService.GetUserByID(userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponseWithMessage("User not found"))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse(user, "Profile retrieved successfully"))
}

// UpdateProfile updates the current user's profile
func (uh *UserHandler) UpdateProfile(c *gin.Context) {
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

	// Prepare updates
	updates := map[string]interface{}{
		"nickname":  req.Nickname,
		"real_name": req.RealName,
	}

	// Update user
	user, err := uh.userService.UpdateUser(userID.(string), updates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponseWithMessage("Error updating profile"))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse(user, "Profile updated successfully"))
}
