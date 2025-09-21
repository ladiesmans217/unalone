// AI chat models for generative assistant
package models

import "time"

type AIChatSession struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type AIMessage struct {
	ID        string    `json:"id"`
	SessionID string    `json:"session_id"`
	Role      string    `json:"role"` // user | ai
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

type CreateAISessionRequest struct {
	Title string `json:"title"`
}

type SendAIMessageRequest struct {
	Content string `json:"content" binding:"required,min=1,max=4000"`
}
