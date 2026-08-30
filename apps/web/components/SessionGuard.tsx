'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch, apiPost } from '@/lib/api';
import { clearAuthToken, getAuthToken } from '@/lib/auth';

const IDLE_MS = 30 * 60 * 1000;
const WARNING_MS = 2 * 60 * 1000;
const ACTIVITY_KEY = 'marble_session_activity';
const EVENT_KEY = 'marble_session_event';

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [warning, setWarning] = useState(false);
  const lastActivity = useRef(0);
  const lastPing = useRef(0);
  const isPublic = pathname === '/login' || pathname === '/admin/login' || pathname === '/get-started';

  const redirect = useCallback(() => {
    const admin = pathname.startsWith('/admin');
    clearAuthToken();
    router.replace(admin ? '/admin/login' : '/login');
  }, [pathname, router]);

  const markActivity = useCallback(() => {
    const now = Date.now();
    lastActivity.current = now;
    window.localStorage.setItem(ACTIVITY_KEY, String(now));
    if (now - lastPing.current > 60_000 && getAuthToken()) {
      lastPing.current = now;
      void apiFetch(
        pathname.startsWith('/admin') ? '/admin/session' : '/auth/session',
      ).catch(() => undefined);
    }
    setWarning(false);
  }, [pathname]);

  useEffect(() => {
    if (isPublic || !getAuthToken()) return;
    const stored = Number(window.localStorage.getItem(ACTIVITY_KEY));
    lastActivity.current = Number.isFinite(stored) && stored > 0 ? stored : Date.now();
    window.localStorage.setItem(ACTIVITY_KEY, String(lastActivity.current));
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((event) => window.addEventListener(event, markActivity, { passive: true }));
    const onStorage = (event: StorageEvent) => {
      if (event.key === ACTIVITY_KEY && Number(event.newValue) > lastActivity.current) {
        lastActivity.current = Number(event.newValue);
        setWarning(false);
      }
      if (event.key === EVENT_KEY && event.newValue?.startsWith('logout:')) redirect();
    };
    window.addEventListener('storage', onStorage);
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - lastActivity.current;
      if (elapsed >= IDLE_MS) {
        window.localStorage.setItem(EVENT_KEY, `logout:${Date.now()}`);
        redirect();
      } else if (elapsed >= IDLE_MS - WARNING_MS) {
        setWarning(true);
      }
    }, 5_000);
    return () => {
      events.forEach((event) => window.removeEventListener(event, markActivity));
      window.removeEventListener('storage', onStorage);
      window.clearInterval(timer);
    };
  }, [isPublic, markActivity, redirect]);

  async function staySignedIn() {
    try {
      await apiFetch(
        pathname.startsWith('/admin') ? '/admin/session' : '/auth/session',
      );
      markActivity();
    } catch {
      redirect();
    }
  }

  async function signOut() {
    await apiPost('/auth/logout', {}).catch(() => undefined);
    window.localStorage.setItem(EVENT_KEY, `logout:${Date.now()}`);
    redirect();
  }

  return (
    <>
      {children}
      {warning ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-warning-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
            background: 'rgb(15 39 68 / 35%)',
          }}
        >
          <div
            style={{
              width: 'min(100%, 420px)',
              borderRadius: 16,
              background: '#fff',
              padding: '1.5rem',
              boxShadow: '0 20px 50px rgb(15 39 68 / 25%)',
            }}
          >
            <h2 id="session-warning-title" style={{ margin: 0, fontSize: '1.15rem' }}>
              Your session is about to expire
            </h2>
            <p style={{ color: '#5d6b78', lineHeight: 1.5 }}>
              Stay signed in to continue working safely.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => void signOut()}>
                Sign out
              </button>
              <button type="button" onClick={() => void staySignedIn()}>
                Stay signed in
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
