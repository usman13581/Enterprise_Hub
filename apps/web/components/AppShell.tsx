'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MODULE_NAV } from '@marble/types';
import styles from './AppShell.module.css';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const profileActive = pathname.startsWith('/profile');

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <p className={styles.brandName}>Marble with Nuage</p>
          <p className={styles.brandSub}>Binhaj Marble pilot</p>
          <Link
            href="/profile"
            className={
              profileActive ? styles.profileBtnActive : styles.profileBtn
            }
          >
            Company profile
          </Link>
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
