export type SessionKind = 'company' | 'platform';

/**
 * Flat session shape so Nest handlers can read companyId/userId after
 * BootstrapAuthGuard without narrowing everywhere. Discriminate on `kind`.
 * Unused fields for the other kind are empty placeholders.
 */
export type SessionContext = {
  kind: SessionKind;
  sessionId?: string;
  email: string;
  companyId: string;
  userId: string;
  companyName: string;
  companyRole: 'admin' | 'member';
  features: string[];
  unreadNotifications?: number;
  mustChangePassword?: boolean;
  readOnly?: boolean;
  actingAdminId?: string;
  adminId: string;
  name: string;
};

export type CompanySessionContext = SessionContext & { kind: 'company' };
export type PlatformSessionContext = SessionContext & { kind: 'platform' };

export const SESSION_HEADER = 'x-marble-token';

export function isCompanySession(
  session: SessionContext,
): session is CompanySessionContext {
  return session.kind === 'company';
}

export function isPlatformSession(
  session: SessionContext,
): session is PlatformSessionContext {
  return session.kind === 'platform';
}

/** Narrow after BootstrapAuthGuard / CompanyAdminGuard. */
export function requireCompanySession(
  session: SessionContext,
): CompanySessionContext {
  if (!isCompanySession(session)) {
    throw new Error('Company session required');
  }
  return session;
}

export function requirePlatformSession(
  session: SessionContext,
): PlatformSessionContext {
  if (!isPlatformSession(session)) {
    throw new Error('Platform session required');
  }
  return session;
}
