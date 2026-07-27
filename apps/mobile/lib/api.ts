import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { listEntities, getEntity, upsertEntity } from './offline/db';
import { isOnline } from './offline/net';
import {
  PATH_COLLECTION,
  queueProductImage,
  queueRestMutation,
} from './offline/syncEngine';

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

async function cacheListFromPath<T>(path: string): Promise<T[] | null> {
  const base = path.split('?')[0];
  const collection = PATH_COLLECTION[base];
  if (!collection) return null;
  if (collection === 'profile') {
    const profile = await getEntity<T>('profile', 'profile');
    return profile ? [profile] : [];
  }
  return listEntities<T>(collection);
}

async function rememberList(path: string, data: unknown) {
  const base = path.split('?')[0];
  const collection = PATH_COLLECTION[base];
  if (!collection || !Array.isArray(data)) return;
  const now = new Date().toISOString();
  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id : null;
    if (!id) continue;
    const updatedAt =
      typeof record.updatedAt === 'string' ? record.updatedAt : now;
    await upsertEntity(collection, id, updatedAt, record);
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const method = (rest.method ?? 'GET').toUpperCase();

  try {
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
    const data = (await res.json()) as T;
    if (method === 'GET') {
      void rememberList(path, data).catch(() => undefined);
    }
    return data;
  } catch (error) {
    if (method === 'GET') {
      const cached = await cacheListFromPath(path);
      if (cached) {
        return cached as T;
      }
      const match = path.match(
        /^\/(customers|suppliers|products|quotations|jobs|invoices|advances)\/([^/]+)(?:\/.*)?$/,
      );
      if (match) {
        const collection = match[1];
        const id = match[2];
        const row = await getEntity(collection, id);
        if (row) return row as T;
      }
    }

    if (method !== 'GET' && !(await isOnline())) {
      await queueRestMutation({ method, path, body: json });
      return {
        queued: true,
        message: 'Saved offline — will sync when online',
      } as T;
    }

    throw error;
  }
}

export const apiFetch = <T,>(path: string) => request<T>(path);

export const apiPost = <T,>(path: string, json: unknown) =>
  request<T>(path, { method: 'POST', json });

export const apiPut = <T,>(path: string, json?: unknown) =>
  request<T>(path, { method: 'PUT', json: json ?? {} });

export const apiDelete = <T,>(path: string) =>
  request<T>(path, { method: 'DELETE' });

export async function apiUploadImage(uri: string): Promise<{ url: string }> {
  if (!(await isOnline())) {
    await queueProductImage(uri, '');
    return { url: uri };
  }

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
  if (url.startsWith('http') || url.startsWith('file:')) return url;
  return `${getApiBaseUrl()}${url}`;
}
