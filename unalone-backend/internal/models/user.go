// User model for Firestore documents
package models

import (
	"time"
)

// User represents a user in the system
type User struct {
	ID              string    `firestore:"id" json:"id"`
	Email           string    `firestore:"email" json:"email"`
	RealName        string    `firestore:"real_name" json:"real_name"` // Private field
	Nickname        string    `firestore:"nickname" json:"nickname"`   // Public field
	PasswordHash    string    `firestore:"password_hash" json:"-"`     // Never send in JSON
	PhoneNumber     string    `firestore:"phone_number" json:"phone_number,omitempty"`
	IsPhoneVerified bool      `firestore:"is_phone_verified" json:"is_phone_verified"`
	IsEmailVerified bool      `firestore:"is_email_verified" json:"is_email_verified"`
	ProfileImageURL string    `firestore:"profile_image_url" json:"profile_image_url,omitempty"`
	Bio             string    `firestore:"bio" json:"bio,omitempty"`
	DateOfBirth     time.Time `firestore:"date_of_birth" json:"date_of_birth,omitempty"`
	Gender          string    `firestore:"gender" json:"gender,omitempty"`
	Location        Location  `firestore:"location" json:"location,omitempty"`
	Interests       []string  `firestore:"interests" json:"interests,omitempty"`
	IsBlocked       bool      `firestore:"is_blocked" json:"is_blocked"`
	BlockedBy       []string  `firestore:"blocked_by" json:"-"`   // Never send in JSON
	ReportCount     int       `firestore:"report_count" json:"-"` // Never send in JSON
	// Social graph
	Friends                []string `firestore:"friends" json:"friends,omitempty"`
	FriendRequestsReceived []string `firestore:"friend_requests_received" json:"friend_requests_received,omitempty"`
	FriendRequestsSent     []string `firestore:"friend_requests_sent" json:"friend_requests_sent,omitempty"`
	// Gamification
	Points     int       `firestore:"points" json:"points"`
	Level      int       `firestore:"level" json:"level"`
	LastActive time.Time `firestore:"last_active" json:"last_active"`
	CreatedAt  time.Time `firestore:"created_at" json:"created_at"`
	UpdatedAt  time.Time `firestore:"updated_at" json:"updated_at"`
}

// Location represents user's location
type Location struct {
	Latitude  float64 `firestore:"latitude" json:"latitude"`
	Longitude float64 `firestore:"longitude" json:"longitude"`
	City      string  `firestore:"city" json:"city,omitempty"`
	Country   string  `firestore:"country" json:"country,omitempty"`
}

// UserReport represents a user report
type UserReport struct {
	ID          string    `firestore:"id" json:"id"`
	ReporterID  string    `firestore:"reporter_id" json:"reporter_id"`
	ReportedID  string    `firestore:"reported_id" json:"reported_id"`
	Reason      string    `firestore:"reason" json:"reason"`
	Description string    `firestore:"description" json:"description"`
	Status      string    `firestore:"status" json:"status"` // pending, reviewed, resolved
	ReviewedBy  string    `firestore:"reviewed_by" json:"reviewed_by,omitempty"`
	ReviewedAt  time.Time `firestore:"reviewed_at" json:"reviewed_at,omitempty"`
	CreatedAt   time.Time `firestore:"created_at" json:"created_at"`
}

// PhoneVerification represents phone verification data
type PhoneVerification struct {
	ID          string    `firestore:"id" json:"id"`
	UserID      string    `firestore:"user_id" json:"user_id"`
	PhoneNumber string    `firestore:"phone_number" json:"phone_number"`
	Code        string    `firestore:"code" json:"-"` // Never send in JSON
	ExpiresAt   time.Time `firestore:"expires_at" json:"expires_at"`
	Attempts    int       `firestore:"attempts" json:"attempts"`
	IsVerified  bool      `firestore:"is_verified" json:"is_verified"`
	CreatedAt   time.Time `firestore:"created_at" json:"created_at"`
}

// PublicUser represents user data that can be shared publicly
type PublicUser struct {
	ID       string `json:"id"`
	Nickname string `json:"nickname"`
}

// AuthRequest represents login/register request
type AuthRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	RealName string `json:"real_name,omitempty"` // Only for registration
	Nickname string `json:"nickname,omitempty"`  // Only for registration
}

// AuthResponse represents authentication response
type AuthResponse struct {
	Token   string `json:"token"`
	User    User   `json:"user"`
	Message string `json:"message"`
}

// Removed UpdateProfileRequest - now defined in profile.go
