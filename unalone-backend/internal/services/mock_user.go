// Mock user service for testing without Firestore
package services

import (
	"errors"
	"time"

	"unalone-backend/internal/models"
)

// Mock implementations for UserService when running without Firestore

func (us *UserService) createUserMock(email, realName, nickname, passwordHash string) (*models.User, error) {
	// Load existing users
	users, err := us.loadMockUsers()
	if err != nil {
		return nil, err
	}

	// Check if email already exists
	for _, user := range users {
		if user.Email == email {
			return nil, errors.New("user with this email already exists")
		}
		if user.Nickname == nickname {
			return nil, errors.New("user with this nickname already exists")
		}
	}

	// Generate mock user ID
	userID := "mock_" + email + "_" + time.Now().Format("20060102150405")

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

	// Store in file-based storage
	users[userID] = user
	err = us.saveMockUsers(users)
	if err != nil {
		return nil, err
	}

	return user, nil
}

func (us *UserService) getUserByIDMock(userID string) (*models.User, error) {
	users, err := us.loadMockUsers()
	if err != nil {
		return nil, err
	}
	
	user, exists := users[userID]
	if !exists {
		return nil, errors.New("user not found")
	}
	return user, nil
}

func (us *UserService) getUserByEmailMock(email string) (*models.User, error) {
	users, err := us.loadMockUsers()
	if err != nil {
		return nil, err
	}
	
	for _, user := range users {
		if user.Email == email {
			return user, nil
		}
	}
	return nil, errors.New("user not found")
}

func (us *UserService) getUserByNicknameMock(nickname string) (*models.User, error) {
	users, err := us.loadMockUsers()
	if err != nil {
		return nil, err
	}
	
	for _, user := range users {
		if user.Nickname == nickname {
			return user, nil
		}
	}
	return nil, errors.New("user not found")
}

func (us *UserService) updateUserMock(userID string, updates map[string]interface{}) (*models.User, error) {
	// Load existing users
	users, err := us.loadMockUsers()
	if err != nil {
		return nil, err
	}
	
	user, exists := users[userID]
	if !exists {
		return nil, errors.New("user not found")
	}

	// Apply updates
	if nickname, ok := updates["nickname"].(string); ok {
		user.Nickname = nickname
	}
	if realName, ok := updates["real_name"].(string); ok {
		user.RealName = realName
	}
	if bio, ok := updates["bio"].(string); ok {
		user.Bio = bio
	}
	if dateOfBirth, ok := updates["date_of_birth"]; ok {
		// Handle date_of_birth conversion
		switch v := dateOfBirth.(type) {
		case string:
			// Parse string to time.Time
			if parsed, err := time.Parse(time.RFC3339, v); err == nil {
				user.DateOfBirth = parsed
			}
		case time.Time:
			user.DateOfBirth = v
		}
	}
	if gender, ok := updates["gender"].(string); ok {
		user.Gender = gender
	}
	if interests, ok := updates["interests"]; ok {
		// Handle interests array conversion
		switch v := interests.(type) {
		case []string:
			user.Interests = v
		case []interface{}:
			// Convert []interface{} to []string
			stringInterests := make([]string, len(v))
			for i, item := range v {
				if str, ok := item.(string); ok {
					stringInterests[i] = str
				}
			}
			user.Interests = stringInterests
		}
	}
	if phoneNumber, ok := updates["phone_number"].(string); ok {
		user.PhoneNumber = phoneNumber
	}
	if isPhoneVerified, ok := updates["is_phone_verified"].(bool); ok {
		user.IsPhoneVerified = isPhoneVerified
	}
	if profileImageURL, ok := updates["profile_image_url"].(string); ok {
		user.ProfileImageURL = profileImageURL
	}
	user.UpdatedAt = time.Now()

	// Save updated user back to file
	users[userID] = user
	err = us.saveMockUsers(users)
	if err != nil {
		return nil, err
	}

	return user, nil
}

// Helper function to check if we're in test mode
func (us *UserService) isTestMode() bool {
	return us.firestoreService.client == nil
}
