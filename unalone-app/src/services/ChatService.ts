// Chat service for hotspot chat rooms
import { APP_CONFIG } from '../utils/constants';
import { ChatMessage } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

class ChatService {
  private ws: WebSocket | null = null;
  private listeners: Set<(msg: ChatMessage) => void> = new Set();

  async getRecentMessages(hotspotId: string): Promise<ChatMessage[]> {
    const base = APP_CONFIG.API_BASE_URL;
    const url = `${base}/hotspots/${hotspotId}/chat/messages`;
    const token = await AsyncStorage.getItem(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.message || 'Failed to load messages');
    const data: any[] = body.data || [];
    return data.map(this.normalizeMessage);
  }

  // Connect to hotspot WS; returns an unsubscribe fn
  async connect(hotspotId: string, onMessage: (msg: ChatMessage) => void): Promise<() => void> {
    const baseHttp = APP_CONFIG.API_BASE_URL; // e.g., http://host:8080/api/v1
    // Convert http(s) -> ws(s)
    const wsBase = baseHttp.replace(/^http/, 'ws');
    const token = await AsyncStorage.getItem(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    const sep = wsBase.endsWith('/') ? '' : '';
    const url = `${wsBase}/hotspots/${hotspotId}/chat/ws?token=${encodeURIComponent(token || '')}`;
    this.ws = new WebSocket(url);
    this.listeners.add(onMessage);

    this.ws.onmessage = (ev) => {
      try {
        const raw = JSON.parse((ev as any).data);
        const msg = this.normalizeMessage(raw);
        this.listeners.forEach((fn) => fn(msg));
      } catch {}
    };

    // No-op handlers for now
    this.ws.onopen = () => {};
    this.ws.onerror = () => {};
    this.ws.onclose = () => {};

    return () => {
      this.listeners.delete(onMessage);
      if (this.listeners.size === 0) {
        this.ws?.close();
        this.ws = null;
      }
    };
  }

  send(content: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ content }));
  }

  private normalizeMessage = (raw: any): ChatMessage => ({
    id: raw.id,
    hotspotId: raw.hotspot_id ?? raw.hotspotId,
    userId: raw.user_id ?? raw.userId,
    nickname: raw.nickname,
    content: raw.content,
    createdAt: raw.created_at ?? raw.createdAt,
  });
}

export const chatService = new ChatService();
