import { API_URL } from './apiBase';
import { clearAuthToken, getAuthToken } from './auth';

export { API_URL } from './apiBase';

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { 'x-marble-token': token } : {};
}

function isAuthExemptPath(path: string) {
  return (
    path === '/auth/login' ||
    path === '/auth/admin/login' ||
    path.startsWith('/public/')
  );
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  clearAuthToken();
  const isAdminPath = window.location.pathname.startsWith('/admin');
  const target = isAdminPath ? '/admin/login' : '/login';
  if (window.location.pathname !== target) {
    window.location.href = target;
  }
}

function errorCode(detail: string) {
  try {
    const parsed = JSON.parse(detail) as { code?: string; message?: { code?: string } };
    return parsed.code ?? parsed.message?.code ?? null;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const skipAuth = isAuthExemptPath(path);
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      ...(skipAuth ? {} : authHeaders()),
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: 'no-store',
  });
  if ((res.status === 401 || res.status === 403) && !skipAuth) {
    const detail = await res.text().catch(() => '');
    if (errorCode(detail) === 'PASSWORD_CHANGE_REQUIRED') {
      if (typeof window !== 'undefined') window.location.href = '/change-password';
      throw new Error('');
    }
    if (
      res.status === 401 ||
      errorCode(detail) === 'SESSION_EXPIRED' ||
      errorCode(detail) === 'SUBSCRIPTION_INACTIVE'
    ) {
      redirectToLogin();
      throw new Error(
        errorCode(detail) === 'SUBSCRIPTION_INACTIVE'
          ? 'Your trial or subscription has expired.'
          : 'Session expired. Please sign in again.',
      );
    }
    throw new Error(detail || `API ${res.status} for ${path}`);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    let message = detail || `API ${res.status} for ${path}`;
    try {
      const parsed = JSON.parse(detail) as { message?: string | string[] };
      if (typeof parsed.message === 'string') message = parsed.message;
      else if (Array.isArray(parsed.message)) message = parsed.message.join(', ');
    } catch {
      // keep raw text
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const apiFetch = <T,>(path: string) => request<T>(path);

export const apiPost = <T,>(path: string, json: unknown) =>
  request<T>(path, { method: 'POST', json });

export const apiPut = <T,>(path: string, json?: unknown) =>
  request<T>(path, { method: 'PUT', json: json ?? {} });

export const apiPatch = <T,>(path: string, json: unknown) =>
  request<T>(path, { method: 'PATCH', json });

export const apiDelete = <T,>(path: string) =>
  request<T>(path, { method: 'DELETE' });

export async function apiUpload(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/uploads`, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: form,
  });
  if (res.status === 401) {
    redirectToLogin();
    throw new Error('Session expired. Please sign in again.');
  }
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return res.json() as Promise<{ url: string }>;
}

export function assetUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
}

/**
 * Fetches a PDF with the session header and opens it from a blob URL.
 */
export async function openPdf(path: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) {
    redirectToLogin();
    throw new Error('Session expired. Please sign in again.');
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `Could not generate the document (${res.status})`);
  }

  const url = URL.createObjectURL(await res.blob());
  const opened = window.open(url, '_blank');
  if (!opened) {
    const link = document.createElement('a');
    link.href = url;
    link.download = path.split('/').pop() ?? 'document.pdf';
    link.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
      companyRole?: 'admin' | 'member';
      features?: string[];
      unreadNotifications?: number;
      mustChangePassword?: boolean;
    };
  }>('/auth/login', { method: 'POST', json: input });
}

export async function apiChangePassword(password: string) {
  return request<{
    token: string;
    session: {
      companyId: string;
      userId: string;
      email: string;
      companyName: string;
      companyRole?: 'admin' | 'member';
      mustChangePassword?: boolean;
    };
  }>('/auth/change-password', { method: 'POST', json: { password } });
}

export async function apiAdminLogin(input: {
  email: string;
  password: string;
}) {
  return request<{
    token: string;
    session: {
      kind: 'platform';
      adminId: string;
      email: string;
      name: string;
    };
  }>('/auth/admin/login', { method: 'POST', json: input });
}
