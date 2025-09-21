// Chat service to handle hotspot chat functionality
package services

import (
	"errors"
	"sort"
	"time"

	"unalone-backend/internal/models"

	"github.com/google/uuid"
)

// ChatService provides methods to interact with chat messages
type ChatService struct {
	firestoreService *FirestoreService
	userService      *UserService
	hotspotService   *HotspotService
}

// NewChatService creates a new chat service
func NewChatService(fs *FirestoreService, us *UserService, hs *HotspotService) *ChatService {
	return &ChatService{
		firestoreService: fs,
		userService:      us,
		hotspotService:   hs,
	}
}

// SendMessage sends a chat message to a hotspot chat room after verifying membership
func (cs *ChatService) SendMessage(userID, hotspotID, content string) (*models.ChatMessage, error) {
	if content == "" {
		return nil, errors.New("message content cannot be empty")
	}

	// Verify hotspot exists and user is an attendee
	hotspot, err := cs.hotspotService.GetHotspot(hotspotID)
	if err != nil {
		return nil, err
	}

	isMember := false
	for _, id := range hotspot.Attendees {
		if id == userID {
			isMember = true
			break
		}
	}
	if !isMember {
		return nil, errors.New("user is not a member of this hotspot")
	}

	// Get user to load nickname
	user, err := cs.userService.GetUserByID(userID)
	if err != nil {
		return nil, err
	}

	msg := &models.ChatMessage{
		ID:        uuid.New().String(),
		HotspotID: hotspotID,
		UserID:    userID,
		Nickname:  user.Nickname,
		Content:   content,
		CreatedAt: time.Now(),
	}

	if cs.isTestMode() {
		return cs.saveMessageMock(msg)
	}

	// TODO: Save to Firestore collection structure: chats/{hotspotID}/messages/{messageID}
	return nil, errors.New("firestore implementation needed")
}

// GetRecentMessages returns the latest N messages for a hotspot
func (cs *ChatService) GetRecentMessages(hotspotID string, limit int) ([]*models.ChatMessage, error) {
	if limit <= 0 {
		limit = 50
	}

	if cs.isTestMode() {
		return cs.getRecentMessagesMock(hotspotID, limit)
	}

	// TODO: Query Firestore ordered by created_at desc, limit N
	return nil, errors.New("firestore implementation needed")
}

// isTestMode checks if we're running with mocked database
func (cs *ChatService) isTestMode() bool {
	return cs.firestoreService.client == nil
}

// === Mock storage in-memory for development/test ===
var mockChatMessages = make(map[string][]*models.ChatMessage) // hotspotID -> messages

func (cs *ChatService) saveMessageMock(msg *models.ChatMessage) (*models.ChatMessage, error) {
	list := mockChatMessages[msg.HotspotID]
	list = append(list, msg)
	// Keep only the most recent 200 to limit memory
	if len(list) > 200 {
		list = list[len(list)-200:]
	}
	mockChatMessages[msg.HotspotID] = list
	return msg, nil
}

func (cs *ChatService) getRecentMessagesMock(hotspotID string, limit int) ([]*models.ChatMessage, error) {
	list := mockChatMessages[hotspotID]
	// Sort by CreatedAt ascending for UI
	sort.Slice(list, func(i, j int) bool {
		return list[i].CreatedAt.Before(list[j].CreatedAt)
	})
	if len(list) > limit {
		list = list[len(list)-limit:]
	}
	// Return a copy to avoid external mutation
	out := make([]*models.ChatMessage, len(list))
	copy(out, list)
	return out, nil
}
