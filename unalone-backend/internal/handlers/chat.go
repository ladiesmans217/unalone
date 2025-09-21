// Chat handlers: WebSocket for realtime and REST for history
package handlers

import (
	"log"
	"net/http"
	"time"

	"unalone-backend/internal/models"
	"unalone-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type ChatHandler struct {
	chatService    *services.ChatService
	hotspotService *services.HotspotService
	authService    *services.AuthService
}

func NewChatHandler(cs *services.ChatService, hs *services.HotspotService, as *services.AuthService) *ChatHandler {
	return &ChatHandler{chatService: cs, hotspotService: hs, authService: as}
}

// Simple in-process hub per hotspot for broadcasting
type wsClient struct {
	conn *websocket.Conn
	send chan *models.ChatMessage
	user string
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

// hotspotID -> set of clients
var rooms = make(map[string]map[*wsClient]bool)

func (hh *ChatHandler) ChatWebSocket(c *gin.Context) {
	userID := ""
	if userIDAny, exists := c.Get("userID"); exists {
		userID = userIDAny.(string)
	} else {
		// Fallback for WebSocket clients that cannot set headers: token in query
		token := c.Query("token")
		if token == "" {
			c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
			return
		}
		claims, err := hh.authService.ValidateToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Invalid token"))
			return
		}
		userID = claims.UserID
	}

	hotspotID := c.Param("id")
	if hotspotID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Hotspot ID required"))
		return
	}

	// Ensure membership
	hotspot, err := hh.hotspotService.GetHotspot(hotspotID)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponseWithMessage("Hotspot not found"))
		return
	}
	isMember := false
	for _, id := range hotspot.Attendees {
		if id == userID {
			isMember = true
			break
		}
	}
	if !isMember {
		c.JSON(http.StatusForbidden, models.ErrorResponseWithMessage("Not a member of this hotspot"))
		return
	}

	// Upgrade
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("WS upgrade error:", err)
		return
	}

	client := &wsClient{conn: ws, send: make(chan *models.ChatMessage, 16), user: userID}
	// Register client
	if rooms[hotspotID] == nil {
		rooms[hotspotID] = make(map[*wsClient]bool)
	}
	rooms[hotspotID][client] = true

	// Writer goroutine
	go func() {
		defer func() {
			ws.Close()
		}()
		for msg := range client.send {
			ws.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := ws.WriteJSON(msg); err != nil {
				break
			}
		}
	}()

	// Reader loop
	for {
		var inbound struct {
			Content string `json:"content"`
		}
		if err := ws.ReadJSON(&inbound); err != nil {
			break
		}
		// Persist via service (also validates membership and sets nickname)
		msg, err := hh.chatService.SendMessage(userID, hotspotID, inbound.Content)
		if err != nil {
			continue
		}
		// Broadcast to room
		for cli := range rooms[hotspotID] {
			select {
			case cli.send <- msg:
			default:
			}
		}
	}

	// Cleanup on disconnect
	if clients, ok := rooms[hotspotID]; ok {
		if _, ok2 := clients[client]; ok2 {
			delete(clients, client)
			close(client.send)
		}
		if len(clients) == 0 {
			delete(rooms, hotspotID)
		}
	}
}

// Get recent messages via REST
func (hh *ChatHandler) GetRecentMessages(c *gin.Context) {
	hotspotID := c.Param("id")
	if hotspotID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Hotspot ID required"))
		return
	}

	// Optional: ensure requester is a member
	userIDAny, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}
	userID := userIDAny.(string)
	hotspot, err := hh.hotspotService.GetHotspot(hotspotID)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponseWithMessage("Hotspot not found"))
		return
	}
	isMember := false
	for _, id := range hotspot.Attendees {
		if id == userID {
			isMember = true
			break
		}
	}
	if !isMember {
		c.JSON(http.StatusForbidden, models.ErrorResponseWithMessage("Not a member"))
		return
	}

	messages, err := hh.chatService.GetRecentMessages(hotspotID, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponseWithMessage(err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse(messages, "Messages retrieved"))
}
