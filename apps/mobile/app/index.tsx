import {
  APP_NAME,
  APP_POWERED_BY,
  APP_VERSION,
  MODULE_NAV,
  SHOW_NOTIFICATIONS,
} from '@marble/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenScroll } from '../components/ScreenScroll';
import { apiFetch, apiPost } from '../lib/api';
import { clearAuthToken } from '../lib/auth';
import { day, money } from '../lib/format';
import {
  runSync,
  subscribeSyncStatus,
  type SyncStatus,
} from '../lib/offline/syncEngine';
import { colors, ui } from '../lib/ui';

type Session = {
  kind?: 'company' | 'platform';
  companyId: string;
  userId: string;
  email: string;
  companyName: string;
  companyRole?: 'admin' | 'member';
  features?: string[];
  unreadNotifications?: number;
};

type SubscriptionSummary = {
  planName: string;
  planCode: string;
  status: string;
  startsAt: string;
  trialEndsAt: string | null;
  expiresAt: string | null;
  seats: number;
  lastPaymentAmount: number | null;
  lastPaymentAt: string | null;
} | null;

type Dashboard = {
  subscription: SubscriptionSummary;
  seats: { active: number; cap: number; deactivated: number };
  openQuotations: number;
  openJobs: number;
  outstandingInvoiceCount: number;
  arTotal: number;
  overdueInvoiceCount: number;
  unreadNotifications: number;
  openSupportCount: number;
};

const READY = new Set([
  'customers',
  'suppliers',
  'products',
  'quotations',
  'jobs',
  'invoices',
  'advances',
  'accounts',
  'reports',
  'audit',
]);

export default function HomeScreen() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary>(null);
  const [error, setError] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await apiFetch<Session>('/auth/session');
      setSession(next);
      setError(null);

      const sub = await apiFetch<SubscriptionSummary>('/company/subscription');
      setSubscription(sub);

      if (next.companyRole === 'admin') {
        const dash = await apiFetch<Dashboard>('/company/dashboard');
        setDashboard(dash);
      } else {
        setDashboard(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load session');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus(setSync);
    void runSync();
    const id = setInterval(() => void runSync(), 30_000);
    return () => {
      unsubscribe();
      clearInterval(id);
    };
  }, []);

  const isAdmin = session?.companyRole === 'admin';
  const modules = MODULE_NAV.filter((m) => m.key !== 'home');
  const pending =
    (sync?.pendingMutations ?? 0) + (sync?.pendingImages ?? 0);
  const unread =
    dashboard?.unreadNotifications ?? session?.unreadNotifications ?? 0;
  const sub = dashboard?.subscription ?? subscription;

  return (
    <ScreenScroll>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>{APP_NAME}</Text>
          <Text style={ui.lede}>
            {isAdmin
              ? 'Work modules and company details.'
              : 'Same modules and data as the web app.'}
          </Text>
        </View>
        {SHOW_NOTIFICATIONS ? (
          <Pressable
            style={({ pressed }) => [
              styles.bell,
              pressed && styles.rowPressed,
            ]}
            onPress={() => router.push('/module/notifications' as never)}
          >
            <Text style={styles.bellIcon}>N</Text>
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unread > 99 ? '99+' : String(unread)}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={ui.error}>{error}</Text> : null}
      {session ? (
        <View style={ui.card}>
          <Text style={styles.cardLabel}>Active company</Text>
          <Text style={ui.cardTitle}>{session.companyName}</Text>
          <Text style={ui.cardMeta}>{session.email}</Text>
          {session.companyRole ? (
            <Text style={styles.pilot}>
              {session.companyRole === 'admin' ? 'Company admin' : 'Member'}
            </Text>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              styles.profileBtn,
              pressed && styles.rowPressed,
            ]}
            onPress={() => router.push('/module/profile' as never)}
          >
            <Text style={styles.profileBtnText}>Company profile</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.section}>Work</Text>
      {modules
        .filter((m) =>
          [
            'customers',
            'suppliers',
            'products',
            'quotations',
            'jobs',
            'invoices',
            'advances',
            'accounts',
          ].includes(m.key),
        )
        .map((item) => (
          <Pressable
            key={item.key}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => router.push(`/module/${item.key}` as never)}
          >
            <View>
              <Text style={styles.rowText}>{item.label}</Text>
              {!READY.has(item.key) ? (
                <Text style={styles.soon}>Coming in a later phase</Text>
              ) : null}
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}

      <Text style={styles.section}>Insights</Text>
      {modules
        .filter((m) => ['reports', 'audit'].includes(m.key))
        .map((item) => (
          <Pressable
            key={item.key}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => router.push(`/module/${item.key}` as never)}
          >
            <Text style={styles.rowText}>{item.label}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}

      {isAdmin && dashboard ? (
        <>
          <Text style={styles.section}>Overview</Text>
          <View style={styles.detailCard}>
            <Text style={styles.detailLine}>
              Plan · {sub?.planName ?? '—'}
              {sub?.status ? ` (${sub.status})` : ''}
            </Text>
            {sub?.expiresAt ? (
              <Text style={styles.detailMeta}>
                Expires {day(sub.expiresAt)}
              </Text>
            ) : null}
            <Text style={styles.detailLine}>
              Team · {dashboard.seats.active} /{' '}
              {dashboard.seats.cap || '—'} seats
            </Text>
            <Text style={styles.detailLine}>
              Open · {dashboard.openQuotations} quotations ·{' '}
              {dashboard.openJobs} jobs
            </Text>
            <Text style={styles.detailLine}>
              AR · {dashboard.outstandingInvoiceCount} invoices ·{' '}
              {money(dashboard.arTotal)}
              {dashboard.overdueInvoiceCount
                ? ` · ${dashboard.overdueInvoiceCount} overdue`
                : ''}
            </Text>
            <Text style={styles.detailMeta}>
              {dashboard.openSupportCount} open support
              {SHOW_NOTIFICATIONS
                ? ` · ${dashboard.unreadNotifications} unread`
                : ''}
            </Text>
          </View>
        </>
      ) : null}

      <Text style={styles.section}>Sync</Text>
      <View style={styles.syncCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.syncLine}>
            {sync?.online === false ? 'Offline' : 'Online'}
            {sync?.syncing ? ' · syncing…' : ''}
            {pending > 0 ? ` · ${pending} queued` : ''}
          </Text>
          {sync?.lastSyncAt ? (
            <Text style={styles.syncMeta}>
              Last sync {new Date(sync.lastSyncAt).toLocaleString()}
            </Text>
          ) : (
            <Text style={styles.syncMeta}>Not synced yet</Text>
          )}
          {sync?.lastError ? (
            <Text style={ui.error}>{sync.lastError}</Text>
          ) : null}
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.syncButton,
            pressed && styles.rowPressed,
          ]}
          onPress={() => void runSync()}
        >
          <Text style={styles.syncButtonText}>Sync now</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Account</Text>
      {isAdmin ? (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => router.push('/module/team' as never)}
        >
          <Text style={styles.rowText}>Team</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ) : null}
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => router.push('/module/subscription' as never)}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.rowText}>Subscription</Text>
          <Text style={styles.soon}>
            {[
              sub?.planName,
              sub?.status,
              sub?.expiresAt ? `expires ${day(sub.expiresAt)}` : null,
              sub?.trialEndsAt ? `trial ends ${day(sub.trialEndsAt)}` : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'No subscription loaded'}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => router.push('/module/support' as never)}
      >
        <Text style={styles.rowText}>Support</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      {session ? (
        <Pressable
          style={({ pressed }) => [
            styles.signOutRow,
            pressed && styles.rowPressed,
          ]}
          onPress={() =>
            void (async () => {
              try {
                await apiPost('/auth/logout', {});
              } catch {
                // still clear local session
              }
              await clearAuthToken();
              router.replace('/login' as never);
            })()
          }
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      ) : null}

      <Text style={styles.credit}>{APP_POWERED_BY}</Text>
      <Text style={styles.version}>v{APP_VERSION}</Text>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  brand: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: {
    fontSize: 18,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  cardLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  pilot: {
    color: colors.soft,
    fontSize: 12,
    marginTop: 8,
  },
  profileBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#fff',
  },
  profileBtnText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  signOutBtn: {
    alignSelf: 'center',
    marginTop: 28,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(194,59,59,0.25)',
    marginBottom: 8,
  },
  signOutText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '600',
  },
  credit: {
    marginTop: 4,
    color: colors.soft,
    fontSize: 11,
    textAlign: 'center',
  },
  version: {
    marginTop: 2,
    marginBottom: 8,
    color: colors.soft,
    fontSize: 11,
    textAlign: 'center',
  },
  syncCard: {
    marginTop: 4,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  syncLine: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '500',
  },
  syncMeta: {
    color: colors.soft,
    fontSize: 12,
    marginTop: 2,
  },
  syncButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
  },
  syncButtonText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 13,
  },
  detailCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 8,
    gap: 4,
  },
  detailLine: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '500',
  },
  detailMeta: {
    color: colors.soft,
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    marginTop: 22,
    marginBottom: 8,
    color: colors.muted,
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 8,
  },
  rowPressed: {
    backgroundColor: colors.accentSoft,
  },
  rowText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '500',
  },
  soon: {
    color: colors.soft,
    fontSize: 12,
    marginTop: 2,
  },
  chevron: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: '300',
  },
});
