export type RememberLoginKind = 'company' | 'platform';

type RememberedLogin = {
  email: string;
  password: string;
};

const KEY: Record<RememberLoginKind, string> = {
  company: 'marble_remember_company_login',
  platform: 'marble_remember_platform_login',
};

export function loadRememberedLogin(kind: RememberLoginKind): RememberedLogin | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY[kind]);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RememberedLogin;
    if (!parsed.email || !parsed.password) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveRememberedLogin(
  kind: RememberLoginKind,
  email: string,
  password: string,
) {
  window.localStorage.setItem(
    KEY[kind],
    JSON.stringify({ email, password }),
  );
}

export function clearRememberedLogin(kind: RememberLoginKind) {
  window.localStorage.removeItem(KEY[kind]);
}
