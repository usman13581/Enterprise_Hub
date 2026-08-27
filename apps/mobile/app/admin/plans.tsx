import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiFetch, apiPatch, apiPost } from '../../lib/api';
import { money } from '../../lib/format';
import { useFlash } from '../../lib/useCollection';
import { Toast } from '../../components/ListControls';
import { ScreenScroll } from '../../components/ScreenScroll';
import {
  ActionButton,
  RecordRow,
  RowActions,
} from '../../components/Finance';
import { colors, ui } from '../../lib/ui';

type Plan = {
  id: string;
  name: string;
  code: string;
  interval: string;
  priceAed: number;
  trialDays: number;
  maxUsers: number;
  active: boolean;
};

export default function AdminPlansScreen() {
  const [items, setItems] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [priceAed, setPriceAed] = useState('0');
  const [maxUsers, setMaxUsers] = useState('5');
  const [trialDays, setTrialDays] = useState('14');
  const [saving, setSaving] = useState(false);
  const { flash, notify } = useFlash();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await apiFetch<Plan[]>('/admin/plans'));
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

  async function create() {
    if (saving) return;
    setSaving(true);
    try {
      await apiPost('/admin/plans', {
        name,
        code,
        priceAed: Number(priceAed),
        maxUsers: Number(maxUsers),
        trialDays: Number(trialDays),
        interval: 'year',
        active: true,
      });
      setName('');
      setCode('');
      await load();
      notify('Plan created');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(plan: Plan) {
    try {
      await apiPatch(`/admin/plans/${plan.id}`, { active: !plan.active });
      await load();
      notify(plan.active ? 'Plan deactivated' : 'Plan activated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  return (
    <ScreenScroll>
      <Text style={ui.title}>Plans</Text>
      <Text style={ui.lede}>Subscription products offered to companies.</Text>
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <View style={ui.card}>
        <Text style={ui.cardTitle}>New plan</Text>
        <Text style={ui.label}>Name</Text>
        <TextInput
          style={ui.input}
          value={name}
          onChangeText={setName}
          placeholderTextColor={colors.soft}
        />
        <Text style={ui.label}>Code</Text>
        <TextInput
          style={ui.input}
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          placeholderTextColor={colors.soft}
        />
        <Text style={ui.label}>Price AED</Text>
        <TextInput
          style={ui.input}
          value={priceAed}
          onChangeText={setPriceAed}
          keyboardType="decimal-pad"
          placeholderTextColor={colors.soft}
        />
        <Text style={ui.label}>Max users</Text>
        <TextInput
          style={ui.input}
          value={maxUsers}
          onChangeText={setMaxUsers}
          keyboardType="number-pad"
          placeholderTextColor={colors.soft}
        />
        <Text style={ui.label}>Trial days</Text>
        <TextInput
          style={ui.input}
          value={trialDays}
          onChangeText={setTrialDays}
          keyboardType="number-pad"
          placeholderTextColor={colors.soft}
        />
        <RowActions>
          <ActionButton
            label={saving ? 'Saving…' : 'Create'}
            tone="primary"
            disabled={saving || !name.trim() || !code.trim()}
            onPress={() => void create()}
          />
        </RowActions>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        items.map((plan) => (
          <RecordRow
            key={plan.id}
            title={plan.name}
            meta={[
              plan.code,
              money(plan.priceAed),
              `${plan.maxUsers} seats`,
              `${plan.trialDays}d trial`,
              plan.interval,
            ].join(' · ')}
            status={plan.active ? 'active' : 'closed'}
          >
            <RowActions>
              <ActionButton
                label={plan.active ? 'Deactivate' : 'Activate'}
                onPress={() => void toggleActive(plan)}
              />
            </RowActions>
          </RecordRow>
        ))
      )}
      <Toast flash={flash} />
    </ScreenScroll>
  );
}
