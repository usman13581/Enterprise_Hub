import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiFetch, apiPost } from '../../lib/api';
import { day } from '../../lib/format';
import {
  searchItems,
  useFlash,
  usePagination,
} from '../../lib/useCollection';
import { Pagination, SearchBox, Toast } from '../../components/ListControls';
import { ScreenScroll } from '../../components/ScreenScroll';
import {
  ActionButton,
  FilterChips,
  RecordRow,
  RowActions,
} from '../../components/Finance';
import { colors, ui } from '../../lib/ui';

type SupportRow = {
  id: string;
  title: string;
  body: string;
  status: string;
  createdAt: string;
  closeNote: string | null;
  company?: { id: string; name: string } | null;
  createdBy?: { name: string; email: string } | null;
};

type Filter = 'open' | 'closed' | 'all';

export default function AdminSupportScreen() {
  const [items, setItems] = useState<SupportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('open');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const { flash, notify } = useFlash();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await apiFetch<SupportRow[]>('/admin/support/requests'));
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

  const pagedGrouped = useMemo(() => {
    const map = new Map<string, { name: string; rows: SupportRow[] }>();
    for (const row of pager.paged) {
      const key = row.company?.id ?? 'unknown';
      const name = row.company?.name ?? 'Unknown company';
      const bucket = map.get(key) ?? { name, rows: [] };
      bucket.rows.push(row);
      map.set(key, bucket);
    }
    return [...map.entries()].sort((a, b) =>
      a[1].name.localeCompare(b[1].name),
    );
  }, [pager.paged]);

  const selected = items.find((row) => row.id === selectedId) ?? null;

  async function close() {
    if (!selectedId || saving) return;
    setSaving(true);
    try {
      await apiPost(`/admin/support/requests/${selectedId}/close`, {
        note: note || undefined,
      });
      setSelectedId(null);
      setNote('');
      await load();
      notify('Ticket closed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Close failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenScroll>
      <Text style={ui.title}>Support</Text>
      <Text style={ui.lede}>All company tickets, grouped by tenant.</Text>
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <FilterChips
        options={[
          { key: 'open', label: 'Open' },
          { key: 'closed', label: 'Closed' },
          { key: 'all', label: 'All' },
        ]}
        active={filter}
        onChange={setFilter}
      />
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search support by title, company, or email…"
      />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : searched.length === 0 ? (
        <View style={ui.empty}>
          <Text style={ui.emptyText}>No support requests.</Text>
        </View>
      ) : (
        pagedGrouped.map(([companyId, group]) => (
          <View key={companyId}>
            <Text style={[ui.lede, { marginTop: 14, fontWeight: '600' }]}>
              {group.name} · {group.rows.length}
            </Text>
            {group.rows.map((row) => (
              <RecordRow
                key={row.id}
                title={row.title}
                meta={[day(row.createdAt), row.createdBy?.email]
                  .filter(Boolean)
                  .join(' · ')}
                status={row.status}
                onPress={() =>
                  setSelectedId((id) => (id === row.id ? null : row.id))
                }
              />
            ))}
          </View>
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
          <Text style={ui.cardTitle}>{selected.title}</Text>
          <Text style={ui.cardMeta}>{selected.body}</Text>
          {selected.status === 'open' ? (
            <>
              <Text style={ui.label}>Close note</Text>
              <TextInput
                style={ui.input}
                value={note}
                onChangeText={setNote}
                placeholder="Optional"
                placeholderTextColor={colors.soft}
              />
              <RowActions>
                <ActionButton
                  label={saving ? '…' : 'Close ticket'}
                  tone="danger"
                  disabled={saving}
                  onPress={() => void close()}
                />
              </RowActions>
            </>
          ) : (
            <Text style={ui.cardMeta}>
              Closed{selected.closeNote ? ` · ${selected.closeNote}` : ''}
            </Text>
          )}
        </View>
      ) : null}

      <Toast flash={flash} />
    </ScreenScroll>
  );
}
