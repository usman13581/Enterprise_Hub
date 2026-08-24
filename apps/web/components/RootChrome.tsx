'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { isAuthenticated } from '@/lib/auth';

export function RootChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const isLogin = pathname === '/login';

  useEffect(() => {
    if (isLogin) {
      if (isAuthenticated()) router.replace('/');
      setReady(true);
      return;
    }
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [isLogin, pathname, router]);

  if (isLogin) return <>{children}</>;
  if (!ready) {
    return (
      <div style={{ padding: '2rem', color: '#5d6b78' }}>Loading session…</div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
