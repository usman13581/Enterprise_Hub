import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PORT = 3001;

/**
 * Resolve the Nest API base URL the same way for REST calls and offline sync.
 * On a physical phone, `localhost` is the phone itself — use the Metro LAN host.
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  const hostUri = Constants.expoConfig?.hostUri;
  if (typeof hostUri === 'string' && hostUri.length > 0) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost') {
      return `http://${host}:${PORT}`;
    }
  }

  if (Platform.OS === 'android') return `http://10.0.2.2:${PORT}`;
  return `http://localhost:${PORT}`;
}
