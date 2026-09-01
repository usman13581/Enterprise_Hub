import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PORT = 3001;

function lanApiBaseUrl(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (typeof hostUri === 'string' && hostUri.length > 0) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost') {
      return `http://${host}:${PORT}`;
    }
  }
  return null;
}

function fallbackApiBaseUrl() {
  if (Platform.OS === 'android') return `http://10.0.2.2:${PORT}`;
  return `http://localhost:${PORT}`;
}

/**
 * Resolve the Nest API base URL the same way for REST calls and offline sync.
 * On a physical phone, `localhost` is the phone itself — use the Metro LAN host.
 *
 * In Expo dev, prefer the LAN API on port 3001 unless
 * EXPO_PUBLIC_USE_PRODUCTION_API=1. This avoids stale production deploys
 * missing newer modules such as HR while developing locally.
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  const useProductionInDev =
    process.env.EXPO_PUBLIC_USE_PRODUCTION_API === '1';

  if (__DEV__ && !useProductionInDev) {
    return lanApiBaseUrl() ?? fallbackApiBaseUrl();
  }

  if (fromEnv) return fromEnv;
  return lanApiBaseUrl() ?? fallbackApiBaseUrl();
}
