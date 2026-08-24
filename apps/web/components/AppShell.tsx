'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MODULE_NAV } from '@marble/types';
import { apiPost } from '@/lib/api';
import { clearAuthToken } from '@/lib/auth';
import styles from './AppShell.module.css';

export function AppShell({
  children,
  onSignOut,
}: {
  children: React.ReactNode;
  onSignOut?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const profileActive = pathname.startsWith('/profile');

  async function handleSignOut() {
    if (onSignOut) {
      onSignOut();
      return;
    }
    try {
      await apiPost('/auth/logout', {});
    } catch {
      // Still clear local session if the API call fails.
    }
    clearAuthToken();
    router.replace('/login');
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <p className={styles.brandName}>Marble with Nuage</p>
          <p className={styles.brandSub}>Binhaj Marble pilot</p>
          <div className={styles.brandActions}>
            <Link
              href="/profile"
              className={
                profileActive ? styles.profileBtnActive : styles.profileBtn
              }
            >
              Company profile
            </Link>
            <button
              type="button"
              className={styles.signOut}
              onClick={() => void handleSignOut()}
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className={styles.nav}>
          {MODULE_NAV.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={active ? styles.navActive : styles.navLink}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
