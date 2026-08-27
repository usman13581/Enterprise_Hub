'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  APP_NAME,
  APP_POWERED_BY,
  APP_VERSION,
  SHOW_NOTIFICATIONS,
} from '@marble/types';
import { apiPost } from '@/lib/api';
import { clearAuthToken } from '@/lib/auth';
import styles from './AppShell.module.css';

const SIDEBAR_KEY = 'eh.sidebar.collapsed';

const ADMIN_NAV_ALL = [
  { key: 'home', label: 'Home', href: '/admin', icon: '⌂', group: 'Overview' },
  {
    key: 'companies',
    label: 'Companies',
    href: '/admin/companies',
    icon: '◎',
    group: 'Tenants',
  },
  {
    key: 'applications',
    label: 'Applications',
    href: '/admin/applications',
    icon: '✎',
    group: 'Tenants',
  },
  {
    key: 'plans',
    label: 'Plans',
    href: '/admin/plans',
    icon: '★',
    group: 'Billing',
  },
  {
    key: 'subscriptions',
    label: 'Subscriptions',
    href: '/admin/subscriptions',
    icon: '▤',
    group: 'Billing',
  },
  {
    key: 'renewals',
    label: 'Renewals',
    href: '/admin/renewal-requests',
    icon: '↻',
    group: 'Billing',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    href: '/admin/notifications',
    icon: '🔔',
    group: 'Ops',
  },
  {
    key: 'support',
    label: 'Support',
    href: '/admin/support',
    icon: '?',
    group: 'Ops',
  },
  {
    key: 'audit',
    label: 'Audit',
    href: '/admin/audit',
    icon: '◉',
    group: 'Ops',
  },
] as const;

const ADMIN_NAV = ADMIN_NAV_ALL.filter(
  (item) => SHOW_NOTIFICATIONS || item.key !== 'notifications',
);

function isActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === '1');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }

  async function handleSignOut() {
    try {
      await apiPost('/auth/logout', {});
    } catch {
      // Still clear local session if the API call fails.
    }
    clearAuthToken();
    router.replace('/admin/login');
  }

  const groups = ['Overview', 'Tenants', 'Billing', 'Ops'] as const;
  const layoutClass = [
    styles.layout,
    collapsed ? styles.layoutCollapsed : '',
    drawerOpen ? styles.layoutDrawerOpen : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={layoutClass}>
      <button
        type="button"
        className={styles.menuToggleMobile}
        aria-label="Open menu"
        onClick={() => setDrawerOpen(true)}
      >
        ☰
      </button>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Close menu"
        onClick={() => setDrawerOpen(false)}
      />
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.brandBlock}>
            <p className={styles.brandMonogram} title={APP_NAME}>
              EH
            </p>
            <p className={styles.brandName}>{APP_NAME}</p>
            <p className={styles.brandSub}>Platform admin</p>
          </div>
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand menu' : 'Collapse menu'}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        <nav className={styles.nav}>
          {groups.map((group) => {
            const items = ADMIN_NAV.filter((item) => item.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className={styles.navGroup}>
                <p className={styles.navGroupLabel}>{group}</p>
                {items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={active ? styles.navActive : styles.navLink}
                      title={item.label}
                    >
                      <span className={styles.navIcon}>{item.icon}</span>
                      <span className={styles.navLabel}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className={styles.footer}>
          <div className={styles.footerActions}>
            <Link
              href="/admin/support"
              className={styles.footerLink}
              title="Support"
            >
              <span className={styles.navIcon}>?</span>
              <span className={styles.navLabel}>Support</span>
            </Link>
            <button
              type="button"
              className={styles.footerSignOut}
              onClick={() => void handleSignOut()}
              title="Sign out"
            >
              <span className={styles.navIcon}>⎋</span>
              <span className={styles.navLabel}>Sign out</span>
            </button>
          </div>
          <p className={styles.footerCredit}>
            {APP_POWERED_BY}
            <br />
            v{APP_VERSION}
          </p>
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
