import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiFetch, apiPatch, apiPost } from '../../../lib/api';
import { day, label } from '../../../lib/format';
import { useFlash } from '../../../lib/useCollection';
import { Toast } from '../../../components/ListControls';
import { ScreenScroll } from '../../../components/ScreenScroll';
import {
  ActionButton,
  RecordRow,
  RowActions,
} from '../../../components/Finance';
import { colors, ui } from '../../../lib/ui';
import { beginReadOnlyWorkspace } from '../../../lib/auth';

type CompanyDetail = {
  id: string;
  name: string;
  slug: string;
  suspendedAt: string | null;
  industryCategoryId: string | null;
  subscription?: {
    status: string;
    startsAt: string;
    trialEndsAt: string | null;
    expiresAt: string | null;
    seatsIncluded: number;
    seatsOverride: number | null;
    plan?: { id: string; name: string; code: string } | null;
  } | null;
};

type CompanyUser = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  companyRole: 'admin' | 'member';
  accessExpiresAt: string | null;
};

type Plan = {
  id: string;
  name: string;
  code: string;
  active: boolean;
};

type IndustryCategory = {
  id: string;
  name: string;
  code: string;
};

export default function AdminCompanyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [categories, setCategories] = useState<IndustryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<'admin' | 'member'>('member');
  const [planId, setPlanId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payReference, setPayReference] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const { flash, notify } = useFlash();

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [c, u, p, cats] = await Promise.all([
        apiFetch<CompanyDetail>(`/admin/companies/${id}`),
        apiFetch<CompanyUser[]>(`/admin/companies/${id}/users`),
        apiFetch<Plan[]>('/admin/plans'),
        apiFetch<IndustryCategory[]>('/admin/industry-categories'),
      ]);
      setCompany(c);
      setUsers(u);
      setPlans(p.filter((row) => row.active));
      setCategories(cats);
      setCategoryId(c.industryCategoryId ?? '');
      setPlanId(c.subscription?.plan?.id ?? '');
      setExpiresAt(
        c.subscription?.expiresAt
          ? c.subscription.expiresAt.slice(0, 10)
          : '',
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleSuspend() {
    if (!company) return;
    try {
      await apiPost(
        `/admin/companies/${company.id}/${company.suspendedAt ? 'unsuspend' : 'suspend'}`,
        {},
      );
      await load();
      notify(company.suspendedAt ? 'Unsuspended' : 'Suspended');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    }
  }

  async function saveCategory() {
    if (!id || saving) return;
    setSaving(true);
    try {
      await apiPatch(`/admin/companies/${id}`, {
        industryCategoryId: categoryId || null,
      });
      await load();
      notify('Category saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Category update failed');
    } finally {
      setSaving(false);
    }
  }

  async function openWorkspace() {
    if (!id || saving) return;
    setSaving(true);
    try {
      const result = await apiPost<{ token: string }>(
        `/admin/companies/${id}/workspace`,
        {},
      );
      await beginReadOnlyWorkspace(result.token);
      router.replace('/' as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Workspace access failed');
    } finally {
      setSaving(false);
    }
  }

  async function createUser() {
    if (!id || saving) return;
    setSaving(true);
    try {
      await apiPost(`/admin/companies/${id}/users`, {
        name: userName,
        email: userEmail,
        password: userPassword,
        companyRole: userRole,
      });
      setUserName('');
      setUserEmail('');
      setUserPassword('');
      await load();
      notify('User created');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create user failed');
    } finally {
      setSaving(false);
    }
  }

  async function patchUser(
    userId: string,
    body: { active?: boolean; companyRole?: 'admin' | 'member' },
  ) {
    try {
      await apiPatch(`/admin/users/${userId}`, body);
      await load();
      notify('User updated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function saveSubscription() {
    if (!id || !planId) return;
    try {
      await apiPatch(`/admin/companies/${id}/subscription`, {
        planId,
        expiresAt: expiresAt || undefined,
        status: 'active',
      });
      await load();
      notify('Subscription saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Subscription failed');
    }
  }

  async function recordPayment() {
    if (!id) return;
    try {
      await apiPost(`/admin/companies/${id}/subscription/manual-payment`, {
        amount: Number(payAmount),
        paidAt: payDate,
        reference: payReference || undefined,
        extendExpiresAt: expiresAt || undefined,
      });
      setPayAmount('');
      setPayReference('');
      await load();
      notify('Payment recorded');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed');
    }
  }

  if (loading) {
    return (
      <ScreenScroll>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      </ScreenScroll>
    );
  }

  if (!company) {
    return (
      <ScreenScroll>
        <Text style={ui.error}>{error || 'Company not found'}</Text>
      </ScreenScroll>
    );
  }

  const seats =
    company.subscription?.seatsOverride ??
    company.subscription?.seatsIncluded ??
    0;

  return (
    <ScreenScroll>
      <Text style={ui.title}>{company.name}</Text>
      <Text style={ui.lede}>
        {company.slug}
        {company.suspendedAt ? ' · suspended' : ''}
      </Text>
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <RowActions>
        <ActionButton
          label="Open application (read-only)"
          tone="primary"
          disabled={saving}
          onPress={() => void openWorkspace()}
        />
      </RowActions>

      <View style={ui.card}>
        <Text style={ui.cardTitle}>Industry category</Text>
        <Text style={ui.label}>Category</Text>
        <View style={{ gap: 6 }}>
          <ActionButton
            label={!categoryId ? 'None' : categories.find((row) => row.id === categoryId)?.name ?? 'Selected'}
            tone={!categoryId ? 'ghost' : 'primary'}
            onPress={() => setCategoryId('')}
          />
          {categories.map((category) => (
            <ActionButton
              key={category.id}
              label={`${category.name} (${category.code})${categoryId === category.id ? ' ✓' : ''}`}
              tone={categoryId === category.id ? 'primary' : 'ghost'}
              onPress={() => setCategoryId(category.id)}
            />
          ))}
        </View>
        <RowActions>
          <ActionButton
            label="Save category"
            tone="primary"
            disabled={saving}
            onPress={() => void saveCategory()}
          />
        </RowActions>
      </View>

      <View style={ui.card}>
        <Text style={ui.cardTitle}>Subscription</Text>
        <Text style={ui.cardMeta}>
          {[
            company.subscription?.plan?.name,
            company.subscription
              ? label(company.subscription.status)
              : 'none',
            `${seats} seats`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <Text style={ui.cardMeta}>
          Expires {day(company.subscription?.expiresAt)}
        </Text>
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
        <Text style={ui.label}>Expires (YYYY-MM-DD)</Text>
        <TextInput
          style={ui.input}
          value={expiresAt}
          onChangeText={setExpiresAt}
          autoCapitalize="none"
          placeholderTextColor={colors.soft}
        />
        <RowActions>
          <ActionButton
            label="Save subscription"
            tone="primary"
            onPress={() => void saveSubscription()}
          />
          <ActionButton
            label={company.suspendedAt ? 'Unsuspend' : 'Suspend'}
            tone="danger"
            onPress={() => void toggleSuspend()}
          />
        </RowActions>
      </View>

      <View style={ui.card}>
        <Text style={ui.cardTitle}>Manual payment</Text>
        <Text style={ui.label}>Amount</Text>
        <TextInput
          style={ui.input}
          value={payAmount}
          onChangeText={setPayAmount}
          keyboardType="decimal-pad"
          placeholderTextColor={colors.soft}
        />
        <Text style={ui.label}>Paid at</Text>
        <TextInput
          style={ui.input}
          value={payDate}
          onChangeText={setPayDate}
          autoCapitalize="none"
          placeholderTextColor={colors.soft}
        />
        <Text style={ui.label}>Reference</Text>
        <TextInput
          style={ui.input}
          value={payReference}
          onChangeText={setPayReference}
          placeholder="Optional"
          placeholderTextColor={colors.soft}
        />
        <RowActions>
          <ActionButton
            label="Record payment"
            tone="primary"
            disabled={!payAmount}
            onPress={() => void recordPayment()}
          />
        </RowActions>
      </View>

      <Text style={[ui.lede, { marginTop: 12 }]}>Users</Text>
      {users.map((user) => (
        <RecordRow
          key={user.id}
          title={user.name}
          meta={[
            user.email,
            label(user.companyRole),
            user.accessExpiresAt
              ? `until ${day(user.accessExpiresAt)}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          status={user.active ? 'active' : 'closed'}
        >
          <RowActions>
            <ActionButton
              label={user.active ? 'Deactivate' : 'Activate'}
              onPress={() =>
                void patchUser(user.id, { active: !user.active })
              }
            />
            <ActionButton
              label={
                user.companyRole === 'admin' ? 'Make member' : 'Make admin'
              }
              onPress={() =>
                void patchUser(user.id, {
                  companyRole:
                    user.companyRole === 'admin' ? 'member' : 'admin',
                })
              }
            />
          </RowActions>
        </RecordRow>
      ))}

      <View style={ui.card}>
        <Text style={ui.cardTitle}>Add user</Text>
        <Text style={ui.label}>Name</Text>
        <TextInput
          style={ui.input}
          value={userName}
          onChangeText={setUserName}
          placeholderTextColor={colors.soft}
        />
        <Text style={ui.label}>Email</Text>
        <TextInput
          style={ui.input}
          value={userEmail}
          onChangeText={setUserEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor={colors.soft}
        />
        <Text style={ui.label}>Password</Text>
        <TextInput
          style={ui.input}
          value={userPassword}
          onChangeText={setUserPassword}
          secureTextEntry
          placeholderTextColor={colors.soft}
        />
        <RowActions>
          <ActionButton
            label={userRole === 'admin' ? 'Role: admin' : 'Role: member'}
            onPress={() =>
              setUserRole((r) => (r === 'admin' ? 'member' : 'admin'))
            }
          />
          <ActionButton
            label={saving ? 'Saving…' : 'Create user'}
            tone="primary"
            disabled={saving || !userName || !userEmail || !userPassword}
            onPress={() => void createUser()}
          />
        </RowActions>
      </View>

      <Toast flash={flash} />
    </ScreenScroll>
  );
}
