// Authentication handlers for user registration and login
package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"unalone-backend/internal/models"
	"unalone-backend/internal/services"
)

// AuthHandler handles authentication endpoints
type AuthHandler struct {
	authService *services.AuthService
	userService *services.UserService
}

// NewAuthHandler creates a new authentication handler
func NewAuthHandler(authService *services.AuthService, userService *services.UserService) *AuthHandler {
	return &AuthHandler{
		authService: authService,
		userService: userService,
	}
}

// Register handles user registration
func (ah *AuthHandler) Register(c *gin.Context) {
	var req models.AuthRequest

	// Bind JSON request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Invalid request format"))
		return
	}

	// Validate required fields for registration
	if req.RealName == "" || req.Nickname == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Real name and nickname are required"))
		return
	}

	// Hash password
	hashedPassword, err := ah.authService.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponseWithMessage("Error processing password"))
		return
	}

	// Create user
	user, err := ah.userService.CreateUser(req.Email, req.RealName, req.Nickname, hashedPassword)
	if err != nil {
		c.JSON(http.StatusConflict, models.ErrorResponseWithMessage(err.Error()))
		return
	}

	// Generate JWT token
	token, err := ah.authService.GenerateToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponseWithMessage("Error generating token"))
		return
	}

	// Return response
	response := models.AuthResponse{
		Token:   token,
		User:    *user,
		Message: "Registration successful",
	}

	c.JSON(http.StatusCreated, models.SuccessResponse(response, "User registered successfully"))
}

// Login handles user login
func (ah *AuthHandler) Login(c *gin.Context) {
	var req models.AuthRequest

	// Bind JSON request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Invalid request format"))
		return
	}

	// Get user by email
	user, err := ah.userService.GetUserByEmail(req.Email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Invalid email or password"))
		return
	}

	// Verify password
	if err := ah.authService.VerifyPassword(user.PasswordHash, req.Password); err != nil {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Invalid email or password"))
		return
	}

	// Generate JWT token
	token, err := ah.authService.GenerateToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponseWithMessage("Error generating token"))
		return
	}

	// Return response
	response := models.AuthResponse{
		Token:   token,
		User:    *user,
		Message: "Login successful",
	}

	c.JSON(http.StatusOK, models.SuccessResponse(response, "Login successful"))
}

// RefreshToken handles token refresh
func (ah *AuthHandler) RefreshToken(c *gin.Context) {
	// Get user from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}

	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}

	// Generate new token
	token, err := ah.authService.RefreshToken(userID.(string), userEmail.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponseWithMessage("Error refreshing token"))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse(gin.H{"token": token}, "Token refreshed successfully"))
}
