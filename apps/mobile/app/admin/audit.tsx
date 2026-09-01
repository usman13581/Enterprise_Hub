import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { apiFetch } from '../../lib/api';
import {
  searchItems,
  usePagination,
} from '../../lib/useCollection';
import { Pagination, SearchBox } from '../../components/ListControls';
import { ScreenScroll } from '../../components/ScreenScroll';
import { colors, ui } from '../../lib/ui';

type Company = { id: string; name: string };

type AuditRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
  actorName?: string | null;
  actorEmail?: string | null;
};

export default function AdminAuditScreen() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string>('');
  const [items, setItems] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const rows = await apiFetch<Array<{ id: string; name: string }>>(
          '/admin/companies',
        );
        setCompanies(rows.map((r) => ({ id: r.id, name: r.name })));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load companies');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadAudit = useCallback(async (id: string) => {
    if (!id) {
      setItems([]);
      return;
    }
    setLoadingAudit(true);
    try {
      const rows = await apiFetch<AuditRow[]>(
        `/admin/audit?companyId=${encodeURIComponent(id)}&limit=200`,
      );
      setItems(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit');
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  useEffect(() => {
    void loadAudit(companyId);
  }, [companyId, loadAudit]);

  const filtered = searchItems(items, query);
  const pager = usePagination(filtered, query);

  return (
    <ScreenScroll>
      <Text style={ui.title}>Audit</Text>
      {error ? <Text style={ui.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <View style={styles.picker}>
          {companies.map((company) => (
            <Pressable
              key={company.id}
              style={[
                styles.option,
                companyId === company.id && styles.optionActive,
              ]}
              onPress={() => setCompanyId(company.id)}
            >
              <Text
                style={[
                  styles.optionText,
                  companyId === company.id && styles.optionTextActive,
                ]}
              >
                {company.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {!companyId ? (
        <View style={ui.empty}>
          <Text style={ui.emptyText}>Select a company above.</Text>
        </View>
      ) : (
        <>
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search action, entity, or actor…"
          />
          {loadingAudit ? (
            <ActivityIndicator
              color={colors.accent}
              style={{ marginTop: 24 }}
            />
          ) : filtered.length === 0 ? (
            <View style={ui.empty}>
              <Text style={ui.emptyText}>No audit entries.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {pager.paged.map((row) => {
                const actor = row.actorName || row.actorEmail || 'System';
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
        </>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  picker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  option: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(20,32,43,0.14)',
    backgroundColor: '#fff',
  },
  optionActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  optionText: { color: colors.muted, fontSize: 12, fontWeight: '500' },
  optionTextActive: { color: colors.accent, fontWeight: '700' },
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
