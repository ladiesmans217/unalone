// Firestore service for database operations
package services

import (
	"context"
	"log"

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

	// Try to use service account key file if available
	if credentialsFile := getServiceAccountPath(); credentialsFile != "" {
		opt := option.WithCredentialsFile(credentialsFile)
		app, err = firebase.NewApp(ctx, nil, opt)
	} else {
		// Use default credentials (for local development with gcloud auth)
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
	// Check for service account credentials or gcloud auth
	if getServiceAccountPath() != "" {
		return false
	}
	
	// For now, assume test mode if no credentials are found
	// In production, this should be an environment variable
	return true
}

// getServiceAccountPath returns the path to service account key file
func getServiceAccountPath() string {
	// Check for service account key file in common locations
	// This will be set up when we configure Google Cloud
	// For now, return empty string to use default credentials
	return ""
}

// Close closes the Firestore client
func (fs *FirestoreService) Close() error {
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
	UsersCollection = "users"
	HotspotsCollection = "hotspots"
	ChatsCollection = "chats"
	MessagesCollection = "messages"
)
