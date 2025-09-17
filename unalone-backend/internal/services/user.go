// User service for user-related operations
package services

import (
	"encoding/json"
	"errors"
	"io/ioutil"
	"os"
	"path/filepath"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"unalone-backend/internal/models"
)

// UserService handles user-related operations
type UserService struct {
	firestoreService *FirestoreService
}

// NewUserService creates a new user service
func NewUserService(fs *FirestoreService) *UserService {
	return &UserService{
		firestoreService: fs,
	}
}

// CreateUser creates a new user in Firestore or mock storage
func (us *UserService) CreateUser(email, realName, nickname, passwordHash string) (*models.User, error) {
	// Use mock storage if in test mode
	if us.isTestMode() {
		return us.createUserMock(email, realName, nickname, passwordHash)
	}

	ctx := us.firestoreService.GetContext()
	usersRef := us.firestoreService.Collection(UsersCollection)

	// Check if email already exists
	existingUser, err := us.GetUserByEmail(email)
	if err == nil && existingUser != nil {
		return nil, errors.New("user with this email already exists")
	}

	// Check if nickname already exists
	existingNickname, err := us.GetUserByNickname(nickname)
	if err == nil && existingNickname != nil {
		return nil, errors.New("user with this nickname already exists")
	}

	// Generate new user ID
	userID := uuid.New().String()

	// Create user object
	user := &models.User{
		ID:              userID,
		Email:           email,
		RealName:        realName,
		Nickname:        nickname,
		PasswordHash:    passwordHash,
		IsPhoneVerified: false,
		IsEmailVerified: false,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	// Save user to Firestore
	_, err = usersRef.Doc(userID).Set(ctx, user)
	if err != nil {
		return nil, err
	}

	return user, nil
}

// GetUserByID retrieves a user by their ID
func (us *UserService) GetUserByID(userID string) (*models.User, error) {
	// Use mock storage if in test mode
	if us.isTestMode() {
		return us.getUserByIDMock(userID)
	}

	ctx := us.firestoreService.GetContext()
	usersRef := us.firestoreService.Collection(UsersCollection)

	doc, err := usersRef.Doc(userID).Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	var user models.User
	if err := doc.DataTo(&user); err != nil {
		return nil, err
	}

	return &user, nil
}

// GetUserByEmail retrieves a user by their email
func (us *UserService) GetUserByEmail(email string) (*models.User, error) {
	// Use mock storage if in test mode
	if us.isTestMode() {
		return us.getUserByEmailMock(email)
	}

	ctx := us.firestoreService.GetContext()
	usersRef := us.firestoreService.Collection(UsersCollection)

	docs, err := usersRef.Where("email", "==", email).Limit(1).Documents(ctx).GetAll()
	if err != nil {
		return nil, err
	}

	if len(docs) == 0 {
		return nil, errors.New("user not found")
	}

	var user models.User
	if err := docs[0].DataTo(&user); err != nil {
		return nil, err
	}

	return &user, nil
}

// GetUserByNickname retrieves a user by their nickname
func (us *UserService) GetUserByNickname(nickname string) (*models.User, error) {
	// Use mock storage if in test mode
	if us.isTestMode() {
		return us.getUserByNicknameMock(nickname)
	}

	ctx := us.firestoreService.GetContext()
	usersRef := us.firestoreService.Collection(UsersCollection)

	docs, err := usersRef.Where("nickname", "==", nickname).Limit(1).Documents(ctx).GetAll()
	if err != nil {
		return nil, err
	}

	if len(docs) == 0 {
		return nil, errors.New("user not found")
	}

	var user models.User
	if err := docs[0].DataTo(&user); err != nil {
		return nil, err
	}

	return &user, nil
}

// UpdateUser updates user information
func (us *UserService) UpdateUser(userID string, updates map[string]interface{}) (*models.User, error) {
	// Use mock storage if in test mode
	if us.isTestMode() {
		return us.updateUserMock(userID, updates)
	}

	ctx := us.firestoreService.GetContext()
	usersRef := us.firestoreService.Collection(UsersCollection)

	// Add updated timestamp
	updates["updated_at"] = time.Now()

	// Update user document
	_, err := usersRef.Doc(userID).Set(ctx, updates, firestore.MergeAll)
	if err != nil {
		return nil, err
	}

	// Return updated user
	return us.GetUserByID(userID)
}

// DeleteUser deletes a user (soft delete by updating status)
func (us *UserService) DeleteUser(userID string) error {
	ctx := us.firestoreService.GetContext()
	usersRef := us.firestoreService.Collection(UsersCollection)

	updates := map[string]interface{}{
		"deleted_at": time.Now(),
		"updated_at": time.Now(),
	}

	_, err := usersRef.Doc(userID).Set(ctx, updates, firestore.MergeAll)
	return err
}

// File-based persistent mock storage for development
const mockDataFile = "mock_users.json"

// loadMockUsers loads users from JSON file
func (us *UserService) loadMockUsers() (map[string]*models.User, error) {
	users := make(map[string]*models.User)
	
	// Check if file exists
	if _, err := os.Stat(mockDataFile); os.IsNotExist(err) {
		return users, nil // Return empty map if file doesn't exist
	}

	// Read file
	data, err := ioutil.ReadFile(mockDataFile)
	if err != nil {
		return users, err
	}

	// Parse JSON
	if len(data) > 0 {
		err = json.Unmarshal(data, &users)
		if err != nil {
			return users, err
		}
	}

	return users, nil
}

// saveMockUsers saves users to JSON file
func (us *UserService) saveMockUsers(users map[string]*models.User) error {
	// Create directory if it doesn't exist
	dir := filepath.Dir(mockDataFile)
	if dir != "." {
		os.MkdirAll(dir, 0755)
	}

	// Marshal to JSON
	data, err := json.MarshalIndent(users, "", "  ")
	if err != nil {
		return err
	}

	// Write to file
	return ioutil.WriteFile(mockDataFile, data, 0644)
}
