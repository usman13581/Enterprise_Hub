import { Linking } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiFetch, apiPost, assetUrl } from '../../lib/api';
import { day, money } from '../../lib/format';
import {
  searchItems,
  useFlash,
  usePagination,
} from '../../lib/useCollection';
import {
  Pagination,
  SearchBox,
  Toast,
} from '../../components/ListControls';
import { ScreenScroll } from '../../components/ScreenScroll';
import {
  ActionButton,
  FilterChips,
  RecordRow,
  RowActions,
} from '../../components/Finance';
import { colors, ui } from '../../lib/ui';

type Renewal = {
  id: string;
  amount: number;
  paidAt: string;
  bankReference: string | null;
  notes: string | null;
  depositDocumentUrl: string;
  status: string;
  rejectReason: string | null;
  createdAt: string;
  company?: { id: string; name: string; slug: string } | null;
  submittedBy?: { name: string; email: string } | null;
};

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

export default function AdminRenewalsScreen() {
  const [items, setItems] = useState<Renewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const { flash, notify } = useFlash();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await apiFetch<Renewal[]>('/admin/renewal-requests'));
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

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((row) => row.status === filter);
  }, [items, filter]);
  const searched = searchItems(filtered, query);
  const pager = usePagination(searched, `${filter}:${query}`);

  const selected = items.find((row) => row.id === selectedId) ?? null;

  async function approve() {
    if (!selectedId || saving) return;
    setSaving(true);
    try {
      await apiPost(`/admin/renewal-requests/${selectedId}/approve`, {
        expiresAt: expiresAt || undefined,
      });
      setSelectedId(null);
      setExpiresAt('');
      await load();
      notify('Renewal approved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setSaving(false);
    }
  }

  async function reject() {
    if (!selectedId || saving) return;
    setSaving(true);
    try {
      await apiPost(`/admin/renewal-requests/${selectedId}/reject`, {
        reason: rejectReason,
      });
      setSelectedId(null);
      setRejectReason('');
      await load();
      notify('Renewal rejected', 'danger');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenScroll>
      <Text style={ui.title}>Renewals</Text>
      <Text style={ui.lede}>Bank-deposit inbox for subscription renewals.</Text>
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <FilterChips
        options={[
          { key: 'pending', label: 'Pending' },
          { key: 'approved', label: 'Approved' },
          { key: 'rejected', label: 'Rejected' },
          { key: 'all', label: 'All' },
        ]}
        active={filter}
        onChange={setFilter}
      />
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search renewals by company, email, or reference…"
      />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : searched.length === 0 ? (
        <View style={ui.empty}>
          <Text style={ui.emptyText}>No renewal requests.</Text>
        </View>
      ) : (
        pager.paged.map((row) => (
          <RecordRow
            key={row.id}
            title={`${row.company?.name ?? 'Company'} · ${money(row.amount)}`}
            meta={[
              day(row.paidAt),
              row.bankReference,
              row.submittedBy?.email,
            ]
              .filter(Boolean)
              .join(' · ')}
            status={row.status}
            onPress={() =>
              setSelectedId((id) => (id === row.id ? null : row.id))
            }
          />
        ))
      )}
      {searched.length > 0 ? (
        <Pagination
          page={pager.page}
          setPage={pager.setPage}
          pageSize={pager.pageSize}
          setPageSize={pager.setPageSize}
          pageCount={pager.pageCount}
          total={pager.total}
        />
      ) : null}

      {selected ? (
        <View style={ui.card}>
          <Text style={ui.cardTitle}>
            {selected.company?.name} · {money(selected.amount)}
          </Text>
          <Text style={ui.cardMeta}>{selected.notes || 'No notes'}</Text>
          <RowActions>
            <ActionButton
              label="Open deposit"
              tone="primary"
              onPress={() => {
                const url = assetUrl(selected.depositDocumentUrl);
                if (url) void Linking.openURL(url);
              }}
            />
          </RowActions>
          {selected.status === 'pending' ? (
            <>
              <Text style={ui.label}>New expiry (optional YYYY-MM-DD)</Text>
              <TextInput
                style={ui.input}
                value={expiresAt}
                onChangeText={setExpiresAt}
                autoCapitalize="none"
                placeholderTextColor={colors.soft}
              />
              <Text style={ui.label}>Reject reason</Text>
              <TextInput
                style={ui.input}
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholderTextColor={colors.soft}
              />
              <RowActions>
                <ActionButton
                  label={saving ? '…' : 'Approve'}
                  tone="primary"
                  disabled={saving}
                  onPress={() => void approve()}
                />
                <ActionButton
                  label="Reject"
                  tone="danger"
                  disabled={saving || !rejectReason.trim()}
                  onPress={() => void reject()}
                />
              </RowActions>
            </>
          ) : null}
        </View>
      ) : null}

      <Toast flash={flash} />
    </ScreenScroll>
  );
}
