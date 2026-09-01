import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { Pagination, SearchBox, Toast } from '../../components/ListControls';
import { RecordRow } from '../../components/Finance';
import { ScreenScroll } from '../../components/ScreenScroll';
import { apiFetch } from '../../lib/api';
import { day, label } from '../../lib/format';
import { searchItems, useFlash, usePagination } from '../../lib/useCollection';
import { colors, ui } from '../../lib/ui';

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  suspendedAt: string | null;
  subscription?: {
    status: string;
    startsAt: string;
    trialEndsAt: string | null;
    expiresAt: string | null;
    seatsIncluded: number;
    seatsOverride: number | null;
    plan?: { name: string; code: string } | null;
  } | null;
};

export default function AdminSubscriptionsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const { flash } = useFlash();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await apiFetch<CompanyRow[]>('/admin/companies'));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = searchItems(items, query);
  const pager = usePagination(filtered, query);

  return (
    <ScreenScroll>
      <Text style={ui.title}>Subscriptions</Text>
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <SearchBox value={query} onChange={setQuery} placeholder="Search companies…" />
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : filtered.length === 0 ? (
        <Text style={ui.emptyText}>No subscriptions found.</Text>
      ) : (
        pager.paged.map((company) => (
          <RecordRow
            key={company.id}
            title={company.name}
            meta={[
              company.subscription?.plan?.name ?? 'No plan',
              company.subscription ? label(company.subscription.status) : 'none',
              company.subscription?.expiresAt
                ? `expires ${day(company.subscription.expiresAt)}`
                : company.subscription?.trialEndsAt
                  ? `trial ends ${day(company.subscription.trialEndsAt)}`
                  : null,
              company.suspendedAt ? 'SUSPENDED' : null,
            ].filter(Boolean).join(' · ')}
            status={company.subscription?.status}
            onPress={() => router.push(`/admin/companies/${company.id}` as never)}
          />
        ))
      )}
      {filtered.length > 0 ? (
        <Pagination
          page={pager.page}
          setPage={pager.setPage}
          pageSize={pager.pageSize}
          setPageSize={pager.setPageSize}
          pageCount={pager.pageCount}
          total={pager.total}
        />
      ) : null}
      <Toast flash={flash} />
    </ScreenScroll>
  );
}
