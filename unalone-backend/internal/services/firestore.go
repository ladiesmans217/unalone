// Firestore service for database operations
package services

import (
	"context"
	"log"
	"os"
	"strings"

	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"
)

// FirestoreService handles Firestore database operations
type FirestoreService struct {
	client *firestore.Client
	ctx    context.Context
}

// NewFirestoreService creates a new Firestore service instance
func NewFirestoreService(ctx context.Context) (*FirestoreService, error) {
	// Check if we're in test/demo mode (no credentials)
	if isTestMode() {
		log.Println("Running in TEST MODE - Firestore operations will be mocked")
		return &FirestoreService{
			client: nil, // Will be handled by mock functions
			ctx:    ctx,
		}, nil
	}

	// Initialize Firebase app for production
	var app *firebase.App
	var err error

	// Prefer explicit credentials via env
	if jsonCreds := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON"); strings.TrimSpace(jsonCreds) != "" {
		opt := option.WithCredentialsJSON([]byte(jsonCreds))
		app, err = firebase.NewApp(ctx, nil, opt)
	} else if credentialsFile := getServiceAccountPath(); credentialsFile != "" {
		opt := option.WithCredentialsFile(credentialsFile)
		app, err = firebase.NewApp(ctx, nil, opt)
	} else {
		// Default credentials (useful for local dev with gcloud auth)
		app, err = firebase.NewApp(ctx, nil)
	}

	if err != nil {
		log.Printf("Error initializing Firebase app: %v", err)
		return nil, err
	}

	// Create Firestore client
	client, err := app.Firestore(ctx)
	if err != nil {
		log.Printf("Error creating Firestore client: %v", err)
		return nil, err
	}

	return &FirestoreService{
		client: client,
		ctx:    ctx,
	}, nil
}

// isTestMode checks if we're running without Google Cloud credentials
func isTestMode() bool {
	// Explicit override
	if mode := os.Getenv("APP_MODE"); strings.ToLower(mode) == "test" || strings.ToLower(mode) == "mock" {
		return true
	}
	// If credentials are provided, not test mode
	if strings.TrimSpace(os.Getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")) != "" {
		return false
	}
	if getServiceAccountPath() != "" {
		return false
	}
	// Otherwise, default to test mode
	return true
}

// getServiceAccountPath returns the path to service account key file
func getServiceAccountPath() string {
	// Allow overriding via env var
	if p := strings.TrimSpace(os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")); p != "" {
		return p
	}
	return ""
}

// Close closes the Firestore client
func (fs *FirestoreService) Close() error {
	// In test mode, client may be nil; safely no-op
	if fs.client == nil {
		return nil
	}
	return fs.client.Close()
}

// GetClient returns the Firestore client for direct access
func (fs *FirestoreService) GetClient() *firestore.Client {
	return fs.client
}

// GetContext returns the context
func (fs *FirestoreService) GetContext() context.Context {
	return fs.ctx
}

// Collection returns a reference to a Firestore collection
func (fs *FirestoreService) Collection(name string) *firestore.CollectionRef {
	return fs.client.Collection(name)
}

// Collections used in the app
const (
	UsersCollection    = "users"
	HotspotsCollection = "hotspots"
	ChatsCollection    = "chats"
	MessagesCollection = "messages"
)
