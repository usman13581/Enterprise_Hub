import {
  APP_NAME,
  APP_POWERED_BY,
  APP_VERSION,
  ADMIN_NAV_ICONS,
  APP_NAV_ICONS,
  SHOW_NOTIFICATIONS,
} from '@marble/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenScroll } from '../../components/ScreenScroll';
import { ModuleMenuRow, StatCard } from '../../components/Finance';
import { apiFetch, apiPost } from '../../lib/api';
import { clearAuthToken } from '../../lib/auth';
import { colors, ui } from '../../lib/ui';

type Overview = {
  pendingApplications: number;
  applicationsApprovedThisMonth: number;
  applicationsRejectedThisMonth: number;
  subscriptionsByStatus: Record<string, number>;
  expiriesIn7Days: number;
  expiriesIn14Days: number;
  pendingRenewals: number;
  companyCount: number;
  suspendedCount: number;
  activeUsers: number;
  openSupport?: number;
};

type Session = {
  email: string;
  name?: string;
};

type SupportRow = { id: string; status: string };

const NAV_GROUPS = [
  {
    label: 'Tenants',
    items: [
      { label: 'Companies', href: '/admin/companies', key: 'companies' },
      { label: 'Applications', href: '/admin/applications', key: 'applications' },
    ],
  },
  {
    label: 'Billing',
    items: [
      { label: 'Plans', href: '/admin/plans', key: 'plans' },
      { label: 'Renewals', href: '/admin/renewals', key: 'renewals' },
    ],
  },
  {
    label: 'Ops',
    items: [
      { label: 'Notifications', href: '/admin/notifications', key: 'notifications' },
      { label: 'Support', href: '/admin/support', key: 'support' },
      { label: 'Audit', href: '/admin/audit', key: 'audit' },
    ].filter(
      (item) => SHOW_NOTIFICATIONS || item.label !== 'Notifications',
    ),
  },
];

export default function AdminHomeScreen() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [openSupport, setOpenSupport] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [sess, stats, support] = await Promise.all([
        apiFetch<Session>('/admin/session'),
        apiFetch<Overview>('/admin/overview'),
        apiFetch<SupportRow[]>('/admin/support/requests?status=open'),
      ]);
      setSession(sess);
      setOverview(stats);
      setOpenSupport(stats.openSupport ?? support.length);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const subs = overview?.subscriptionsByStatus ?? {};

  return (
    <ScreenScroll>
      <Text style={styles.brand}>{APP_NAME}</Text>
      {error ? <Text style={ui.error}>{error}</Text> : null}

      {overview ? (
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Platform overview</Text>
            <Text style={styles.heroSub}>
              {overview.companyCount} companies · {overview.activeUsers} active
              users
            </Text>
            {session ? (
              <Text style={styles.who}>
                {session.name || 'Admin'} · {session.email}
              </Text>
            ) : null}
          </View>
          <View
            style={[
              styles.chip,
              overview.pendingApplications > 0
                ? styles.chipTrial
                : styles.chipActive,
            ]}
          >
            <Text style={styles.chipText}>
              {overview.pendingApplications > 0
                ? `${overview.pendingApplications} pending`
                : 'Clear'}
            </Text>
          </View>
        </View>
      ) : null}

      {overview ? (
        <>
          <Text style={styles.section}>Snapshot</Text>
          <View style={styles.grid}>
            <Pressable
              style={styles.half}
              onPress={() => router.push('/admin/companies' as never)}
            >
              <StatCard
                title="Companies"
                value={String(overview.companyCount)}
                hint={`${overview.suspendedCount} suspended`}
              />
            </Pressable>
            <Pressable
              style={styles.half}
              onPress={() =>
                router.push('/admin/applications?status=pending' as never)
              }
            >
              <StatCard
                title="Pending apps"
                value={String(overview.pendingApplications)}
                hint={`${overview.applicationsApprovedThisMonth} approved this month`}
              />
            </Pressable>
          </View>
          <View style={styles.grid}>
            <Pressable
              style={styles.half}
              onPress={() => router.push('/admin/renewals' as never)}
            >
              <StatCard
                title="Renewals"
                value={String(overview.pendingRenewals)}
                tone={overview.pendingRenewals ? 'due' : 'clear'}
              />
            </Pressable>
            <Pressable
              style={styles.half}
              onPress={() => router.push('/admin/support' as never)}
            >
              <StatCard title="Open support" value={String(openSupport)} />
            </Pressable>
          </View>
          <View style={styles.grid}>
            <Pressable
              style={styles.half}
              onPress={() => router.push('/admin/companies' as never)}
            >
              <StatCard
                title="Expire in 7d"
                value={String(overview.expiriesIn7Days)}
                tone={overview.expiriesIn7Days ? 'due' : 'clear'}
              />
            </Pressable>
            <Pressable
              style={styles.half}
              onPress={() => router.push('/admin/companies' as never)}
            >
              <StatCard
                title="Expire in 14d"
                value={String(overview.expiriesIn14Days)}
              />
            </Pressable>
          </View>
          <Pressable
            onPress={() => router.push('/admin/subscriptions' as never)}
          >
            <StatCard
              title="Subscriptions"
              value={`A ${subs.active ?? 0} · T ${subs.trial ?? 0}`}
              hint={`past_due ${subs.past_due ?? 0} · suspended ${subs.suspended ?? 0}`}
            />
          </Pressable>
        </>
      ) : null}

      {NAV_GROUPS.map((group) => (
        <View key={group.label}>
          <Text style={styles.section}>{group.label}</Text>
          {group.items.map((item) => (
            <ModuleMenuRow
              key={item.href}
              icon={ADMIN_NAV_ICONS[item.key] ?? '•'}
              title={item.label}
              onPress={() => router.push(item.href as never)}
            />
          ))}
        </View>
      ))}

      <Text style={styles.section}>Account</Text>
      <ModuleMenuRow
        icon={APP_NAV_ICONS.support}
        title="Support"
        onPress={() => router.push('/admin/support' as never)}
      />
      <ModuleMenuRow
        icon={APP_NAV_ICONS.signOut}
        title="Sign out"
        tone="danger"
        onPress={() =>
          void (async () => {
            try {
              await apiPost('/auth/logout', {});
            } catch {
              // clear locally anyway
            }
            await clearAuthToken();
            router.replace('/admin-login' as never);
          })()
        }
      />

      <Text style={styles.credit}>{APP_POWERED_BY}</Text>
      <Text style={styles.version}>v{APP_VERSION}</Text>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  who: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  hero: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  heroSub: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: 'rgba(37,99,235,0.25)',
  },
  chipTrial: {
    backgroundColor: 'rgba(201,162,39,0.14)',
    borderColor: 'rgba(201,162,39,0.35)',
  },
  chipText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
  },
  section: {
    marginTop: 22,
    marginBottom: 8,
    color: colors.muted,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
  },
  half: { flex: 1 },
  pressed: { backgroundColor: colors.accentSoft },
  credit: {
    marginTop: 12,
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
});
