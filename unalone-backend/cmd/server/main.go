// Main entry point for the Unalone backend server
package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"unalone-backend/internal/handlers"
	"unalone-backend/internal/middleware"
	"unalone-backend/internal/services"
)

func main() {
	// Initialize services
	ctx := context.Background()
	
	// Initialize Firestore service
	firestoreService, err := services.NewFirestoreService(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize Firestore service: %v", err)
	}
	defer firestoreService.Close()

	// Initialize other services
	authService := services.NewAuthService(firestoreService)
	userService := services.NewUserService(firestoreService)
	profileService := services.NewProfileService(firestoreService, userService)
	phoneVerificationService := services.NewPhoneVerificationService(firestoreService, userService)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(authService, userService)
	userHandler := handlers.NewUserHandler(userService)
	profileHandler := handlers.NewProfileHandler(profileService, phoneVerificationService)

	// Setup Gin router
	router := gin.Default()

	// Add middleware
	router.Use(middleware.CORSMiddleware())
	router.Use(middleware.LoggerMiddleware())

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "healthy",
			"service": "unalone-backend",
		})
	})

	// API routes
	v1 := router.Group("/api/v1")
	{
		// Auth routes
		auth := v1.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/refresh", authHandler.RefreshToken)
		}

		// User routes (protected)
		users := v1.Group("/users")
		users.Use(middleware.AuthMiddleware(authService))
		{
			users.GET("/profile", userHandler.GetProfile)
			users.PUT("/profile", profileHandler.UpdateProfile)
		}

		// Profile routes (protected)
		profile := v1.Group("/profile")
		profile.Use(middleware.AuthMiddleware(authService))
		{
			profile.PUT("/update", profileHandler.UpdateProfile)
			profile.POST("/image", profileHandler.UpdateProfileImage)
			profile.POST("/phone/verify", profileHandler.SendPhoneVerification)
			profile.POST("/phone/confirm", profileHandler.VerifyPhone)
			profile.GET("/settings", profileHandler.GetSettings)
			profile.PUT("/settings", profileHandler.UpdateSettings)
		}

		// Safety routes (protected)
		safety := v1.Group("/safety")
		safety.Use(middleware.AuthMiddleware(authService))
		{
			safety.POST("/block", profileHandler.BlockUser)
			safety.POST("/unblock", profileHandler.UnblockUser)
			safety.POST("/report", profileHandler.ReportUser)
		}
	}

	// Get port from environment or default to 8080
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Start server
	log.Printf("Server starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
