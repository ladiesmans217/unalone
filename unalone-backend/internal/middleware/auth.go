// Authentication middleware for protecting routes
package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"unalone-backend/internal/models"
	"unalone-backend/internal/services"
)

// AuthMiddleware creates authentication middleware
func AuthMiddleware(authService *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Authorization header required"))
			c.Abort()
			return
		}

		// Check Bearer token format
		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Invalid authorization header format"))
			c.Abort()
			return
		}

		tokenString := tokenParts[1]

		// Validate token
		claims, err := authService.ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Invalid or expired token"))
			c.Abort()
			return
		}

		// Set user information in context
		c.Set("userID", claims.UserID)
		c.Set("userEmail", claims.Email)

		// Continue to next handler
		c.Next()
	}
}
