'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { AdminShell } from '@/components/AdminShell';
import { isAuthenticated } from '@/lib/auth';
import { SessionGuard } from './SessionGuard';

export function RootChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const isLogin = pathname === '/login';
  const isAdminLogin = pathname === '/admin/login';
  const isAdmin = pathname.startsWith('/admin');
  const isPublicGetStarted = pathname === '/get-started';
  const isPasswordChange = pathname === '/change-password';

  useEffect(() => {
    if (isLogin || isAdminLogin || isPublicGetStarted || isPasswordChange) {
      if (isLogin && isAuthenticated()) router.replace('/');
      if (isAdminLogin && isAuthenticated()) router.replace('/admin');
      setReady(true);
      return;
    }
    if (!isAuthenticated()) {
      router.replace(isAdmin ? '/admin/login' : '/login');
      return;
    }
    setReady(true);
  }, [isLogin, isAdminLogin, isPublicGetStarted, isPasswordChange, isAdmin, pathname, router]);

  if (isLogin || isAdminLogin || isPublicGetStarted || isPasswordChange) return <>{children}</>;
  if (!ready) {
    return (
      <div style={{ padding: '2rem', color: '#5d6b78' }}>Loading session…</div>
    );
  }

  if (isAdmin) {
    return <SessionGuard><AdminShell>{children}</AdminShell></SessionGuard>;
  }
  return <SessionGuard><AppShell>{children}</AppShell></SessionGuard>;
}
