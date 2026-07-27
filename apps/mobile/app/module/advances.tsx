import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiDelete, apiPost } from '../../lib/api';
import { day, label, money } from '../../lib/format';
import {
  searchItems,
  useFlash,
  usePagination,
  usePolledList,
} from '../../lib/useCollection';
import { Pagination, SearchBox, Toast } from '../../components/ListControls';
import {
  ActionButton,
  RowActions,
  StatCard,
} from '../../components/Finance';
import type { AdvancePayment, Customer } from '../../lib/types';
import { colors, ui } from '../../lib/ui';

export default function AdvancesScreen() {
  const { items, loading, error, setError, reload } =
    usePolledList<AdvancePayment>('/advances');
  const { items: customers } = usePolledList<Customer>('/customers', 20000);
  const { flash, notify } = useFlash();
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    customerId: '',
    amount: '',
    method: 'cash',
    notes: '',
  });

  const filtered = useMemo(() => searchItems(items, query), [items, query]);
  const pager = usePagination(filtered);
  const totals = useMemo(
    () =>
      items.reduce(
        (acc, advance) => ({
          received: acc.received + advance.amount,
          spare: acc.spare + advance.unallocatedAmount,
        }),
        { received: 0, spare: 0 },
      ),
    [items],
  );

  async function save() {
    if (saving || !draft.customerId) return;
    setSaving(true);
    try {
      await apiPost('/advances', {
        customerId: draft.customerId,
        amount: Number(draft.amount),
        method: draft.method,
        notes: draft.notes,
      });
      setShowForm(false);
      setDraft({ customerId: '', amount: '', method: 'cash', notes: '' });
      await reload();
      notify('Advance recorded');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  if (loading && items.length === 0) {
    return (
      <View style={[ui.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content}>
        <Text style={ui.title}>Advances</Text>
        <Text style={ui.lede}>
          Money received before invoicing. Recording credits the customer
          immediately.
        </Text>
        {error ? <Text style={ui.error}>{error}</Text> : null}

        <View style={styles.stats}>
          <StatCard title="Received" value={money(totals.received)} />
          <StatCard title="Not yet applied" value={money(totals.spare)} />
        </View>

        {showForm ? (
          <View style={ui.card}>
            <Text style={ui.cardTitle}>Record advance</Text>
            <Text style={ui.label}>Customer *</Text>
            <View style={styles.picker}>
              {customers.map((customer) => (
                <Pressable
                  key={customer.id}
                  style={[
                    styles.option,
                    draft.customerId === customer.id && styles.optionActive,
                  ]}
                  onPress={() =>
                    setDraft({ ...draft, customerId: customer.id })
                  }
                >
                  <Text style={styles.optionText}>{customer.name}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={ui.label}>Amount *</Text>
            <TextInput
              style={ui.input}
              value={draft.amount}
              onChangeText={(amount) => setDraft({ ...draft, amount })}
              keyboardType="decimal-pad"
            />
            <Text style={ui.label}>Notes</Text>
            <TextInput
              style={ui.input}
              value={draft.notes}
              onChangeText={(notes) => setDraft({ ...draft, notes })}
            />
            <RowActions>
              <ActionButton
                label={saving ? 'Saving…' : 'Record'}
                tone="primary"
                disabled={saving}
                onPress={() => void save()}
              />
              <ActionButton label="Cancel" onPress={() => setShowForm(false)} />
            </RowActions>
          </View>
        ) : (
          <>
            <View style={ui.toolbar}>
              <Text style={ui.count}>{items.length} receipts</Text>
              <Pressable
                style={ui.button}
                onPress={() => setShowForm(true)}
                disabled={customers.length === 0}
              >
                <Text style={ui.buttonText}>Record</Text>
              </Pressable>
            </View>

            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder="Search advances…"
            />

            {filtered.length === 0 ? (
              <View style={ui.empty}>
                <Text style={ui.emptyText}>
                  {items.length === 0
                    ? 'No advances recorded yet.'
                    : 'No advances match your search.'}
                </Text>
              </View>
            ) : (
              pager.paged.map((advance) => (
                <View key={advance.id} style={ui.card}>
                  <Text style={ui.cardTitle}>{advance.number}</Text>
                  <Text style={ui.cardMeta}>
                    {advance.customer?.name ?? '—'} · {day(advance.receivedAt)}{' '}
                    · {label(advance.method)}
                  </Text>
                  <Text style={ui.cardMeta}>
                    {money(advance.amount)} · spare{' '}
                    {money(advance.unallocatedAmount)}
                  </Text>
                  {advance.job ? (
                    <Text style={ui.tag}>Job {advance.job.number}</Text>
                  ) : null}
                  {advance.allocatedAmount === 0 ? (
                    <RowActions>
                      <ActionButton
                        label="Delete"
                        tone="danger"
                        onPress={() =>
                          void apiDelete(`/advances/${advance.id}`)
                            .then(() => reload())
                            .then(() => notify('Deleted', 'danger'))
                            .catch((e) =>
                              setError(
                                e instanceof Error
                                  ? e.message
                                  : 'Delete failed',
                              ),
                            )
                        }
                      />
                    </RowActions>
                  ) : null}
                </View>
              ))
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
      </ScrollView>
      <Toast flash={flash} />
    </View>
  );
}

const styles = {
  stats: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  picker: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 6,
  },
  option: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(20,32,43,0.14)',
    backgroundColor: colors.surface,
  },
  optionActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  optionText: { color: colors.muted, fontSize: 13 },
};
