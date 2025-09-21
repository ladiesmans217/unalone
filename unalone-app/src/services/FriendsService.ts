import { apiService } from './ApiService';
import { ApiResponse, FriendRequests, PublicUser } from '../types';

class FriendsService {
  async listFriends(): Promise<PublicUser[]> {
    const res = await apiService.get<PublicUser[]>('/friends/');
    if (!res.success) throw new Error(res.message);
    return res.data || [];
  }

  async listRequests(): Promise<FriendRequests> {
    const res = await apiService.get<FriendRequests>('/friends/requests');
    if (!res.success) throw new Error(res.message);
    return res.data as FriendRequests;
  }

  async sendRequest(target: string): Promise<void> {
    const res = await apiService.post<null>('/friends/requests', { target });
    if (!res.success) throw new Error(res.message);
  }

  async accept(user_id: string): Promise<void> {
    const res = await apiService.post<null>('/friends/accept', { user_id });
    if (!res.success) throw new Error(res.message);
  }

  async reject(user_id: string): Promise<void> {
    const res = await apiService.post<null>('/friends/reject', { user_id });
    if (!res.success) throw new Error(res.message);
  }

  async remove(user_id: string): Promise<void> {
    const res = await apiService.post<null>('/friends/remove', { user_id });
    if (!res.success) throw new Error(res.message);
  }
}

export const friendsService = new FriendsService();
