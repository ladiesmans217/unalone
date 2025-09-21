// Main entry point for the Unalone backend server
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"

	"unalone-backend/internal/handlers"
	"unalone-backend/internal/middleware"
	"unalone-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// loadDotEnv reads key=value pairs from a local .env file if present.
func loadDotEnv() {
	data, err := os.ReadFile(".env")
	if err != nil {
		return
	}
	lines := strings.Split(string(data), "\n")
	for _, raw := range lines {
		line := strings.TrimSpace(raw)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if idx := strings.Index(line, "="); idx != -1 {
			key := strings.TrimSpace(line[:idx])
			val := strings.TrimSpace(line[idx+1:])
			if len(val) >= 2 {
				if (val[0] == '"' && val[len(val)-1] == '"') || (val[0] == '\'' && val[len(val)-1] == '\'') {
					val = val[1 : len(val)-1]
				}
			}
			_ = os.Setenv(key, val)
		}
	}
}

func main() {
	// Load environment variables from .env if present
	loadDotEnv()
	// Initialize services
	ctx := context.Background()

	// Initialize Firestore service
	firestoreService, err := services.NewFirestoreService(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize Firestore service: %v", err)
	}
	defer firestoreService.Close()

	// Initialize Redis service for caching and geospatial operations
	redisService, err := services.NewRedisService(ctx)
	if err != nil {
		log.Printf("Redis service initialization failed: %v. Continuing without cache.", err)
	}
	if redisService != nil {
		defer redisService.Close()
	}

	// Initialize other services
	authService := services.NewAuthService(firestoreService)
	userService := services.NewUserService(firestoreService)
	profileService := services.NewProfileService(firestoreService, userService)
	phoneVerificationService := services.NewPhoneVerificationService(firestoreService, userService)
	hotspotService := services.NewHotspotService(firestoreService, userService)
	chatService := services.NewChatService(firestoreService, userService, hotspotService)
	friendsService := services.NewFriendsService(firestoreService, userService)
	gamificationService := services.NewGamificationService(firestoreService, userService)
	// AI chat service (in-memory). If GEMINI_API_KEY is set, real calls are made.
	aiService := services.NewInMemoryAIChatService()
	if os.Getenv("GEMINI_API_KEY") != "" {
		model := os.Getenv("GEMINI_MODEL")
		if strings.TrimSpace(model) == "" {
			model = "gemini-2.5-flash"
		}
		log.Printf("AI mode: Gemini enabled (model=%s)", model)
	} else {
		log.Printf("AI mode: Stubbed responses (no GEMINI_API_KEY set)")
	}

	// Initialize advanced geospatial service
	geospatialService := services.NewGeospatialService(redisService, firestoreService, userService)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(authService, userService)
	userHandler := handlers.NewUserHandler(userService)
	profileHandler := handlers.NewProfileHandler(profileService, phoneVerificationService)
	friendsHandler := handlers.NewFriendsHandler(friendsService, gamificationService)
	hotspotHandler := handlers.NewHotspotHandler(hotspotService, geospatialService, gamificationService)
	chatHandler := handlers.NewChatHandler(chatService, hotspotService, authService)
	aiHandler := handlers.NewAIChatHandler(aiService)

	// Setup Gin router
	router := gin.Default()

	// Add middleware
	router.Use(middleware.CORSMiddleware())
	router.Use(middleware.LoggerMiddleware())

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "unalone-backend",
		})
	})

	// API routes
	v1 := router.Group("/api/v1")
	{
		// Chat WebSocket route WITHOUT auth middleware (validates token via query)
		v1.GET("/hotspots/:id/chat/ws", chatHandler.ChatWebSocket)

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

		// Friends routes (protected)
		friends := v1.Group("/friends")
		friends.Use(middleware.AuthMiddleware(authService))
		{
			friends.GET("/", friendsHandler.ListFriends)
			friends.GET("/requests", friendsHandler.ListRequests)
			friends.POST("/requests", friendsHandler.SendRequest)
			friends.POST("/accept", friendsHandler.Accept)
			friends.POST("/reject", friendsHandler.Reject)
			friends.POST("/remove", friendsHandler.Remove)
		}

		// Safety routes (protected)
		safety := v1.Group("/safety")
		safety.Use(middleware.AuthMiddleware(authService))
		{
			safety.POST("/block", profileHandler.BlockUser)
			safety.POST("/unblock", profileHandler.UnblockUser)
			safety.POST("/report", profileHandler.ReportUser)
		}

		// Hotspot routes (protected)
		hotspots := v1.Group("/hotspots")
		hotspots.Use(middleware.AuthMiddleware(authService))
		{
			hotspots.POST("/", hotspotHandler.CreateHotspot)
			hotspots.GET("/search", hotspotHandler.SearchHotspots)
			hotspots.POST("/search/optimized", hotspotHandler.SearchHotspotsOptimized) // New optimized search
			hotspots.GET("/nearby", hotspotHandler.GetNearbyHotspots)
			hotspots.GET("/my", hotspotHandler.GetUserHotspots)
			hotspots.GET("/:id", hotspotHandler.GetHotspot)
			hotspots.PUT("/:id", hotspotHandler.UpdateHotspot)
			hotspots.DELETE("/:id", hotspotHandler.DeleteHotspot)
			hotspots.POST("/:id/join", hotspotHandler.JoinHotspot)
			hotspots.POST("/:id/leave", hotspotHandler.LeaveHotspot)

			// Performance and debugging endpoints
			hotspots.GET("/cache/stats", hotspotHandler.GetCacheStats)

			// Chat REST endpoint for history (protected)
			hotspots.GET("/:id/chat/messages", chatHandler.GetRecentMessages)
		}

		// AI Assistant routes (protected)
		ai := v1.Group("/ai")
		ai.Use(middleware.AuthMiddleware(authService))
		{
			ai.POST("/sessions", aiHandler.CreateSession)
			ai.GET("/sessions", aiHandler.ListSessions)
			ai.GET("/sessions/:id", aiHandler.GetSession)
			ai.GET("/sessions/:id/messages", aiHandler.GetMessages)
			ai.POST("/sessions/:id/messages", aiHandler.SendMessage)
		}

		log.Printf("AI routes registered under /api/v1/ai (Create/List/Get sessions, Get/Send messages)")
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
