# Upcoming: Session management

**Scope:** web and mobile use the same session rules and API behavior, with
platform-appropriate activity detection.

## Default policy

- Idle timeout: **30 minutes** without user activity.
- Warning: show a warning **2 minutes before** expiry with a “Stay signed in”
  action.
- Absolute session lifetime: retain the existing JWT lifetime of **7 days**,
  subject to the idle timeout.
- Sign out immediately when the user chooses Sign out, the session expires, or
  the server rejects the session.
- Do not expose session timestamps, tokens, or security details in the UI.

The 30-minute default is appropriate for a business application handling
quotations, invoices, customer information, and payment documents. The timeout
should be configurable by environment or policy later, without changing the
client contract.

## Shared API behavior

- Add a server-enforced session/last-activity mechanism; a client-only timer is
  not sufficient if a token is copied or an old tab remains open.
- Refresh `lastActivityAt` on authenticated requests with throttling to avoid a
  database write on every request.
- Reject idle or absolutely expired sessions with HTTP 401 and a stable error
  code.
- Keep company and platform-admin sessions isolated and apply the same idle
  rules to both.
- Re-check company suspension, subscription status, and user access on every
  authenticated request.
- Keep logout idempotent and revoke/invalidate the server session where
  applicable.

Primary files:

- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/bootstrap-auth.guard.ts`
- `apps/api/src/auth/platform-admin.guard.ts`
- `apps/api/src/auth/session.types.ts`
- `apps/api/prisma/schema.prisma`

## Web behavior

- Track meaningful activity such as pointer, keyboard, touch, and navigation
  events; throttle activity updates.
- Coordinate activity and logout across browser tabs using a shared browser
  event mechanism.
- Pause high-frequency timers while the tab is hidden and calculate expiry from
  timestamps when it becomes visible again.
- Show the warning dialog without interrupting unsaved form work.
- Redirect to the correct company or platform login page after expiry.

Primary files:

- `apps/web/components/RootChrome.tsx`
- `apps/web/components/AppShell.tsx`
- `apps/web/components/AdminShell.tsx`
- `apps/web/lib/auth.ts`
- `apps/web/lib/api.ts`

## Mobile behavior

- Track activity through navigation, touch interaction, and active screen
  changes.
- Use React Native `AppState` to calculate elapsed time when the app returns
  from the background; do not rely on a timer continuing while suspended.
- Persist only the last-activity timestamp and session metadata needed to
  enforce expiry; keep tokens in secure storage.
- On expiry, clear the token and route company users to company login or
  platform users to platform-admin login.
- If offline, enforce the local timeout and complete server validation on
  reconnect. Do not silently restore an expired session.
- Preserve or clearly discard queued offline work according to the existing
  sync policy, and never sync after authentication has expired.

Primary files:

- `apps/mobile/app/_layout.tsx`
- `apps/mobile/lib/auth.ts`
- `apps/mobile/lib/api.ts`
- `apps/mobile/lib/offline/syncEngine.ts`

## Security and UX acceptance criteria

- An inactive session cannot access protected API routes after 30 minutes.
- Activity in one web tab extends the session consistently in other tabs.
- Backgrounding the mobile app for longer than the timeout logs the user out
  when it is reopened.
- The warning appears once, can extend the session, and is accessible on small
  screens.
- Expired sessions clear local credentials and never loop between protected
  routes and login.
- Company and platform users are redirected to the correct login surface.
- Active users are not logged out during normal navigation, slow API calls, or
  short background transitions.
- Tests cover idle expiry, warning/renewal, absolute expiry, tab coordination,
  app background/resume, offline/reconnect, and unauthorized API responses.
