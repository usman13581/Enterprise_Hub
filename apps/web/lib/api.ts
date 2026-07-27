export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:3001';

export const BOOTSTRAP_TOKEN =
  process.env.NEXT_PUBLIC_BOOTSTRAP_TOKEN || 'binhaj-dev-token';

async function request<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'x-marble-token': BOOTSTRAP_TOKEN,
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: 'no-store',
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `API ${res.status} for ${path}`);
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

export async function apiUpload(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/uploads`, {
    method: 'POST',
    headers: { 'x-marble-token': BOOTSTRAP_TOKEN },
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return res.json() as Promise<{ url: string }>;
}

export function assetUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
}
