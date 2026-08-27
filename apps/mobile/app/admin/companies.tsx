import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiFetch, apiPost } from '../../lib/api';
import { day, label } from '../../lib/format';
import {
  searchItems,
  useFlash,
  usePagination,
} from '../../lib/useCollection';
import { Pagination, SearchBox, Toast } from '../../components/ListControls';
import { ScreenScroll } from '../../components/ScreenScroll';
import {
  ActionButton,
  RecordRow,
  RowActions,
} from '../../components/Finance';
import { colors, ui } from '../../lib/ui';

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  suspendedAt: string | null;
  subscription?: {
    status: string;
    expiresAt: string | null;
    plan?: { name: string } | null;
  } | null;
  _count?: { users: number };
};

export default function AdminCompaniesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const { flash, notify } = useFlash();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await apiFetch<CompanyRow[]>('/admin/companies');
      setItems(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = searchItems(items, query);
  const pager = usePagination(filtered);

  async function create() {
    if (saving || !name.trim()) return;
    setSaving(true);
    try {
      await apiPost('/admin/companies', {
        name: name.trim(),
        slug: slug.trim() || undefined,
      });
      setName('');
      setSlug('');
      await load();
      notify('Company created');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenScroll>
      <Text style={ui.title}>Companies</Text>
      <Text style={ui.lede}>Tenants, seats, and subscription status.</Text>
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <View style={ui.card}>
        <Text style={ui.cardTitle}>Create company</Text>
        <Text style={ui.label}>Name</Text>
        <TextInput
          style={ui.input}
          value={name}
          onChangeText={setName}
          placeholder="Legal / trade name"
          placeholderTextColor={colors.soft}
        />
        <Text style={ui.label}>Slug (optional)</Text>
        <TextInput
          style={ui.input}
          value={slug}
          onChangeText={setSlug}
          autoCapitalize="none"
          placeholder="auto-from-name"
          placeholderTextColor={colors.soft}
        />
        <RowActions>
          <ActionButton
            label={saving ? 'Creating…' : 'Create'}
            tone="primary"
            disabled={saving || !name.trim()}
            onPress={() => void create()}
          />
        </RowActions>
      </View>

      <SearchBox value={query} onChange={setQuery} placeholder="Search companies…" />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        pager.paged.map((row) => (
          <RecordRow
            key={row.id}
            title={row.name}
            meta={[
              row.slug,
              row.subscription?.plan?.name,
              row.subscription ? label(row.subscription.status) : null,
              row.subscription?.expiresAt
                ? `exp ${day(row.subscription.expiresAt)}`
                : null,
              row._count ? `${row._count.users} users` : null,
              row.suspendedAt ? 'SUSPENDED' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            status={row.suspendedAt ? 'cancelled' : row.subscription?.status}
            onPress={() =>
              router.push(`/admin/companies/${row.id}` as never)
            }
          />
        ))
      )}

      <Pagination
        page={pager.page}
        setPage={pager.setPage}
        pageSize={pager.pageSize}
        setPageSize={pager.setPageSize}
        pageCount={pager.pageCount}
        total={pager.total}
      />
      <Toast flash={flash} />
    </ScreenScroll>
  );
}
