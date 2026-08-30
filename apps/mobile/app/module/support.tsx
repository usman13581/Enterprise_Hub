import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiFetch, apiPost, apiUploadImage } from '../../lib/api';
import { day } from '../../lib/format';
import {
  searchItems,
  useFlash,
  usePagination,
} from '../../lib/useCollection';
import { Pagination, SearchBox, Toast } from '../../components/ListControls';
import { ScreenScroll } from '../../components/ScreenScroll';
import { router } from 'expo-router';
import {
  ActionButton,
  FilterChips,
  RecordRow,
  RowActions,
  UploadChip,
} from '../../components/Finance';
import { colors, ui } from '../../lib/ui';

type SupportRow = {
  id: string;
  title: string;
  body: string;
  status: string;
  attachmentUrl: string | null;
  createdAt: string;
  createdByUserId: string;
  createdBy?: { id: string; name: string; email: string } | null;
  closeNote?: string | null;
};

type Session = {
  userId: string;
  companyRole?: 'admin' | 'member';
};

type Filter = 'open' | 'closed' | 'all';

export default function SupportScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<SupportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('open');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { flash, notify } = useFlash();
  const [query, setQuery] = useState('');

  const isAdmin = session?.companyRole === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sess, rows] = await Promise.all([
        apiFetch<Session>('/auth/session'),
        apiFetch<SupportRow[]>('/support/requests'),
      ]);
      setSession(sess);
      const scoped =
        sess.companyRole === 'admin'
          ? rows
          : rows.filter((r) => r.createdByUserId === sess.userId);
      setItems(scoped);
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

  async function pickAttachment() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const uploaded = await apiUploadImage(result.assets[0].uri, {
        purpose: 'support',
      });
      setAttachmentUrl(uploaded.url);
      notify('Screenshot attached');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (saving) return;
    setSaving(true);
    try {
      await apiPost('/support/requests', {
        title,
        body,
        attachmentUrl: attachmentUrl || undefined,
      });
      setTitle('');
      setBody('');
      setAttachmentUrl('');
      await load();
      notify('Support request sent');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSaving(false);
    }
  }

  async function close(id: string) {
    try {
      await apiPost(`/support/requests/${id}/close`, {});
      await load();
      notify('Request closed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Close failed');
    }
  }

  return (
    <ScreenScroll>
      <Text style={ui.title}>Support</Text>
      <Text style={ui.lede}>
        {isAdmin
          ? 'Company tickets. Close when resolved.'
          : 'Your support requests for this company.'}
      </Text>
      <RowActions>
        <ActionButton
          label="Change password"
          tone="ghost"
          onPress={() => router.push('/change-password' as never)}
        />
      </RowActions>
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <View style={ui.card}>
        <Text style={ui.cardTitle}>New request</Text>
        <Text style={ui.label}>Title</Text>
        <TextInput
          style={ui.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Short summary"
          placeholderTextColor={colors.soft}
        />
        <Text style={ui.label}>Details</Text>
        <TextInput
          style={[ui.input, { minHeight: 90, textAlignVertical: 'top' }]}
          value={body}
          onChangeText={setBody}
          multiline
          placeholder="What do you need help with?"
          placeholderTextColor={colors.soft}
        />
        <View style={{ marginTop: 12 }}>
          <UploadChip
            label={attachmentUrl ? 'Replace screenshot' : 'Attach screenshot'}
            busy={uploading}
            onPress={() => void pickAttachment()}
          />
        </View>
        <RowActions>
          <ActionButton
            label={saving ? 'Sending…' : 'Send'}
            tone="primary"
            disabled={saving || !title.trim() || !body.trim()}
            onPress={() => void submit()}
          />
        </RowActions>
      </View>

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
        placeholder="Search support by title, status, or email…"
      />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : searched.length === 0 ? (
        <View style={ui.empty}>
          <Text style={ui.emptyText}>No support requests.</Text>
        </View>
      ) : (
        pager.paged.map((row) => (
          <RecordRow
            key={row.id}
            title={row.title}
            meta={[
              day(row.createdAt),
              row.createdBy?.name,
              row.closeNote ? `Note: ${row.closeNote}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            status={row.status}
          >
            {isAdmin && row.status === 'open' ? (
              <RowActions>
                <ActionButton
                  label="Close"
                  tone="danger"
                  onPress={() => void close(row.id)}
                />
              </RowActions>
            ) : null}
          </RecordRow>
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
      <Toast flash={flash} />
    </ScreenScroll>
  );
}
