// Chat models for hotspot chat rooms
package models

import "time"

// ChatMessage represents a message in a hotspot chat room
type ChatMessage struct {
	ID        string    `firestore:"id" json:"id"`
	HotspotID string    `firestore:"hotspot_id" json:"hotspot_id"`
	UserID    string    `firestore:"user_id" json:"user_id"`
	Nickname  string    `firestore:"nickname" json:"nickname"`
	Content   string    `firestore:"content" json:"content"`
	CreatedAt time.Time `firestore:"created_at" json:"created_at"`
}

// SendMessageRequest is used by clients to send a message
type SendMessageRequest struct {
	Content string `json:"content" binding:"required,min=1,max=2000"`
}
