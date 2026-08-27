import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'marble_auth_token';
const KIND_KEY = 'marble_session_kind';

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
}

export function peekAuthToken() {
  return memoryToken ?? null;
}
