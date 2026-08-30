import * as SecureStore from 'expo-secure-store';
import { clearOfflineStore } from './offline/db';

const TOKEN_KEY = 'marble_auth_token';
const KIND_KEY = 'marble_session_kind';
const ACTIVITY_KEY = 'marble_session_activity';
const PLATFORM_TOKEN_KEY = 'marble_platform_token';

export type SessionKind = 'company' | 'platform';

let memoryToken: string | null | undefined;
let memoryKind: SessionKind | null | undefined;

export async function getAuthToken(): Promise<string | null> {
  if (memoryToken !== undefined) return memoryToken;
  try {
    memoryToken = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    memoryToken = null;
  }
  return memoryToken;
}

export async function setAuthToken(token: string) {
  memoryToken = token;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await markSessionActivity();
}

export async function getSessionKind(): Promise<SessionKind | null> {
  if (memoryKind !== undefined) return memoryKind;
  try {
    const value = await SecureStore.getItemAsync(KIND_KEY);
    memoryKind =
      value === 'company' || value === 'platform' ? value : null;
  } catch {
    memoryKind = null;
  }
  return memoryKind;
}

export async function setSessionKind(kind: SessionKind) {
  memoryKind = kind;
  await SecureStore.setItemAsync(KIND_KEY, kind);
}

export async function clearAuthToken() {
  memoryToken = null;
  memoryKind = null;
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // ignore
  }
  try {
    await SecureStore.deleteItemAsync(KIND_KEY);
  } catch {
    // ignore
  }
  try {
    await SecureStore.deleteItemAsync(ACTIVITY_KEY);
  } catch {
    // ignore
  }
  try {
    await SecureStore.deleteItemAsync(PLATFORM_TOKEN_KEY);
  } catch {
    // ignore
  }
  await clearOfflineStore().catch(() => undefined);
}

export async function beginReadOnlyWorkspace(token: string) {
  const current = await getAuthToken();
  if (current) await SecureStore.setItemAsync(PLATFORM_TOKEN_KEY, current);
  await setAuthToken(token);
  await setSessionKind('company');
  await clearOfflineStore().catch(() => undefined);
}

export async function restorePlatformWorkspace() {
  let token: string | null = null;
  try {
    token = await SecureStore.getItemAsync(PLATFORM_TOKEN_KEY);
    await SecureStore.deleteItemAsync(PLATFORM_TOKEN_KEY);
  } catch {
    token = null;
  }
  if (!token) return false;
  await clearOfflineStore().catch(() => undefined);
  await setAuthToken(token);
  await setSessionKind('platform');
  return true;
}

export function peekAuthToken() {
  return memoryToken ?? null;
}

export async function markSessionActivity() {
  try {
    await SecureStore.setItemAsync(ACTIVITY_KEY, String(Date.now()));
  } catch {
    // ignore storage failures; the server remains authoritative
  }
}

export async function getLastSessionActivity() {
  try {
    const value = await SecureStore.getItemAsync(ACTIVITY_KEY);
    const timestamp = Number(value);
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
  } catch {
    return Date.now();
  }
}
