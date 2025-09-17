// Profile models for user profile management
package models

import "time"

// UpdateProfileRequest represents profile update request
type UpdateProfileRequest struct {
	RealName    string    `json:"real_name" binding:"required,min=2,max=100"`
	Nickname    string    `json:"nickname" binding:"required,min=2,max=50"`
	Bio         string    `json:"bio" binding:"max=500"`
	DateOfBirth time.Time `json:"date_of_birth"`
	Gender      string    `json:"gender" binding:"oneof=male female other prefer-not-to-say"`
	Location    Location  `json:"location"`
	Interests   []string  `json:"interests" binding:"max=10"`
}

// PhoneVerificationRequest represents phone verification request
type PhoneVerificationRequest struct {
	PhoneNumber string `json:"phone_number" binding:"required,min=10,max=15"`
}

// VerifyPhoneRequest represents phone verification code submission
type VerifyPhoneRequest struct {
	PhoneNumber string `json:"phone_number" binding:"required"`
	Code        string `json:"code" binding:"required,len=6"`
}

// ProfileImageUploadResponse represents response after image upload
type ProfileImageUploadResponse struct {
	ImageURL string `json:"image_url"`
	Message  string `json:"message"`
}

// UserReportRequest represents user report request
type UserReportRequest struct {
	ReportedUserID string `json:"reported_user_id" binding:"required"`
	Reason         string `json:"reason" binding:"required,oneof=harassment spam inappropriate fake-profile other"`
	Description    string `json:"description" binding:"max=1000"`
}

// BlockUserRequest represents user blocking request
type BlockUserRequest struct {
	UserID string `json:"user_id" binding:"required"`
}

// UserSettings represents user application settings
type UserSettings struct {
	ID                    string `firestore:"id" json:"id"`
	UserID                string `firestore:"user_id" json:"user_id"`
	NotificationsEnabled  bool   `firestore:"notifications_enabled" json:"notifications_enabled"`
	EmailNotifications    bool   `firestore:"email_notifications" json:"email_notifications"`
	PushNotifications     bool   `firestore:"push_notifications" json:"push_notifications"`
	LocationSharing       bool   `firestore:"location_sharing" json:"location_sharing"`
	ProfileVisibility     string `firestore:"profile_visibility" json:"profile_visibility"` // public, friends, private
	ShowOnlineStatus      bool   `firestore:"show_online_status" json:"show_online_status"`
	DistanceRadius        int    `firestore:"distance_radius" json:"distance_radius"`        // in kilometers
	AgeRangeMin           int    `firestore:"age_range_min" json:"age_range_min"`
	AgeRangeMax           int    `firestore:"age_range_max" json:"age_range_max"`
	CreatedAt             time.Time `firestore:"created_at" json:"created_at"`
	UpdatedAt             time.Time `firestore:"updated_at" json:"updated_at"`
}

// UpdateSettingsRequest represents settings update request
type UpdateSettingsRequest struct {
	NotificationsEnabled bool   `json:"notifications_enabled"`
	EmailNotifications   bool   `json:"email_notifications"`
	PushNotifications    bool   `json:"push_notifications"`
	LocationSharing      bool   `json:"location_sharing"`
	ProfileVisibility    string `json:"profile_visibility" binding:"oneof=public friends private"`
	ShowOnlineStatus     bool   `json:"show_online_status"`
	DistanceRadius       int    `json:"distance_radius" binding:"min=1,max=100"`
	AgeRangeMin          int    `json:"age_range_min" binding:"min=18,max=100"`
	AgeRangeMax          int    `json:"age_range_max" binding:"min=18,max=100"`
}
