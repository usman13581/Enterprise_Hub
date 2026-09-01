import {
  APP_POWERED_BY,
  APP_VERSION,
  MODULE_NAV,
  moduleNavIcon,
  APP_NAV_ICONS,
  SHOW_NOTIFICATIONS,
} from '@marble/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenScroll } from '../components/ScreenScroll';
import { ModuleMenuRow } from '../components/Finance';
import { apiFetch, apiPost } from '../lib/api';
import {
  clearAuthToken,
  restorePlatformWorkspace,
} from '../lib/auth';
import { day, money } from '../lib/format';
import {
  runSync,
  subscribeSyncStatus,
  type SyncStatus,
} from '../lib/offline/syncEngine';
import { clearOfflineStore } from '../lib/offline/db';
import { colors, ui } from '../lib/ui';

type Session = {
  kind?: 'company' | 'platform';
  companyId: string;
  userId: string;
  email: string;
  companyName: string;
  companyRole?: 'admin' | 'member';
  readOnly?: boolean;
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

type SampleStatus = {
  eligible: boolean;
  status: string;
  counts: Record<string, number> | null;
  canLoad: boolean;
  canErase: boolean;
};

const READY = new Set([
  'customers',
  'suppliers',
  'products',
  'quotations',
  'jobs',
  'invoices',
  'hr',
  'advances',
  'purchase-orders',
  'accounts',
  'reports',
  'audit',
]);

export default function HomeScreen() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary>(null);
  const [sample, setSample] = useState<SampleStatus | null>(null);
  const [samplePreview, setSamplePreview] = useState<Record<string, number> | null>(null);
  const [sampleConfirmation, setSampleConfirmation] = useState('');
  const [sampleBusy, setSampleBusy] = useState(false);
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
        const [dash, sampleStatus] = await Promise.all([
          apiFetch<Dashboard>('/company/dashboard'),
          apiFetch<SampleStatus>('/company/sample-data'),
        ]);
        setDashboard(dash);
        setSample(sampleStatus);
      } else {
        setDashboard(null);
        setSample(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load session');
    }
  }, []);

  async function loadSample() {
    if (sampleBusy || !sample?.canLoad) return;
    setSampleBusy(true);
    setError(null);
    try {
      await apiPost('/company/sample-data/load', {});
      setSample(await apiFetch<SampleStatus>('/company/sample-data'));
      await clearOfflineStore();
      await runSync();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sample data could not be loaded');
    } finally {
      setSampleBusy(false);
    }
  }

  async function prepareEraseSample() {
    if (sampleBusy || !sample?.canErase) return;
    setSampleBusy(true);
    setError(null);
    try {
      const preview = await apiFetch<{ counts: Record<string, number> }>(
        '/company/sample-data/preview-erase',
      );
      setSamplePreview(preview.counts);
      setSampleConfirmation('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not prepare sample data erase');
    } finally {
      setSampleBusy(false);
    }
  }

  async function eraseSample() {
    if (
      sampleBusy ||
      !samplePreview ||
      !session ||
      sampleConfirmation !== `ERASE ${session.companyName}`
    ) {
      return;
    }
    setSampleBusy(true);
    setError(null);
    try {
      await apiPost('/company/sample-data/erase', {
        confirmation: sampleConfirmation,
      });
      await clearOfflineStore();
      setSamplePreview(null);
      setSampleConfirmation('');
      setSample(await apiFetch<SampleStatus>('/company/sample-data'));
      await runSync();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sample data could not be erased');
    } finally {
      setSampleBusy(false);
    }
  }

  async function exitAdminWorkspace() {
    try {
      await apiPost('/auth/logout', {});
    } catch {
      // Restore the platform session locally even if revocation fails.
    }
    if (await restorePlatformWorkspace()) {
      router.replace('/admin' as never);
      return;
    }
    await clearAuthToken();
    router.replace('/admin-login' as never);
  }

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
        <View style={styles.headerMain}>
          {session ? (
            <>
              <Text style={styles.companyName} numberOfLines={2}>
                {session.companyName}
              </Text>
              {session.companyRole ? (
                <Text style={styles.companyRole}>
                  {session.companyRole === 'admin'
                    ? 'Company admin'
                    : 'Member'}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>
        <View style={styles.headerAside}>
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
          {session ? (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.profileBtn,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => router.push('/module/profile' as never)}
              >
                <Text style={styles.profileBtnText}>Company profile</Text>
              </Pressable>
              <Text style={styles.headerMeta} numberOfLines={1}>
                {session.email}
              </Text>
            </>
          ) : null}
        </View>
      </View>

      {error ? <Text style={ui.error}>{error}</Text> : null}

      <Text style={styles.section}>Work</Text>
      {modules
        .filter((m) =>
          [
            'suppliers',
            'products',
            'purchase-orders',
            'customers',
            'quotations',
            'jobs',
            'invoices',
            'hr',
          ].includes(m.key),
        )
        .map((item) => (
          <ModuleMenuRow
            key={item.key}
            icon={moduleNavIcon(item.key)}
            title={item.label}
            subtitle={
              !READY.has(item.key) ? 'Coming in a later phase' : undefined
            }
            onPress={() => router.push(`/module/${item.key}` as never)}
          />
        ))}

      <Text style={styles.section}>Finance</Text>
      {modules
        .filter((m) => ['accounts', 'advances'].includes(m.key))
        .map((item) => (
          <ModuleMenuRow
            key={item.key}
            icon={moduleNavIcon(item.key)}
            title={item.label}
            onPress={() => router.push(`/module/${item.key}` as never)}
          />
        ))}

      <Text style={styles.section}>Insights</Text>
      {modules
        .filter((m) => ['reports', 'audit'].includes(m.key))
        .map((item) => (
          <ModuleMenuRow
            key={item.key}
            icon={moduleNavIcon(item.key)}
            title={item.label}
            onPress={() => router.push(`/module/${item.key}` as never)}
          />
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
          {isAdmin && sample?.eligible ? (
            <View style={styles.sampleCard}>
              <Text style={styles.detailLine}>Trial workspace</Text>
              <Text style={styles.detailMeta}>
                Generic sample data for testing every module and report.
              </Text>
              {sample.counts ? (
                <Text style={styles.detailMeta}>
                  {Object.entries(sample.counts)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(' · ')}
                </Text>
              ) : null}
              {sample.canLoad ? (
                <Pressable
                  style={styles.syncButton}
                  disabled={sampleBusy}
                  onPress={() => void loadSample()}
                >
                  <Text style={styles.syncButtonText}>
                    {sampleBusy ? 'Loading…' : 'Load sample data'}
                  </Text>
                </Pressable>
              ) : null}
              {sample.canErase && !samplePreview ? (
                <Pressable
                  style={styles.eraseButton}
                  disabled={sampleBusy}
                  onPress={() => void prepareEraseSample()}
                >
                  <Text style={styles.eraseButtonText}>
                    {sampleBusy ? 'Preparing…' : 'Erase sample data'}
                  </Text>
                </Pressable>
              ) : null}
              {samplePreview && session ? (
                <View style={styles.confirmBox}>
                  <Text style={styles.detailMeta}>
                    This permanently deletes {Object.entries(samplePreview)
                      .map(([key, value]) => `${value} ${key}`)
                      .join(', ')}. It also deletes trial records linked to
                    sample records.
                  </Text>
                  <TextInput
                    style={ui.input}
                    value={sampleConfirmation}
                    onChangeText={setSampleConfirmation}
                    autoCapitalize="none"
                    placeholder={`ERASE ${session.companyName}`}
                    placeholderTextColor={colors.soft}
                  />
                  <Pressable
                    style={styles.eraseButton}
                    disabled={
                      sampleBusy ||
                      sampleConfirmation !== `ERASE ${session.companyName}`
                    }
                    onPress={() => void eraseSample()}
                  >
                    <Text style={styles.eraseButtonText}>
                      {sampleBusy ? 'Erasing…' : 'Permanently erase'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}
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
      {session?.readOnly ? (
        <ModuleMenuRow
          icon={APP_NAV_ICONS.exitAdmin}
          title="Exit admin view"
          onPress={() => void exitAdminWorkspace()}
        />
      ) : null}
      {isAdmin ? (
        <ModuleMenuRow
          icon={APP_NAV_ICONS.team}
          title="Team"
          onPress={() => router.push('/module/team' as never)}
        />
      ) : null}
      <ModuleMenuRow
        icon={APP_NAV_ICONS.subscription}
        title="Subscription"
        subtitle={
          [
            sub?.planName,
            sub?.status,
            sub?.expiresAt ? `expires ${day(sub.expiresAt)}` : null,
            sub?.trialEndsAt ? `trial ends ${day(sub.trialEndsAt)}` : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'No subscription loaded'
        }
        onPress={() => router.push('/module/subscription' as never)}
      />
      <ModuleMenuRow
        icon={APP_NAV_ICONS.support}
        title="Support"
        onPress={() => router.push('/module/support' as never)}
      />
      {session ? (
        <ModuleMenuRow
          icon={APP_NAV_ICONS.signOut}
          title="Sign out"
          tone="danger"
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
        />
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
  headerMain: {
    flex: 1,
    minWidth: 0,
  },
  headerAside: {
    alignItems: 'flex-end',
    gap: 6,
    maxWidth: '46%',
  },
  companyName: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  companyRole: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 14,
    fontWeight: '500',
  },
  headerMeta: {
    color: colors.soft,
    fontSize: 12,
    textAlign: 'right',
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
  profileBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  profileBtnText: {
    color: colors.ink,
    fontSize: 13,
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
  sampleCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.35)',
    marginBottom: 8,
    gap: 8,
  },
  eraseButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(194,59,59,0.08)',
  },
  eraseButtonText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 13,
  },
  confirmBox: {
    gap: 8,
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
  rowPressed: {
    backgroundColor: colors.accentSoft,
  },
});
