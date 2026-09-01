import * as SecureStore from 'expo-secure-store';

export type RememberLoginKind = 'company' | 'platform';

type RememberedLogin = {
  email: string;
  password: string;
};

const KEY: Record<RememberLoginKind, string> = {
  company: 'marble_remember_company_login',
  platform: 'marble_remember_platform_login',
};

export async function loadRememberedLogin(
  kind: RememberLoginKind,
): Promise<RememberedLogin | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY[kind]);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RememberedLogin;
    if (!parsed.email || !parsed.password) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveRememberedLogin(
  kind: RememberLoginKind,
  email: string,
  password: string,
) {
  await SecureStore.setItemAsync(
    KEY[kind],
    JSON.stringify({ email, password }),
  );
}

export async function clearRememberedLogin(kind: RememberLoginKind) {
  try {
    await SecureStore.deleteItemAsync(KEY[kind]);
  } catch {
    // ignore
  }
}
