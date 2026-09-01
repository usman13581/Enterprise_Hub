import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  searchItems,
  usePagination,
  usePolledList,
} from '../../lib/useCollection';
import { Pagination, SearchBox } from '../../components/ListControls';
import { ScreenScroll } from '../../components/ScreenScroll';
import { colors, ui } from '../../lib/ui';

type AuditRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
  actorName?: string | null;
  actorEmail?: string | null;
};

export default function AuditScreen() {
  const { items, loading, error } = usePolledList<AuditRow>('/audit?limit=200');
  const [query, setQuery] = useState('');
  const filtered = searchItems(items, query);
  const pager = usePagination(filtered, query);

  return (
    <ScreenScroll>
      <Text style={ui.title}>Audit</Text>

      {error ? <Text style={ui.error}>{error}</Text> : null}

      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search action, entity, or actor…"
      />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : filtered.length === 0 ? (
        <View style={ui.empty}>
          <Text style={ui.emptyText}>
            {query ? 'No entries match your search.' : 'No audit entries yet.'}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {pager.paged.map((row) => {
            const actor =
              row.actorName || row.actorEmail || 'System';
            return (
              <View key={row.id} style={styles.row}>
                <Text style={styles.title} numberOfLines={1}>
                  {row.action} · {row.entityType}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {actor} · {row.entityId.slice(0, 8)} ·{' '}
                  {new Date(row.createdAt).toLocaleString()}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <Pagination
        page={pager.page}
        setPage={pager.setPage}
        pageSize={pager.pageSize}
        setPageSize={pager.setPageSize}
        pageCount={pager.pageCount}
        total={pager.total}
      />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  row: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  title: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  meta: {
    color: colors.soft,
    fontSize: 11,
    marginTop: 2,
  },
});
