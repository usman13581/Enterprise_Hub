import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiFetch, apiPost, apiUploadImage } from '../../lib/api';
import { day, label, money } from '../../lib/format';
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
  StatusPill,
  UploadChip,
} from '../../components/Finance';
import { colors, ui } from '../../lib/ui';
import { clearAuthToken } from '../../lib/auth';
import { router } from 'expo-router';

type Subscription = {
  planName: string;
  planCode: string;
  status: string;
  isDemo: boolean;
  demoCleanupStatus: string | null;
  startsAt: string;
  trialEndsAt: string | null;
  expiresAt: string | null;
  seats: number;
  lastPaymentAmount: number | null;
  lastPaymentAt: string | null;
} | null;

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
};

type Session = {
  companyRole?: 'admin' | 'member';
};

export default function SubscriptionScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [sub, setSub] = useState<Subscription>(null);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [bankReference, setBankReference] = useState('');
  const [notes, setNotes] = useState('');
  const [depositUrl, setDepositUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const { flash, notify } = useFlash();

  const isAdmin = session?.companyRole === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sess, subscription] = await Promise.all([
        apiFetch<Session>('/auth/session'),
        apiFetch<Subscription>('/company/subscription'),
      ]);
      setSession(sess);
      setSub(subscription);
      if (sess.companyRole === 'admin') {
        const rows = await apiFetch<Renewal[]>(
          '/company/subscription/renewal-requests',
        );
        setRenewals(rows);
      } else {
        setRenewals([]);
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

  async function pickDeposit() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const uploaded = await apiUploadImage(result.assets[0].uri, {
        purpose: 'deposit',
      });
      setDepositUrl(uploaded.url);
      notify('Deposit slip uploaded');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function submitRenewal() {
    if (saving) return;
    setSaving(true);
    try {
      await apiPost('/company/subscription/renewal-requests', {
        amount: Number(amount),
        paidAt,
        bankReference: bankReference || undefined,
        notes: notes || undefined,
        depositDocumentUrl: depositUrl,
      });
      setAmount('');
      setBankReference('');
      setNotes('');
      setDepositUrl('');
      await load();
      notify('Renewal request submitted');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSaving(false);
    }
  }

  function cancelTrial() {
    if (!sub?.isDemo || sub.status !== 'trial' || saving) return;
    Alert.alert(
      'Cancel trial?',
      'All company data will be permanently removed. The inactive registration will be retained.',
      [
        { text: 'Keep trial', style: 'cancel' },
        {
          text: 'Cancel trial',
          style: 'destructive',
          onPress: () => {
            setSaving(true);
            void apiPost('/company/subscription/cancel-trial', {})
              .then(async () => {
                await clearAuthToken();
                router.replace('/login' as never);
              })
              .catch((e) => {
                setError(e instanceof Error ? e.message : 'Cancellation failed');
              })
              .finally(() => setSaving(false));
          },
        },
      ],
    );
  }

  const pending = renewals.find((r) => r.status === 'pending');
  const filteredRenewals = searchItems(renewals, query);
  const renewalPager = usePagination(filteredRenewals, query);

  return (
    <ScreenScroll>
      <Text style={ui.title}>Subscription</Text>
      <Text style={ui.lede}>
        Plan dates and seats for this company.
        {isAdmin ? ' Admins can submit a bank-deposit renewal.' : ''}
      </Text>
      {error ? <Text style={ui.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <View style={ui.card}>
          <Text style={ui.cardTitle}>{sub?.planName ?? 'No plan'}</Text>
          <Text style={ui.cardMeta}>
            {[
              sub ? label(sub.status) : null,
              sub?.planCode,
              sub ? `${sub.seats} seats` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <Text style={ui.cardMeta}>Starts {day(sub?.startsAt)}</Text>
          {sub?.trialEndsAt ? (
            <Text style={ui.cardMeta}>Trial ends {day(sub.trialEndsAt)}</Text>
          ) : null}
          <Text style={ui.cardMeta}>Expires {day(sub?.expiresAt)}</Text>
          {sub?.lastPaymentAt ? (
            <Text style={ui.cardMeta}>
              Last payment {money(sub.lastPaymentAmount)} on{' '}
              {day(sub.lastPaymentAt)}
            </Text>
          ) : null}
        </View>
      )}

      {pending ? (
        <View style={ui.card}>
          <Text style={ui.cardTitle}>Pending renewal</Text>
          <Text style={ui.cardMeta}>
            {money(pending.amount)} · paid {day(pending.paidAt)}
          </Text>
          <StatusPill status={pending.status} />
        </View>
      ) : null}

      {isAdmin && sub?.isDemo && sub.status === 'trial' ? (
        <View style={ui.card}>
          <Text style={ui.cardTitle}>Cancel trial</Text>
          <Text style={ui.cardMeta}>
            This permanently removes the demo company and its data. The
            inactive registration is retained.
          </Text>
          <RowActions>
            <ActionButton
              label={saving ? 'Cancelling…' : 'Cancel trial'}
              tone="danger"
              disabled={saving}
              onPress={cancelTrial}
            />
          </RowActions>
        </View>
      ) : null}

      {isAdmin && !pending ? (
        <View style={ui.card}>
          <Text style={ui.cardTitle}>Renew</Text>
          <Text style={ui.label}>Amount (AED)</Text>
          <TextInput
            style={ui.input}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={colors.soft}
          />
          <Text style={ui.label}>Deposit date (YYYY-MM-DD)</Text>
          <TextInput
            style={ui.input}
            value={paidAt}
            onChangeText={setPaidAt}
            placeholder="2026-01-15"
            placeholderTextColor={colors.soft}
            autoCapitalize="none"
          />
          <Text style={ui.label}>Bank reference</Text>
          <TextInput
            style={ui.input}
            value={bankReference}
            onChangeText={setBankReference}
            placeholder="Optional"
            placeholderTextColor={colors.soft}
          />
          <Text style={ui.label}>Notes</Text>
          <TextInput
            style={[ui.input, { minHeight: 72, textAlignVertical: 'top' }]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Optional"
            placeholderTextColor={colors.soft}
          />
          <View style={{ marginTop: 12 }}>
            <UploadChip
              label={depositUrl ? 'Replace deposit slip' : 'Attach deposit slip'}
              busy={uploading}
              onPress={() => void pickDeposit()}
            />
            {depositUrl ? (
              <Text style={ui.cardMeta}>Attached · {depositUrl}</Text>
            ) : null}
          </View>
          <RowActions>
            <ActionButton
              label={saving ? 'Submitting…' : 'Submit renewal'}
              tone="primary"
              disabled={saving || !amount || !paidAt || !depositUrl}
              onPress={() => void submitRenewal()}
            />
          </RowActions>
        </View>
      ) : null}

      {isAdmin && renewals.length > 0 ? (
        <>
          <Text style={[ui.lede, { marginTop: 16 }]}>Renewal history</Text>
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search renewal history…"
          />
          {renewalPager.paged.map((row) => (
            <RecordRow
              key={row.id}
              title={money(row.amount)}
              meta={[
                day(row.paidAt),
                row.bankReference,
                row.rejectReason ? `Rejected: ${row.rejectReason}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              status={row.status}
            />
          ))}
          <Pagination
            page={renewalPager.page}
            setPage={renewalPager.setPage}
            pageSize={renewalPager.pageSize}
            setPageSize={renewalPager.setPageSize}
            pageCount={renewalPager.pageCount}
            total={renewalPager.total}
          />
        </>
      ) : null}

      <Toast flash={flash} />
    </ScreenScroll>
  );
}
