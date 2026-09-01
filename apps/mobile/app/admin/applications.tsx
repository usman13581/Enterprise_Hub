import { useCallback, useEffect, useState } from 'react';
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
  RecordRow,
  RowActions,
} from '../../components/Finance';
import { colors, ui } from '../../lib/ui';

type Application = {
  id: string;
  legalName: string;
  tradeName: string | null;
  contactName: string;
  email: string;
  phone: string;
  emirate: string;
  status: string;
  createdAt: string;
  needs: string | null;
  note: string | null;
};

type Plan = {
  id: string;
  name: string;
  code: string;
};

export default function AdminApplicationsScreen() {
  const [items, setItems] = useState<Application[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [planId, setPlanId] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [query, setQuery] = useState('');
  const { flash, notify } = useFlash();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, planRows] = await Promise.all([
        apiFetch<Application[]>('/admin/applications'),
        apiFetch<Plan[]>('/admin/plans'),
      ]);
      setItems(rows);
      setPlans(planRows);
      if (!planId && planRows[0]) setPlanId(planRows[0].id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve() {
    if (!approveId || busyId) return;
    setBusyId(approveId);
    try {
      await apiPost(`/admin/applications/${approveId}/approve`, {
        planId,
        ownerPassword,
      });
      setApproveId(null);
      setOwnerPassword('');
      await load();
      notify('Application approved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    if (busyId) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setError('Enter a reject reason first');
      return;
    }
    setBusyId(id);
    try {
      await apiPost(`/admin/applications/${id}/reject`, { reason });
      setRejectReason('');
      await load();
      notify('Application rejected');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setBusyId(null);
    }
  }

  const filtered = searchItems(items, query);
  const pending = filtered.filter((a) => a.status === 'pending');
  const others = filtered.filter((a) => a.status !== 'pending');
  const pendingPager = usePagination(pending, query);
  const othersPager = usePagination(others, query);

  return (
    <ScreenScroll>
      <Text style={ui.title}>Applications</Text>
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search applications by company, contact, email…"
      />

      <View style={ui.card}>
        <Text style={ui.label}>Reject reason (for reject)</Text>
        <TextInput
          style={ui.input}
          value={rejectReason}
          onChangeText={setRejectReason}
          placeholder="Required when rejecting"
          placeholderTextColor={colors.soft}
        />
      </View>

      {approveId ? (
        <View style={ui.card}>
          <Text style={ui.cardTitle}>Approve application</Text>
          <Text style={ui.label}>Plan</Text>
          <View style={{ gap: 6 }}>
            {plans.map((plan) => (
              <ActionButton
                key={plan.id}
                label={`${plan.name} (${plan.code})${planId === plan.id ? ' ✓' : ''}`}
                tone={planId === plan.id ? 'primary' : 'ghost'}
                onPress={() => setPlanId(plan.id)}
              />
            ))}
          </View>
          <Text style={ui.label}>Owner password</Text>
          <TextInput
            style={ui.input}
            secureTextEntry
            value={ownerPassword}
            onChangeText={setOwnerPassword}
            placeholderTextColor={colors.soft}
          />
          <RowActions>
            <ActionButton
              label={busyId === approveId ? 'Approving…' : 'Confirm approve'}
              tone="primary"
              disabled={!!busyId || !planId || !ownerPassword}
              onPress={() => void approve()}
            />
            <ActionButton label="Cancel" onPress={() => setApproveId(null)} />
          </RowActions>
        </View>
      ) : null}

      <Text style={[ui.lede, { marginTop: 8 }]}>Pending</Text>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : pending.length === 0 ? (
        <View style={ui.empty}>
          <Text style={ui.emptyText}>No pending applications.</Text>
        </View>
      ) : (
        pendingPager.paged.map((a) => (
          <RecordRow
            key={a.id}
            title={a.legalName}
            meta={[
              a.contactName,
              a.email,
              a.phone,
              a.emirate,
              day(a.createdAt),
              a.needs,
            ]
              .filter(Boolean)
              .join(' · ')}
            status={a.status}
          >
            <RowActions>
              <ActionButton
                label="Approve"
                tone="primary"
                disabled={!!busyId}
                onPress={() => setApproveId(a.id)}
              />
              <ActionButton
                label="Reject"
                tone="danger"
                disabled={!!busyId}
                onPress={() => void reject(a.id)}
              />
            </RowActions>
          </RecordRow>
        ))
      )}

      {pending.length > 0 ? (
        <Pagination
          page={pendingPager.page}
          setPage={pendingPager.setPage}
          pageSize={pendingPager.pageSize}
          setPageSize={pendingPager.setPageSize}
          pageCount={pendingPager.pageCount}
          total={pendingPager.total}
        />
      ) : null}

      {others.length > 0 ? (
        <>
          <Text style={[ui.lede, { marginTop: 12 }]}>History</Text>
          {othersPager.paged.map((a) => (
            <RecordRow
              key={a.id}
              title={a.legalName}
              meta={[a.email, day(a.createdAt)].join(' · ')}
              status={a.status}
            />
          ))}
          <Pagination
            page={othersPager.page}
            setPage={othersPager.setPage}
            pageSize={othersPager.pageSize}
            setPageSize={othersPager.setPageSize}
            pageCount={othersPager.pageCount}
            total={othersPager.total}
          />
        </>
      ) : null}

      <Toast flash={flash} />
    </ScreenScroll>
  );
}
