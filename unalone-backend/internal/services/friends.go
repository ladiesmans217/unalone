// Friends service manages friendships and friend requests
package services

import (
	"errors"
	"unalone-backend/internal/models"
)

// FriendsService provides operations for friend requests and lists
type FriendsService struct {
	firestoreService *FirestoreService
	userService      *UserService
}

func NewFriendsService(fs *FirestoreService, us *UserService) *FriendsService {
	return &FriendsService{firestoreService: fs, userService: us}
}

// SendFriendRequest sends a friend request from requesterID to targetNickname or targetUserID
func (fs *FriendsService) SendFriendRequest(requesterID, targetIdentifier string) error {
	if fs.isTestMode() {
		return fs.sendFriendRequestMock(requesterID, targetIdentifier)
	}
	return errors.New("firestore implementation needed")
}

// AcceptFriendRequest accepts a pending request
func (fs *FriendsService) AcceptFriendRequest(userID, requesterID string) error {
	if fs.isTestMode() {
		return fs.acceptFriendRequestMock(userID, requesterID)
	}
	return errors.New("firestore implementation needed")
}

// RejectFriendRequest rejects a pending request
func (fs *FriendsService) RejectFriendRequest(userID, requesterID string) error {
	if fs.isTestMode() {
		return fs.rejectFriendRequestMock(userID, requesterID)
	}
	return errors.New("firestore implementation needed")
}

// RemoveFriend removes friendship between two users
func (fs *FriendsService) RemoveFriend(userID, friendID string) error {
	if fs.isTestMode() {
		return fs.removeFriendMock(userID, friendID)
	}
	return errors.New("firestore implementation needed")
}

// ListFriends returns public info for a user's friends
func (fs *FriendsService) ListFriends(userID string) ([]models.PublicUser, error) {
	if fs.isTestMode() {
		return fs.listFriendsMock(userID)
	}
	return nil, errors.New("firestore implementation needed")
}

// ListFriendRequests returns pending requests (received and sent)
type FriendRequests struct {
	Received []models.PublicUser `json:"received"`
	Sent     []models.PublicUser `json:"sent"`
}

func (fs *FriendsService) ListFriendRequests(userID string) (*FriendRequests, error) {
	if fs.isTestMode() {
		return fs.listFriendRequestsMock(userID)
	}
	return nil, errors.New("firestore implementation needed")
}

// Helpers
func (fs *FriendsService) isTestMode() bool { return fs.firestoreService.client == nil }
