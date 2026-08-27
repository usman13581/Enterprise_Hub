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
import { useFlash } from '../../lib/useCollection';
import { Toast } from '../../components/ListControls';
import { ScreenScroll } from '../../components/ScreenScroll';
import { ActionButton, RowActions } from '../../components/Finance';
import { colors, ui } from '../../lib/ui';

type Company = { id: string; name: string };

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  audience: string;
  createdAt: string;
  company?: { id: string; name: string } | null;
};

export default function AdminNotificationsScreen() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'company_admins' | 'all_users'>(
    'company_admins',
  );
  const [target, setTarget] = useState<'all' | string>('all');
  const [saving, setSaving] = useState(false);
  const { flash, notify } = useFlash();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, n] = await Promise.all([
        apiFetch<Array<{ id: string; name: string }>>('/admin/companies'),
        apiFetch<NotificationRow[]>('/admin/notifications?limit=50'),
      ]);
      setCompanies(c.map((row) => ({ id: row.id, name: row.name })));
      setItems(n);
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

  async function send() {
    if (saving) return;
    setSaving(true);
    try {
      await apiPost('/admin/notifications', {
        title,
        body,
        audience,
        companyIds: target === 'all' ? 'all' : [target],
      });
      setTitle('');
      setBody('');
      await load();
      notify('Notification sent');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenScroll>
      <Text style={ui.title}>Notifications</Text>
      <Text style={ui.lede}>Broadcast to company admins or all users.</Text>
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <View style={ui.card}>
        <Text style={ui.cardTitle}>Compose</Text>
        <Text style={ui.label}>Title</Text>
        <TextInput
          style={ui.input}
          value={title}
          onChangeText={setTitle}
          placeholderTextColor={colors.soft}
        />
        <Text style={ui.label}>Body</Text>
        <TextInput
          style={[ui.input, { minHeight: 80, textAlignVertical: 'top' }]}
          value={body}
          onChangeText={setBody}
          multiline
          placeholderTextColor={colors.soft}
        />
        <Text style={ui.label}>Audience</Text>
        <View style={styles.picker}>
          {(
            [
              ['company_admins', 'Company admins'],
              ['all_users', 'All users'],
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
        <Text style={ui.label}>Companies</Text>
        <View style={styles.picker}>
          <Pressable
            style={[styles.option, target === 'all' && styles.optionActive]}
            onPress={() => setTarget('all')}
          >
            <Text
              style={[
                styles.optionText,
                target === 'all' && styles.optionTextActive,
              ]}
            >
              All companies
            </Text>
          </Pressable>
          {companies.map((company) => (
            <Pressable
              key={company.id}
              style={[
                styles.option,
                target === company.id && styles.optionActive,
              ]}
              onPress={() => setTarget(company.id)}
            >
              <Text
                style={[
                  styles.optionText,
                  target === company.id && styles.optionTextActive,
                ]}
              >
                {company.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <RowActions>
          <ActionButton
            label={saving ? 'Sending…' : 'Send'}
            tone="primary"
            disabled={saving || !title.trim() || !body.trim()}
            onPress={() => void send()}
          />
        </RowActions>
      </View>

      <Text style={[ui.lede, { marginTop: 12 }]}>Recent</Text>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
      ) : (
        items.map((row) => (
          <View key={row.id} style={styles.row}>
            <Text style={styles.rowTitle}>{row.title}</Text>
            <Text style={styles.rowBody}>{row.body}</Text>
            <Text style={styles.rowMeta}>
              {[
                row.company?.name ?? 'Multi / all',
                row.audience,
                day(row.createdAt),
              ].join(' · ')}
            </Text>
          </View>
        ))
      )}
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
  row: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  rowTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  rowBody: { color: colors.muted, fontSize: 13, marginTop: 3, lineHeight: 18 },
  rowMeta: { color: colors.soft, fontSize: 11, marginTop: 4 },
});
