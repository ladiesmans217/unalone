package handlers

import (
	"net/http"
	"strconv"

	"unalone-backend/internal/models"
	"unalone-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type AIChatHandler struct {
	svc services.AIChatService
}

func NewAIChatHandler(svc services.AIChatService) *AIChatHandler {
	return &AIChatHandler{svc: svc}
}

func (h *AIChatHandler) CreateSession(c *gin.Context) {
	userID := c.GetString("userID")
	var req models.CreateAISessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	sess, err := h.svc.CreateSession(c.Request.Context(), userID, req.Title)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sess)
}

func (h *AIChatHandler) ListSessions(c *gin.Context) {
	userID := c.GetString("userID")
	sessions, err := h.svc.ListSessions(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sessions)
}

func (h *AIChatHandler) GetSession(c *gin.Context) {
	userID := c.GetString("userID")
	id := c.Param("id")
	sess, err := h.svc.GetSession(c.Request.Context(), userID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, sess)
}

func (h *AIChatHandler) GetMessages(c *gin.Context) {
	userID := c.GetString("userID")
	id := c.Param("id")
	limitStr := c.DefaultQuery("limit", "50")
	limit, _ := strconv.Atoi(limitStr)
	msgs, err := h.svc.GetMessages(c.Request.Context(), userID, id, limit)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, msgs)
}

func (h *AIChatHandler) SendMessage(c *gin.Context) {
	userID := c.GetString("userID")
	id := c.Param("id")
	var req models.SendAIMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	userMsg, aiMsg, err := h.svc.SendMessage(c.Request.Context(), userID, id, req.Content)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": userMsg, "ai": aiMsg})
}
