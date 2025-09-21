// Friends handler routes
package handlers

import (
	"net/http"

	"unalone-backend/internal/models"
	"unalone-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type FriendsHandler struct {
	friendsService      *services.FriendsService
	gamificationService *services.GamificationService
}

func NewFriendsHandler(fs *services.FriendsService, gs *services.GamificationService) *FriendsHandler {
	return &FriendsHandler{friendsService: fs, gamificationService: gs}
}

// GET /friends
func (fh *FriendsHandler) ListFriends(c *gin.Context) {
	uidAny, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}
	friends, err := fh.friendsService.ListFriends(uidAny.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponseWithMessage(err.Error()))
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse(friends, "Friends retrieved"))
}

// GET /friends/requests
func (fh *FriendsHandler) ListRequests(c *gin.Context) {
	uidAny, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}
	reqs, err := fh.friendsService.ListFriendRequests(uidAny.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponseWithMessage(err.Error()))
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse(reqs, "Requests retrieved"))
}

type sendReq struct {
	Target string `json:"target" binding:"required"` // ID or nickname
}

// POST /friends/requests
func (fh *FriendsHandler) SendRequest(c *gin.Context) {
	uidAny, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}
	var req sendReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Invalid request"))
		return
	}
	if err := fh.friendsService.SendFriendRequest(uidAny.(string), req.Target); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage(err.Error()))
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse(nil, "Request sent"))
}

type actReq struct {
	UserID string `json:"user_id" binding:"required"`
}

// POST /friends/accept
func (fh *FriendsHandler) Accept(c *gin.Context) {
	uidAny, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}
	var req actReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Invalid request"))
		return
	}
	if err := fh.friendsService.AcceptFriendRequest(uidAny.(string), req.UserID); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage(err.Error()))
		return
	}
	// Award points to both users for new friendship (best-effort)
	if fh.gamificationService != nil {
		_, _, _ = fh.gamificationService.AwardForFriendship(uidAny.(string))
		_, _, _ = fh.gamificationService.AwardForFriendship(req.UserID)
	}
	c.JSON(http.StatusOK, models.SuccessResponse(nil, "Friend request accepted"))
}

// POST /friends/reject
func (fh *FriendsHandler) Reject(c *gin.Context) {
	uidAny, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}
	var req actReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Invalid request"))
		return
	}
	if err := fh.friendsService.RejectFriendRequest(uidAny.(string), req.UserID); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage(err.Error()))
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse(nil, "Friend request rejected"))
}

// POST /friends/remove
func (fh *FriendsHandler) Remove(c *gin.Context) {
	uidAny, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, models.ErrorResponseWithMessage("Unauthorized"))
		return
	}
	var req actReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage("Invalid request"))
		return
	}
	if err := fh.friendsService.RemoveFriend(uidAny.(string), req.UserID); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponseWithMessage(err.Error()))
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse(nil, "Friend removed"))
}
