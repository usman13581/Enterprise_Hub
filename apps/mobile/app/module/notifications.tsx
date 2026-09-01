import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
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
import { ActionButton, RowActions } from '../../components/Finance';
import { colors, ui } from '../../lib/ui';

type Receipt = {
  id: string;
  readAt: string | null;
  createdAt: string;
  notification: {
    id: string;
    title: string;
    body: string;
    kind: string;
    source: string;
    createdAt: string;
  };
};

type Session = {
  companyRole?: 'admin' | 'member';
};

type TeamUser = {
  id: string;
  name: string;
  email: string;
  active: boolean;
};

export default function NotificationsScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<Receipt[]>([]);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all_users' | 'one_user'>(
    'all_users',
  );
  const [userId, setUserId] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const { flash, notify } = useFlash();

  const isAdmin = session?.companyRole === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sess, rows] = await Promise.all([
        apiFetch<Session>('/auth/session'),
        apiFetch<Receipt[]>('/notifications'),
      ]);
      setSession(sess);
      setItems(rows);
      if (sess.companyRole === 'admin') {
        const team = await apiFetch<TeamUser[]>('/company/users');
        setUsers(team.filter((u) => u.active));
      }
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

  async function markRead(notificationId: string) {
    try {
      await apiPost(`/notifications/${notificationId}/read`, {});
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not mark read');
    }
  }

  async function compose() {
    if (saving) return;
    setSaving(true);
    try {
      await apiPost('/notifications', {
        title,
        body,
        audience,
        userId: audience === 'one_user' ? userId : undefined,
      });
      setTitle('');
      setBody('');
      setUserId('');
      setAudience('all_users');
      await load();
      notify('Notification sent');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSaving(false);
    }
  }

  const filtered = searchItems(items, query);
  const pager = usePagination(filtered, query);

  return (
    <ScreenScroll>
      <Text style={ui.title}>Notifications</Text>
      {error ? <Text style={ui.error}>{error}</Text> : null}

      {isAdmin ? (
        <View style={ui.card}>
          <Text style={ui.cardTitle}>Send to team</Text>
          <Text style={ui.label}>Title</Text>
          <TextInput
            style={ui.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Subject"
            placeholderTextColor={colors.soft}
          />
          <Text style={ui.label}>Message</Text>
          <TextInput
            style={[ui.input, { minHeight: 80, textAlignVertical: 'top' }]}
            value={body}
            onChangeText={setBody}
            multiline
            placeholder="Details"
            placeholderTextColor={colors.soft}
          />
          <Text style={ui.label}>Audience</Text>
          <View style={styles.picker}>
            {(
              [
                ['all_users', 'All users'],
                ['one_user', 'One user'],
              ] as const
            ).map(([value, labelText]) => (
              <Pressable
                key={value}
                style={[
                  styles.option,
                  audience === value && styles.optionActive,
                ]}
                onPress={() => setAudience(value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    audience === value && styles.optionTextActive,
                  ]}
                >
                  {labelText}
                </Text>
              </Pressable>
            ))}
          </View>
          {audience === 'one_user' ? (
            <View style={styles.picker}>
              {users.map((user) => (
                <Pressable
                  key={user.id}
                  style={[
                    styles.option,
                    userId === user.id && styles.optionActive,
                  ]}
                  onPress={() => setUserId(user.id)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      userId === user.id && styles.optionTextActive,
                    ]}
                  >
                    {user.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <RowActions>
            <ActionButton
              label={saving ? 'Sending…' : 'Send'}
              tone="primary"
              disabled={
                saving ||
                !title.trim() ||
                !body.trim() ||
                (audience === 'one_user' && !userId)
              }
              onPress={() => void compose()}
            />
          </RowActions>
        </View>
      ) : null}

      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search notifications by title or message…"
      />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : filtered.length === 0 ? (
        <View style={ui.empty}>
          <Text style={ui.emptyText}>No notifications yet.</Text>
        </View>
      ) : (
        pager.paged.map((row) => (
          <Pressable
            key={row.id}
            style={[styles.row, !row.readAt && styles.unread]}
            onPress={() => {
              if (!row.readAt) void markRead(row.notification.id);
            }}
          >
            <Text style={styles.rowTitle}>{row.notification.title}</Text>
            <Text style={styles.rowBody}>{row.notification.body}</Text>
            <Text style={styles.rowMeta}>
              {day(row.notification.createdAt)}
              {row.readAt ? '' : ' · unread'}
            </Text>
          </Pressable>
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

const styles = StyleSheet.create({
  picker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(20,32,43,0.14)',
    backgroundColor: '#fff',
  },
  optionActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  optionText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  optionTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  row: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  unread: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  rowBody: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  rowMeta: {
    color: colors.soft,
    fontSize: 11,
    marginTop: 4,
  },
});
