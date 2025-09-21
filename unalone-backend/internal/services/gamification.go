// Gamification service for awarding points and levels
package services

import (
	"errors"
	"time"
)

type GamificationService struct {
	firestoreService *FirestoreService
	userService      *UserService
}

func NewGamificationService(fs *FirestoreService, us *UserService) *GamificationService {
	return &GamificationService{firestoreService: fs, userService: us}
}

// Level curve: simple step every 100 points for now (L = floor(P/100) + 1)
func (gs *GamificationService) computeLevel(points int) int {
	if points < 0 {
		points = 0
	}
	return (points / 100) + 1
}

// AwardPoints to a user; returns new points and level
func (gs *GamificationService) AwardPoints(userID string, delta int, reason string) (int, int, error) {
	if gs.isTestMode() {
		return gs.awardPointsMock(userID, delta)
	}
	return 0, 0, errors.New("firestore implementation needed")
}

// Convenience wrappers for common actions
func (gs *GamificationService) AwardForFriendship(userID string) (int, int, error) {
	// 50 points for making a friend
	return gs.AwardPoints(userID, 50, "friendship")
}

func (gs *GamificationService) AwardForHotspotJoin(userID string) (int, int, error) {
	// 20 points for joining an event/hotspot
	return gs.AwardPoints(userID, 20, "hotspot_join")
}

func (gs *GamificationService) isTestMode() bool { return gs.firestoreService.client == nil }

// Mock path: update points and level in users.json via UserService
func (gs *GamificationService) awardPointsMock(userID string, delta int) (int, int, error) {
	users, err := gs.userService.loadMockUsers()
	if err != nil {
		return 0, 0, err
	}
	u, ok := users[userID]
	if !ok {
		return 0, 0, errors.New("user not found")
	}
	u.Points += delta
	if u.Points < 0 {
		u.Points = 0
	}
	u.Level = gs.computeLevel(u.Points)
	u.UpdatedAt = time.Now()
	users[u.ID] = u
	if err := gs.userService.saveMockUsers(users); err != nil {
		return 0, 0, err
	}
	return u.Points, u.Level, nil
}
