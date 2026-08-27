'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  APP_NAME,
  APP_POWERED_BY,
  APP_VERSION,
  MODULE_NAV,
  SHOW_NOTIFICATIONS,
  type SessionPayload,
} from '@marble/types';
import { apiFetch, apiPost } from '@/lib/api';
import { clearAuthToken } from '@/lib/auth';
import { day } from '@/lib/format';
import styles from './AppShell.module.css';

const SIDEBAR_KEY = 'eh.sidebar.collapsed';

type SubscriptionSummary = {
  planName: string;
  status: string;
  startsAt: string;
  trialEndsAt: string | null;
  expiresAt: string | null;
} | null;

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
};

const ICONS: Record<string, string> = {
  home: '⌂',
  customers: '◎',
  suppliers: '◇',
  products: '▣',
  quotations: '✎',
  jobs: '⚒',
  invoices: '▤',
  advances: '↓',
  accounts: '☰',
  reports: '▦',
  audit: '◉',
  team: '☷',
  subscription: '★',
  notifications: '🔔',
  profile: '⚙',
  support: '?',
};

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  onSignOut,
}: {
  children: React.ReactNode;
  onSignOut?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isAdmin = session?.companyRole === 'admin';
  const unread = session?.unreadNotifications ?? 0;

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

  useEffect(() => {
    void apiFetch<SessionPayload>('/auth/session')
      .then(setSession)
      .catch(() => setSession(null));
    void apiFetch<SubscriptionSummary>('/company/subscription')
      .then(setSubscription)
      .catch(() => setSubscription(null));
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

  const groups = useMemo(() => {
    const byKey = new Map(MODULE_NAV.map((item) => [item.key, item]));
    const workKeys = [
      'customers',
      'suppliers',
      'products',
      'quotations',
      'jobs',
      'invoices',
      'advances',
      'accounts',
    ] as const;
    const insightKeys = ['reports', 'audit'] as const;

    const work: NavItem[] = workKeys
      .map((key) => byKey.get(key))
      .filter(Boolean)
      .map((item) => ({
        key: item!.key,
        label: item!.label,
        href: item!.href,
        icon: ICONS[item!.key] ?? '•',
      }));

    const insights: NavItem[] = insightKeys
      .map((key) => byKey.get(key))
      .filter(Boolean)
      .map((item) => ({
        key: item!.key,
        label: item!.label,
        href: item!.href,
        icon: ICONS[item!.key] ?? '•',
      }));

    const account: NavItem[] = [];
    if (SHOW_NOTIFICATIONS) {
      account.push({
        key: 'notifications',
        label: unread > 0 ? `Notifications (${unread})` : 'Notifications',
        href: '/notifications',
        icon: ICONS.notifications,
      });
    }
    account.push({
      key: 'profile',
      label: 'Company profile',
      href: '/profile',
      icon: ICONS.profile,
    });
    if (isAdmin) {
      account.push(
        { key: 'team', label: 'Team', href: '/team', icon: ICONS.team },
        {
          key: 'subscription',
          label: 'Subscription',
          href: '/subscription',
          icon: ICONS.subscription,
        },
      );
    }

    return [
      {
        id: 'home',
        label: 'Home',
        items: [
          {
            key: 'home',
            label: 'Home',
            href: '/',
            icon: ICONS.home,
          },
        ],
      },
      { id: 'work', label: 'Work', items: work },
      { id: 'insights', label: 'Insights', items: insights },
      { id: 'account', label: 'Account', items: account },
    ];
  }, [isAdmin, unread]);

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
            <p className={styles.brandSub}>
              {session?.companyName ?? 'Company workspace'}
            </p>
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
          {groups.map((group) => (
            <div key={group.id} className={styles.navGroup}>
              <p className={styles.navGroupLabel}>{group.label}</p>
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={active ? styles.navActive : styles.navLink}
                    title={item.label}
                  >
                    <span className={styles.navIcon}>{item.icon}</span>
                    <span className={styles.navLabel}>
                      {item.key === 'notifications' && unread > 0 ? (
                        <span className={styles.bellRow}>
                          Notifications
                          <span className={styles.badge}>
                            {unread > 99 ? '99+' : unread}
                          </span>
                        </span>
                      ) : (
                        item.label
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={styles.footer}>
          {subscription ? (
            <p className={styles.footerLine}>
              {subscription.planName} · {subscription.status}
              <br />
              {subscription.expiresAt
                ? `Expires ${day(subscription.expiresAt)}`
                : subscription.trialEndsAt
                  ? `Trial ends ${day(subscription.trialEndsAt)}`
                  : `Started ${day(subscription.startsAt)}`}
            </p>
          ) : (
            <p className={styles.footerLine}>Subscription unavailable</p>
          )}
          <div className={styles.footerActions}>
            <Link
              href="/support"
              className={styles.footerLink}
              title="Support"
            >
              <span className={styles.navIcon}>{ICONS.support}</span>
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
