import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PORT = 3001;
const TOKEN = process.env.EXPO_PUBLIC_BOOTSTRAP_TOKEN || 'binhaj-dev-token';

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

async function request<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...rest,
    headers: {
      'x-marble-token': TOKEN,
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `API ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const apiFetch = <T,>(path: string) => request<T>(path);

export const apiPost = <T,>(path: string, json: unknown) =>
  request<T>(path, { method: 'POST', json });

export const apiPut = <T,>(path: string, json?: unknown) =>
  request<T>(path, { method: 'PUT', json: json ?? {} });

export const apiDelete = <T,>(path: string) =>
  request<T>(path, { method: 'DELETE' });

export async function apiUploadImage(uri: string): Promise<{ url: string }> {
  const name = uri.split('/').pop() || `photo-${Date.now()}.jpg`;
  const match = /\.(\w+)$/.exec(name);
  const type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';

  const form = new FormData();
  form.append('file', { uri, name, type } as unknown as Blob);

  const res = await fetch(`${getApiBaseUrl()}/uploads`, {
    method: 'POST',
    headers: { 'x-marble-token': TOKEN },
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return res.json() as Promise<{ url: string }>;
}

export function assetUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${getApiBaseUrl()}${url}`;
}
