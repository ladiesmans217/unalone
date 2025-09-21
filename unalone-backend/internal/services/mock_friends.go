// Mock implementations for FriendsService when running without Firestore
package services

import (
	"errors"
	"sort"
	"time"

	"unalone-backend/internal/models"
)

func (fs *FriendsService) sendFriendRequestMock(requesterID, targetIdentifier string) error {
	users, err := fs.userService.loadMockUsers()
	if err != nil {
		return err
	}

	requester, ok := users[requesterID]
	if !ok {
		return errors.New("requester not found")
	}

	// Resolve target by ID or nickname
	var target *models.User
	for _, u := range users {
		if u.ID == targetIdentifier || u.Nickname == targetIdentifier {
			target = u
			break
		}
	}
	if target == nil {
		return errors.New("target user not found")
	}
	if target.ID == requesterID {
		return errors.New("cannot friend yourself")
	}

	// Already friends
	for _, fid := range requester.Friends {
		if fid == target.ID {
			return errors.New("already friends")
		}
	}

	// If inverse request exists, auto-accept
	for _, rid := range requester.FriendRequestsSent {
		if rid == target.ID {
			// They already have a pending request from me; keep as sent
			return errors.New("request already sent")
		}
	}
	for _, rid := range requester.FriendRequestsReceived {
		if rid == target.ID {
			// Mutual request -> accept
			return fs.acceptFriendRequestMock(requesterID, target.ID)
		}
	}

	// Add to sent/received lists
	requester.FriendRequestsSent = append(requester.FriendRequestsSent, target.ID)
	target.FriendRequestsReceived = append(target.FriendRequestsReceived, requester.ID)
	requester.UpdatedAt = time.Now()
	target.UpdatedAt = time.Now()
	users[requester.ID] = requester
	users[target.ID] = target
	return fs.userService.saveMockUsers(users)
}

func (fs *FriendsService) acceptFriendRequestMock(userID, requesterID string) error {
	users, err := fs.userService.loadMockUsers()
	if err != nil {
		return err
	}

	user, ok := users[userID]
	if !ok {
		return errors.New("user not found")
	}
	req, ok := users[requesterID]
	if !ok {
		return errors.New("requester not found")
	}

	// Verify pending
	found := false
	newRecv := make([]string, 0, len(user.FriendRequestsReceived))
	for _, id := range user.FriendRequestsReceived {
		if id == requesterID {
			found = true
			continue
		}
		newRecv = append(newRecv, id)
	}
	if !found {
		return errors.New("no pending request")
	}
	user.FriendRequestsReceived = newRecv

	// Remove from requester's sent
	newSent := make([]string, 0, len(req.FriendRequestsSent))
	for _, id := range req.FriendRequestsSent {
		if id == userID {
			continue
		}
		newSent = append(newSent, id)
	}
	req.FriendRequestsSent = newSent

	// Add friends
	user.Friends = append(user.Friends, requesterID)
	req.Friends = append(req.Friends, userID)
	user.UpdatedAt = time.Now()
	req.UpdatedAt = time.Now()
	users[user.ID] = user
	users[req.ID] = req
	return fs.userService.saveMockUsers(users)
}

func (fs *FriendsService) rejectFriendRequestMock(userID, requesterID string) error {
	users, err := fs.userService.loadMockUsers()
	if err != nil {
		return err
	}
	user, ok := users[userID]
	if !ok {
		return errors.New("user not found")
	}
	req, ok := users[requesterID]
	if !ok {
		return errors.New("requester not found")
	}

	// Remove from received
	newRecv := make([]string, 0, len(user.FriendRequestsReceived))
	for _, id := range user.FriendRequestsReceived {
		if id == requesterID {
			continue
		}
		newRecv = append(newRecv, id)
	}
	user.FriendRequestsReceived = newRecv

	// Remove from requester's sent
	newSent := make([]string, 0, len(req.FriendRequestsSent))
	for _, id := range req.FriendRequestsSent {
		if id == userID {
			continue
		}
		newSent = append(newSent, id)
	}
	req.FriendRequestsSent = newSent

	user.UpdatedAt = time.Now()
	req.UpdatedAt = time.Now()
	users[user.ID] = user
	users[req.ID] = req
	return fs.userService.saveMockUsers(users)
}

func (fs *FriendsService) removeFriendMock(userID, friendID string) error {
	users, err := fs.userService.loadMockUsers()
	if err != nil {
		return err
	}
	u, ok := users[userID]
	if !ok {
		return errors.New("user not found")
	}
	f, ok := users[friendID]
	if !ok {
		return errors.New("friend not found")
	}

	// Remove from both lists
	filter := func(list []string, id string) []string {
		out := make([]string, 0, len(list))
		for _, v := range list {
			if v != id {
				out = append(out, v)
			}
		}
		return out
	}
	u.Friends = filter(u.Friends, friendID)
	f.Friends = filter(f.Friends, userID)
	u.UpdatedAt = time.Now()
	f.UpdatedAt = time.Now()
	users[u.ID] = u
	users[f.ID] = f
	return fs.userService.saveMockUsers(users)
}

func (fs *FriendsService) listFriendsMock(userID string) ([]models.PublicUser, error) {
	users, err := fs.userService.loadMockUsers()
	if err != nil {
		return nil, err
	}
	u, ok := users[userID]
	if !ok {
		return nil, errors.New("user not found")
	}
	res := make([]models.PublicUser, 0, len(u.Friends))
	for _, fid := range u.Friends {
		if friend, ok := users[fid]; ok {
			res = append(res, models.PublicUser{ID: friend.ID, Nickname: friend.Nickname})
		}
	}
	sort.Slice(res, func(i, j int) bool { return res[i].Nickname < res[j].Nickname })
	return res, nil
}

func (fs *FriendsService) listFriendRequestsMock(userID string) (*FriendRequests, error) {
	users, err := fs.userService.loadMockUsers()
	if err != nil {
		return nil, err
	}
	u, ok := users[userID]
	if !ok {
		return nil, errors.New("user not found")
	}
	fr := &FriendRequests{Received: []models.PublicUser{}, Sent: []models.PublicUser{}}
	for _, rid := range u.FriendRequestsReceived {
		if ru, ok := users[rid]; ok {
			fr.Received = append(fr.Received, models.PublicUser{ID: ru.ID, Nickname: ru.Nickname})
		}
	}
	for _, sid := range u.FriendRequestsSent {
		if su, ok := users[sid]; ok {
			fr.Sent = append(fr.Sent, models.PublicUser{ID: su.ID, Nickname: su.Nickname})
		}
	}
	sort.Slice(fr.Received, func(i, j int) bool { return fr.Received[i].Nickname < fr.Received[j].Nickname })
	sort.Slice(fr.Sent, func(i, j int) bool { return fr.Sent[i].Nickname < fr.Sent[j].Nickname })
	return fr, nil
}
