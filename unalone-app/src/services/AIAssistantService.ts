import { apiService } from './ApiService';
import { AIChatSession, AIMessage, ApiResponse } from '../types';

class AIAssistantService {
  async listSessions(): Promise<ApiResponse<AIChatSession[]>> {
    return apiService.get<AIChatSession[]>('/ai/sessions');
  }

  async createSession(title?: string): Promise<ApiResponse<AIChatSession>> {
    return apiService.post<AIChatSession>('/ai/sessions', { title });
  }

  async getMessages(sessionId: string, limit = 50): Promise<ApiResponse<AIMessage[]>> {
    return apiService.get<AIMessage[]>(`/ai/sessions/${sessionId}/messages?limit=${limit}`);
  }

  async sendMessage(sessionId: string, content: string): Promise<ApiResponse<{ user: AIMessage; ai: AIMessage }>> {
    return apiService.post<{ user: AIMessage; ai: AIMessage }>(`/ai/sessions/${sessionId}/messages`, { content });
  }
}

export const aiAssistantService = new AIAssistantService();
