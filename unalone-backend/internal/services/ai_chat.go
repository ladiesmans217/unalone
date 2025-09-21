package services

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"unalone-backend/internal/models"
)

type AIChatService interface {
	CreateSession(ctx context.Context, userID string, title string) (*models.AIChatSession, error)
	ListSessions(ctx context.Context, userID string) ([]*models.AIChatSession, error)
	GetSession(ctx context.Context, userID, sessionID string) (*models.AIChatSession, error)
	SendMessage(ctx context.Context, userID, sessionID, content string) (*models.AIMessage, *models.AIMessage, error)
	GetMessages(ctx context.Context, userID, sessionID string, limit int) ([]*models.AIMessage, error)
}

type InMemoryAIChatService struct {
	mu             sync.RWMutex
	sessionsByUser map[string]map[string]*models.AIChatSession // userID -> sessionID -> session
	messages       map[string][]*models.AIMessage              // sessionID -> messages
	geminiAPIKey   string
}

func NewInMemoryAIChatService() *InMemoryAIChatService {
	return &InMemoryAIChatService{
		sessionsByUser: make(map[string]map[string]*models.AIChatSession),
		messages:       make(map[string][]*models.AIMessage),
		geminiAPIKey:   strings.TrimSpace(os.Getenv("GEMINI_API_KEY")),
	}
}

func genID(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return time.Now().Format("20060102150405")
	}
	return hex.EncodeToString(b)
}

func (s *InMemoryAIChatService) CreateSession(ctx context.Context, userID string, title string) (*models.AIChatSession, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, errors.New("userID required")
	}
	if strings.TrimSpace(title) == "" {
		title = "New Chat"
	}
	now := time.Now()
	sess := &models.AIChatSession{
		ID:        genID(8),
		UserID:    userID,
		Title:     title,
		CreatedAt: now,
		UpdatedAt: now,
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.sessionsByUser[userID]; !ok {
		s.sessionsByUser[userID] = make(map[string]*models.AIChatSession)
	}
	s.sessionsByUser[userID][sess.ID] = sess
	// initialize empty history
	s.messages[sess.ID] = []*models.AIMessage{}
	// Seed with a welcome message so the chat isn't empty
	welcome := &models.AIMessage{
		ID:        genID(6),
		SessionID: sess.ID,
		Role:      "ai",
		Content:   "Hi! I’m your Unalone Wellbeing Guide. I offer empathetic, culturally sensitive support and practical tips. I’m not a substitute for a professional. How can I support you today?",
		CreatedAt: now,
	}
	s.messages[sess.ID] = append(s.messages[sess.ID], welcome)
	return sess, nil
}

func (s *InMemoryAIChatService) ListSessions(ctx context.Context, userID string) ([]*models.AIChatSession, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sessionsMap := s.sessionsByUser[userID]
	res := make([]*models.AIChatSession, 0, len(sessionsMap))
	for _, v := range sessionsMap {
		res = append(res, v)
	}
	sort.Slice(res, func(i, j int) bool { return res[i].UpdatedAt.After(res[j].UpdatedAt) })
	return res, nil
}

func (s *InMemoryAIChatService) GetSession(ctx context.Context, userID, sessionID string) (*models.AIChatSession, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	m := s.sessionsByUser[userID]
	if m == nil {
		return nil, errors.New("not found")
	}
	sess := m[sessionID]
	if sess == nil {
		return nil, errors.New("not found")
	}
	return sess, nil
}

func (s *InMemoryAIChatService) SendMessage(ctx context.Context, userID, sessionID, content string) (*models.AIMessage, *models.AIMessage, error) {
	if strings.TrimSpace(content) == "" {
		return nil, nil, errors.New("content required")
	}
	s.mu.Lock()
	// verify session ownership
	sessMap := s.sessionsByUser[userID]
	if sessMap == nil || sessMap[sessionID] == nil {
		s.mu.Unlock()
		return nil, nil, errors.New("session not found")
	}
	now := time.Now()
	userMsg := &models.AIMessage{ID: genID(6), SessionID: sessionID, Role: "user", Content: content, CreatedAt: now}
	s.messages[sessionID] = append(s.messages[sessionID], userMsg)
	sessMap[sessionID].UpdatedAt = now
	s.mu.Unlock()

	// Call Gemini or return a stubbed response
	aiText := s.generateAIResponse(ctx, sessionID, content)

	s.mu.Lock()
	aiMsg := &models.AIMessage{ID: genID(6), SessionID: sessionID, Role: "ai", Content: aiText, CreatedAt: time.Now()}
	s.messages[sessionID] = append(s.messages[sessionID], aiMsg)
	sessMap[sessionID].UpdatedAt = aiMsg.CreatedAt
	s.mu.Unlock()

	return userMsg, aiMsg, nil
}

func (s *InMemoryAIChatService) GetMessages(ctx context.Context, userID, sessionID string, limit int) ([]*models.AIMessage, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sessMap := s.sessionsByUser[userID]
	if sessMap == nil || sessMap[sessionID] == nil {
		return nil, errors.New("session not found")
	}
	arr := s.messages[sessionID]
	if limit <= 0 || limit > len(arr) {
		limit = len(arr)
	}
	return arr[len(arr)-limit:], nil
}

// generateAIResponse produces a response using Gemini if configured, otherwise returns a simple echo.
func (s *InMemoryAIChatService) generateAIResponse(ctx context.Context, sessionID string, content string) string {
	if s.geminiAPIKey == "" {
		// Fallback local response when no key is configured
		return "(AI) You said: " + content
	}

	// Build conversation context with last few messages
	s.mu.RLock()
	history := s.messages[sessionID]
	s.mu.RUnlock()

	// Map internal messages to Gemini contents
	type gemPart struct {
		Text string `json:"text,omitempty"`
	}
	type gemContent struct {
		Role  string    `json:"role,omitempty"`
		Parts []gemPart `json:"parts"`
	}
	type gemRequest struct {
		Contents          []gemContent `json:"contents"`
		SystemInstruction *struct {
			Parts []gemPart `json:"parts"`
		} `json:"systemInstruction,omitempty"`
		GenerationConfig *struct {
			Temperature float64 `json:"temperature,omitempty"`
			TopP        float64 `json:"topP,omitempty"`
		} `json:"generationConfig,omitempty"`
	}
	type gemResponse struct {
		Candidates []struct {
			Content struct {
				Parts []gemPart `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
		// Ignore other fields
	}

	contents := make([]gemContent, 0, 12)
	// Include up to last 10 messages of context
	start := 0
	if len(history) > 10 {
		start = len(history) - 10
	}
	for _, m := range history[start:] {
		role := m.Role
		if role == "ai" {
			role = "model"
		}
		contents = append(contents, gemContent{Role: role, Parts: []gemPart{{Text: m.Content}}})
	}

	// System prompt emphasizing culturally sensitive mental health support (override with AI_SYSTEM_PROMPT)
	sys := strings.TrimSpace(os.Getenv("AI_SYSTEM_PROMPT"))
	if sys == "" {
		// Detailed, culturally-sensitive persona for Indian students and young adults
		sys = strings.TrimSpace(`
You are Unalone’s Wellbeing Guide — a warm, non-clinical companion for students and young adults in India.

Core persona and tone:
- Speak like a caring senior, mentor, or friend: warm, respectful, and stigma-free.
- Be concise, practical, and hopeful. Prefer short paragraphs and lists over long lectures.
- Use simple English that’s comfortable for an Indian audience; you may acknowledge local context (family, exams, hostels, placements, finances, societal pressure, culture).

Scope and boundaries:
- You offer emotional support, reflection, coping skills, and psychoeducation.
- You are NOT a medical professional; do not diagnose or prescribe. Add a gentle reminder: “I’m not a substitute for a professional.”
- If you detect crisis, self-harm, harm to others, severe abuse, or immediate danger, encourage reaching out to trusted people and local emergency services/helplines. Do not provide step-by-step methods of self-harm.

How to respond:
- Start with brief, empathetic validation (reflect feelings without clichés).
- Offer 2–5 concrete, low-effort steps (e.g., paced breathing, grounding, micro-breaks, journaling prompts, sleep hygiene tweaks) tailored to what they said.
- Where relevant, suggest approachable, low-cost options (campus counselor, peer groups, government or NGO services, tele-helplines, college dean/mentor), framed as choices, never commands.
- Encourage small check-ins, routines, and self-compassion rather than perfection.
- When asked factual questions, answer simply and practically; cite if needed; avoid medical or legal claims.

Style guidelines:
- Prefer “Could we try…”, “One gentle option…”, “If it helps…”.
- Avoid judgment, labels, or pathologizing language.
- Keep most answers under ~180 words unless the user asks for depth.

If the user asks “Who are you?”, answer as this persona (Unalone’s Wellbeing Guide) instead of calling yourself a generic large language model.`)
	}
	sysContent := &struct {
		Parts []gemPart `json:"parts"`
	}{Parts: []gemPart{{Text: sys}}}
	req := gemRequest{
		Contents:          contents,
		SystemInstruction: sysContent,
		GenerationConfig: &struct {
			Temperature float64 `json:"temperature,omitempty"`
			TopP        float64 `json:"topP,omitempty"`
		}{Temperature: 0.6, TopP: 0.9},
	}
	reqBody, _ := json.Marshal(req)

	model := strings.TrimSpace(os.Getenv("GEMINI_MODEL"))
	if model == "" {
		model = "gemini-2.5-flash"
	}
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent", model)

	client := &http.Client{Timeout: 20 * time.Second}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(reqBody))
	if err != nil {
		log.Printf("gemini request build error: %v", err)
		return "I'm having trouble reaching AI right now. Please try again."
	}
	httpReq.Header.Set("Content-Type", "application/json")
	// Per latest docs, pass API key via header
	httpReq.Header.Set("x-goog-api-key", s.geminiAPIKey)

	resp, err := client.Do(httpReq)
	if err != nil {
		log.Printf("gemini http error: %v", err)
		return "I'm having trouble reaching AI right now. Please try again."
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("gemini non-200: %d body=%s", resp.StatusCode, string(body))
		return "I'm having trouble reaching AI right now. Please try again."
	}
	var gr gemResponse
	if err := json.Unmarshal(body, &gr); err != nil {
		log.Printf("gemini parse error: %v body=%s", err, string(body))
		return "I'm having trouble reading AI's response."
	}
	if len(gr.Candidates) == 0 || len(gr.Candidates[0].Content.Parts) == 0 {
		return "I'm not sure how to respond to that yet. Could you rephrase?"
	}
	return gr.Candidates[0].Content.Parts[0].Text
}
