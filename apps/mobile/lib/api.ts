import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getApiBaseUrl } from './apiBase';
import { clearAuthToken, getAuthToken } from './auth';
import { listEntities, getEntity, upsertEntity } from './offline/db';
import { isOnline } from './offline/net';
import {
  PATH_COLLECTION,
  queueImageUpload,
  queueRestMutation,
} from './offline/syncEngine';
import { prepareUploadImage } from './prepareUploadImage';

export { getApiBaseUrl } from './apiBase';

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

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return token ? { 'x-marble-token': token } : {};
}

function parseApiError(detail: string, fallback: string) {
  try {
    const parsed = JSON.parse(detail) as { message?: string | string[] };
    if (typeof parsed.message === 'string') return parsed.message;
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
  } catch {
    // keep raw
  }
  return detail || fallback;
}

async function request<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const method = (rest.method ?? 'GET').toUpperCase();
  const isLogin = path === '/auth/login';

  try {
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      ...rest,
      headers: {
        ...(isLogin ? {} : await authHeaders()),
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(rest.headers ?? {}),
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
    if (res.status === 401 && !isLogin) {
      await clearAuthToken();
      throw new Error('Session expired. Please sign in again.');
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(parseApiError(detail, `API ${res.status}`));
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

    if (method !== 'GET' && path !== '/auth/login' && !(await isOnline())) {
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

export async function apiUploadImage(
  uri: string,
  options?: {
    productId?: string;
    purpose?: 'product' | 'logo' | 'signature';
  },
): Promise<{ url: string; queued?: boolean }> {
  const purpose =
    options?.purpose ?? (options?.productId ? 'product' : undefined);

  if (!(await isOnline())) {
    // Product photos can wait in the offline image queue (attached on sync).
    // Logo/signature must upload now — company profile cannot store file:// URLs.
    if (purpose === 'product' && options?.productId) {
      await queueImageUpload(uri, {
        productId: options.productId,
        purpose: 'product',
      });
      return { url: uri, queued: true };
    }
    throw new Error('Photo upload needs a network connection');
  }

  const prepared = await prepareUploadImage(uri);
  const form = new FormData();
  form.append('file', {
    uri: prepared.uri,
    name: prepared.name,
    type: prepared.type,
  } as unknown as Blob);

  const res = await fetch(`${getApiBaseUrl()}/uploads`, {
    method: 'POST',
    headers: { ...(await authHeaders()) },
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

/**
 * Downloads a PDF with the session header, then opens the iOS/Android print
 * dialog. Falls back to the share sheet if print is cancelled or unavailable.
 */
export async function openPdf(path: string): Promise<void> {
  if (!(await isOnline())) {
    throw new Error('Printing needs a network connection');
  }

  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: { ...(await authHeaders()) },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      detail || `Could not generate the document (${res.status})`,
    );
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  const filename = path.split('/').pop() ?? `document-${Date.now()}.pdf`;
  const file = new File(Paths.cache, filename);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(bytes);

  try {
    await Print.printAsync({ uri: file.uri });
    return;
  } catch {
    // User closed the print sheet, or the device has no printer UI — share instead.
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: filename,
    });
    return;
  }

  throw new Error('Printing and sharing are unavailable on this device');
}

export async function apiLogin(input: {
  email: string;
  password: string;
  companySlug?: string;
}) {
  return request<{
    token: string;
    session: {
      companyId: string;
      userId: string;
      email: string;
      companyName: string;
    };
  }>('/auth/login', { method: 'POST', json: input });
}
