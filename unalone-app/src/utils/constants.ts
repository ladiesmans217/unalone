// App-wide constants and configuration
import { NativeModules, Platform } from 'react-native';
// Lazy import to avoid hard dependency if not available
let ExpoConstants: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ExpoConstants = require('expo-constants').default;
} catch {}

// Resolve an API base URL that works on real devices
// Priority: EXPO_PUBLIC_API_BASE_URL env > Metro host IP on device > Expo hostUri/debuggerHost > localhost (web/desktop)
const resolveApiBaseUrl = (): string => {
  const envBase = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envBase && typeof envBase === 'string' && envBase.trim().length > 0) {
    return envBase.trim();
  }

  // On native, infer PC LAN IP from the Metro bundle URL (scriptURL)
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    try {
      const scriptURL: string | undefined = (NativeModules as any)?.SourceCode?.scriptURL;
      if (scriptURL) {
        // Only accept IPv4 addresses to avoid tunnel hosts like exp.host
        const match = scriptURL.match(/^https?:\/\/([\d.]+):\d+/);
        if (match && match[1]) {
          const host = match[1];
          return `http://${host}:8080/api/v1`;
        }
      }
    } catch {
      // fall through to localhost
    }

    // Try Expo hostUri (LAN) or manifest debuggerHost
    try {
      const hostUri: string | undefined = ExpoConstants?.expoConfig?.hostUri || (ExpoConstants as any)?.hostUri;
      const dbgHost: string | undefined = (ExpoConstants as any)?.manifest?.debuggerHost;
      const m2HostUri: string | undefined = (ExpoConstants as any)?.manifest2?.extra?.expoClient?.hostUri;
      const linkingUri: string | undefined = (ExpoConstants as any)?.linkingUri;

      const sources = [hostUri, dbgHost, m2HostUri, linkingUri].filter(Boolean) as string[];
      for (const src of sources) {
        // Extract IPv4 from patterns like 192.168.x.x:port or http(s)://192.168.x.x:port
        const m = src.match(/(?:https?:\/\/)?([\d.]+):\d+/);
        if (m && m[1]) {
          return `http://${m[1]}:8080/api/v1`;
        }
      }
    } catch {}
  }

  // Fallback for web or when Metro host couldn't be determined
  const fallback = 'http://localhost:8080/api/v1';
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    // Helpful warning in dev if we couldn't detect LAN IP
    // On real devices, localhost will not work – set EXPO_PUBLIC_API_BASE_URL
    // to something like http://192.168.x.x:8080/api/v1 and restart Expo.
    // This runs only at import time.
    // eslint-disable-next-line no-console
    console.warn('[APP_CONFIG] API base URL fallback to localhost on device. Set EXPO_PUBLIC_API_BASE_URL to your LAN API, e.g. http://192.168.x.x:8080/api/v1');
  }
  return fallback;
};

export const APP_CONFIG = {
  // API Configuration
  API_BASE_URL: resolveApiBaseUrl(),
  
  // Storage keys for AsyncStorage
  STORAGE_KEYS: {
    AUTH_TOKEN: '@unalone_auth_token',
    USER_DATA: '@unalone_user_data',
    ONBOARDING_COMPLETED: '@unalone_onboarding',
  },

  // App Settings
  SETTINGS: {
    DEFAULT_LOCATION_RADIUS: 5000, // 5km in meters
    CHAT_MESSAGE_LIMIT: 50,
    MOOD_TRACKER_DAYS: 30,
  },

  // Colors (basic theme)
  COLORS: {
    PRIMARY: '#6366f1',
    SECONDARY: '#8b5cf6',
    SUCCESS: '#10b981',
    WARNING: '#f59e0b',
    ERROR: '#ef4444',
    BACKGROUND: '#f8fafc',
    BACKGROUND_LIGHT: '#f0f0f0',
    SURFACE: '#ffffff',
    TEXT_PRIMARY: '#1f2937',
    TEXT_SECONDARY: '#6b7280',
  },
};

// Backwards-compatible color map used across screens
// Many screens import APP_COLORS with camelCase keys like `textSecondary`.
export const APP_COLORS = {
  // Core brand colors
  primary: APP_CONFIG.COLORS.PRIMARY,
  accent: APP_CONFIG.COLORS.SECONDARY,
  success: APP_CONFIG.COLORS.SUCCESS,
  warning: APP_CONFIG.COLORS.WARNING,
  error: APP_CONFIG.COLORS.ERROR,

  // Surfaces / backgrounds
  background: APP_CONFIG.COLORS.BACKGROUND,
  surface: APP_CONFIG.COLORS.SURFACE,
  lightGray: '#e5e7eb', // utility gray for chips, dividers, etc.
  border: '#e5e7eb',

  // Text
  textPrimary: APP_CONFIG.COLORS.TEXT_PRIMARY,
  textSecondary: APP_CONFIG.COLORS.TEXT_SECONDARY,
};
