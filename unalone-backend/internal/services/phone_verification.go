// Phone verification service using mock SMS for development
package services

import (
	"crypto/rand"
	"errors"
	"fmt"
	"log"
	"math/big"
	"time"

	"github.com/google/uuid"
	"unalone-backend/internal/models"
)

// PhoneVerificationService handles phone verification operations
type PhoneVerificationService struct {
	firestoreService *FirestoreService
	userService      *UserService
}

// NewPhoneVerificationService creates a new phone verification service
func NewPhoneVerificationService(fs *FirestoreService, us *UserService) *PhoneVerificationService {
	return &PhoneVerificationService{
		firestoreService: fs,
		userService:      us,
	}
}

// SendVerificationCode sends a verification code to the phone number
func (pvs *PhoneVerificationService) SendVerificationCode(userID, phoneNumber string) error {
	// Generate 6-digit verification code
	code, err := pvs.generateVerificationCode()
	if err != nil {
		return err
	}

	// Create verification record
	verification := &models.PhoneVerification{
		ID:          uuid.New().String(),
		UserID:      userID,
		PhoneNumber: phoneNumber,
		Code:        code,
		ExpiresAt:   time.Now().Add(10 * time.Minute), // 10 minutes expiry
		Attempts:    0,
		IsVerified:  false,
		CreatedAt:   time.Now(),
	}

	// Store verification record (in test mode, use mock storage)
	if pvs.isTestMode() {
		return pvs.storeVerificationMock(verification)
	}

	// In production, store in Firestore and send real SMS
	return pvs.storeVerificationFirestore(verification)
}

// VerifyPhoneCode verifies the submitted code
func (pvs *PhoneVerificationService) VerifyPhoneCode(userID, phoneNumber, code string) error {
	// Get verification record
	verification, err := pvs.getVerificationRecord(userID, phoneNumber)
	if err != nil {
		return err
	}

	// Check if code has expired
	if time.Now().After(verification.ExpiresAt) {
		return errors.New("verification code has expired")
	}

	// Check attempt limit (max 5 attempts)
	if verification.Attempts >= 5 {
		return errors.New("maximum verification attempts exceeded")
	}

	// Increment attempt count
	verification.Attempts++

	// Verify code
	if verification.Code != code {
		// Update attempt count
		if pvs.isTestMode() {
			pvs.updateVerificationMock(verification)
		} else {
			pvs.updateVerificationFirestore(verification)
		}
		return errors.New("invalid verification code")
	}

	// Mark as verified
	verification.IsVerified = true

	// Update verification record
	if pvs.isTestMode() {
		pvs.updateVerificationMock(verification)
	} else {
		pvs.updateVerificationFirestore(verification)
	}

	// Update user's phone verification status
	_, err = pvs.userService.UpdateUser(userID, map[string]interface{}{
		"phone_number":       phoneNumber,
		"is_phone_verified": true,
	})
	return err
}

// generateVerificationCode generates a 6-digit random code
func (pvs *PhoneVerificationService) generateVerificationCode() (string, error) {
	const digits = "0123456789"
	code := make([]byte, 6)
	
	for i := range code {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(digits))))
		if err != nil {
			return "", err
		}
		code[i] = digits[num.Int64()]
	}
	
	return string(code), nil
}

// Mock storage functions for testing
var mockVerifications = make(map[string]*models.PhoneVerification)

func (pvs *PhoneVerificationService) storeVerificationMock(verification *models.PhoneVerification) error {
	key := fmt.Sprintf("%s_%s", verification.UserID, verification.PhoneNumber)
	mockVerifications[key] = verification
	
	// In test mode, log the verification code for testing
	log.Printf("📱 SMS Verification Code for %s: %s (expires in 10 minutes)", 
		verification.PhoneNumber, verification.Code)
	
	return nil
}

func (pvs *PhoneVerificationService) getVerificationRecord(userID, phoneNumber string) (*models.PhoneVerification, error) {
	if pvs.isTestMode() {
		key := fmt.Sprintf("%s_%s", userID, phoneNumber)
		verification, exists := mockVerifications[key]
		if !exists {
			return nil, errors.New("verification record not found")
		}
		return verification, nil
	}

	// In production, query Firestore
	return nil, errors.New("firestore implementation needed")
}

func (pvs *PhoneVerificationService) updateVerificationMock(verification *models.PhoneVerification) error {
	key := fmt.Sprintf("%s_%s", verification.UserID, verification.PhoneNumber)
	mockVerifications[key] = verification
	return nil
}

func (pvs *PhoneVerificationService) storeVerificationFirestore(verification *models.PhoneVerification) error {
	// TODO: Implement Firestore storage
	// ctx := pvs.firestoreService.GetContext()
	// verificationRef := pvs.firestoreService.Collection("phone_verifications")
	// _, err := verificationRef.Doc(verification.ID).Set(ctx, verification)
	// return err
	return errors.New("firestore implementation needed")
}

func (pvs *PhoneVerificationService) updateVerificationFirestore(verification *models.PhoneVerification) error {
	// TODO: Implement Firestore update
	return errors.New("firestore implementation needed")
}

func (pvs *PhoneVerificationService) isTestMode() bool {
	return pvs.firestoreService.client == nil
}

// SendSMS sends actual SMS (for production)
func (pvs *PhoneVerificationService) sendSMS(phoneNumber, message string) error {
	// TODO: Implement with Twilio or Firebase Auth
	// For now, just log the message
	log.Printf("📱 SMS to %s: %s", phoneNumber, message)
	return nil
}

// CleanupExpiredVerifications removes expired verification records
func (pvs *PhoneVerificationService) CleanupExpiredVerifications() {
	if pvs.isTestMode() {
		// Clean up mock storage
		for key, verification := range mockVerifications {
			if time.Now().After(verification.ExpiresAt) {
				delete(mockVerifications, key)
			}
		}
	}
	// TODO: Implement Firestore cleanup
}
