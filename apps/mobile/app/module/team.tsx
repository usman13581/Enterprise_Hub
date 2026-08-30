import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { apiFetch, apiPatch } from '../../lib/api';
import { day, label } from '../../lib/format';
import {
  searchItems,
  useFlash,
  usePagination,
} from '../../lib/useCollection';
import { Pagination, SearchBox, Toast } from '../../components/ListControls';
import { ScreenScroll } from '../../components/ScreenScroll';
import { ActionButton, RecordRow, RowActions } from '../../components/Finance';
import { colors, ui } from '../../lib/ui';

type TeamUser = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  companyRole: 'admin' | 'member';
  accessExpiresAt: string | null;
  createdAt: string;
};

export default function TeamScreen() {
  const [items, setItems] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const { flash, notify } = useFlash();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await apiFetch<TeamUser[]>('/company/users');
      setItems(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load team');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleActive(user: TeamUser) {
    try {
      await apiPatch(`/company/users/${user.id}`, { active: !user.active });
      await load();
      notify(user.active ? 'User deactivated' : 'User activated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  const filtered = searchItems(items, query);
  const pager = usePagination(filtered, query);

  return (
    <ScreenScroll>
      <Text style={ui.title}>Team</Text>
      <Text style={ui.lede}>
        Activate or deactivate company users within your seat limit.
      </Text>
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search team by name, email, or role…"
      />
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : filtered.length === 0 ? (
        <View style={ui.empty}>
          <Text style={ui.emptyText}>No users found.</Text>
        </View>
      ) : (
        pager.paged.map((user) => (
          <RecordRow
            key={user.id}
            title={user.name}
            meta={[
              user.email,
              label(user.companyRole),
              user.accessExpiresAt
                ? `access until ${day(user.accessExpiresAt)}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            status={user.active ? 'active' : 'closed'}
          >
            <RowActions>
              <ActionButton
                label={user.active ? 'Deactivate' : 'Activate'}
                tone={user.active ? 'danger' : 'primary'}
                onPress={() => void toggleActive(user)}
              />
            </RowActions>
          </RecordRow>
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
