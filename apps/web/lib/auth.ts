const TOKEN_KEY = 'marble_auth_token';
const PLATFORM_TOKEN_KEY = 'marble_platform_token';
const ACTIVITY_KEY = 'marble_session_activity';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
}

export function clearAuthToken() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(PLATFORM_TOKEN_KEY);
  window.localStorage.removeItem(ACTIVITY_KEY);
}

export function beginReadOnlyWorkspace(token: string) {
  const current = getAuthToken();
  if (current) window.localStorage.setItem(PLATFORM_TOKEN_KEY, current);
  setAuthToken(token);
}

export function restorePlatformWorkspace() {
  const token = window.localStorage.getItem(PLATFORM_TOKEN_KEY);
  if (!token) return false;
  window.localStorage.removeItem(PLATFORM_TOKEN_KEY);
  setAuthToken(token);
  return true;
}

export function isAuthenticated() {
  return Boolean(getAuthToken());
}
