import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiPost } from '../../lib/api';
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
  FilterChips,
  RowActions,
  StatusPill,
} from '../../components/Finance';
import type { Customer, Invoice, JobListItem } from '../../lib/types';
import { colors, ui } from '../../lib/ui';

type Filter = 'all' | 'issued' | 'cancelled' | 'credit_note';

export default function InvoicesScreen() {
  const { items, loading, error, setError, reload } =
    usePolledList<Invoice>('/invoices');
  const { items: customers } = usePolledList<Customer>('/customers', 20000);
  const { items: jobs } = usePolledList<JobListItem>('/jobs', 20000);
  const { flash, notify } = useFlash();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    customerId: '',
    jobId: '',
    description: 'Custom billing',
    amount: '',
  });

  const filtered = useMemo(() => {
    const byFilter =
      filter === 'all'
        ? items
        : filter === 'credit_note'
          ? items.filter((item) => item.kind === 'credit_note')
          : items.filter((item) => item.status === filter);
    return searchItems(byFilter, query);
  }, [items, filter, query]);
  const pager = usePagination(filtered);

  const eligibleJobs = jobs.filter(
    (job) => job.customerId === draft.customerId && job.status !== 'closed',
  );

  async function save() {
    if (saving || !draft.customerId) return;
    setSaving(true);
    try {
      const net = Number(draft.amount) / 1.05;
      await apiPost('/invoices', {
        kind: 'custom',
        customerId: draft.customerId,
        jobId: draft.jobId || null,
        lines: [
          {
            description: draft.description || 'Custom billing',
            unit: 'job',
            qty: 1,
            unitPrice: Math.round(net * 100) / 100,
            purchasePrice: 0,
          },
        ],
        allocations: [],
      });
      setShowForm(false);
      await reload();
      notify('Invoice issued');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not issue');
    } finally {
      setSaving(false);
    }
  }

  async function cancel(id: string) {
    try {
      await apiPost(`/invoices/${id}/cancel`, {});
      await reload();
      notify('Invoice cancelled', 'danger');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel');
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
        <Text style={ui.title}>Invoices</Text>
        <Text style={ui.lede}>
          UAE tax invoices with 5% VAT. Raise one here or from a job.
        </Text>
        {error ? <Text style={ui.error}>{error}</Text> : null}

        {showForm ? (
          <View style={ui.card}>
            <Text style={ui.cardTitle}>New custom invoice</Text>
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
                    setDraft({ ...draft, customerId: customer.id, jobId: '' })
                  }
                >
                  <Text
                    style={[
                      styles.optionText,
                      draft.customerId === customer.id &&
                        styles.optionTextActive,
                    ]}
                  >
                    {customer.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            {eligibleJobs.length > 0 ? (
              <>
                <Text style={ui.label}>Job (optional)</Text>
                <View style={styles.picker}>
                  <Pressable
                    style={[
                      styles.option,
                      !draft.jobId && styles.optionActive,
                    ]}
                    onPress={() => setDraft({ ...draft, jobId: '' })}
                  >
                    <Text style={styles.optionText}>No job</Text>
                  </Pressable>
                  {eligibleJobs.map((job) => (
                    <Pressable
                      key={job.id}
                      style={[
                        styles.option,
                        draft.jobId === job.id && styles.optionActive,
                      ]}
                      onPress={() => setDraft({ ...draft, jobId: job.id })}
                    >
                      <Text style={styles.optionText}>{job.number}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
            <Text style={ui.label}>Description</Text>
            <TextInput
              style={ui.input}
              value={draft.description}
              onChangeText={(description) =>
                setDraft({ ...draft, description })
              }
            />
            <Text style={ui.label}>Amount customer pays (incl. VAT) *</Text>
            <TextInput
              style={ui.input}
              value={draft.amount}
              onChangeText={(amount) => setDraft({ ...draft, amount })}
              keyboardType="decimal-pad"
            />
            <RowActions>
              <ActionButton
                label={saving ? 'Issuing…' : 'Issue'}
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
              <Text style={ui.count}>{items.length} invoices</Text>
              <Pressable
                style={ui.button}
                onPress={() => setShowForm(true)}
                disabled={customers.length === 0}
              >
                <Text style={ui.buttonText}>New</Text>
              </Pressable>
            </View>

            <FilterChips
              active={filter}
              onChange={setFilter}
              options={[
                { key: 'all', label: 'All' },
                { key: 'issued', label: 'Issued' },
                { key: 'cancelled', label: 'Cancelled' },
                { key: 'credit_note', label: 'Credit notes' },
              ]}
            />

            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder="Search invoices…"
            />

            {filtered.length === 0 ? (
              <View style={ui.empty}>
                <Text style={ui.emptyText}>
                  {items.length === 0
                    ? 'No invoices yet.'
                    : 'No invoices match this filter.'}
                </Text>
              </View>
            ) : (
              pager.paged.map((invoice) => (
                <View key={invoice.id} style={ui.card}>
                  <View style={styles.head}>
                    <Text style={ui.cardTitle}>{invoice.number}</Text>
                    <StatusPill status={invoice.status} />
                  </View>
                  <Text style={ui.cardMeta}>
                    {invoice.customer?.name ?? '—'} · {label(invoice.kind)} ·{' '}
                    {day(invoice.issueDate)}
                  </Text>
                  <Text style={ui.cardMeta}>
                    Total {money(invoice.total)} · advance{' '}
                    {money(invoice.advanceApplied)} · net{' '}
                    {money(invoice.netPayable)}
                  </Text>
                  {invoice.job ? (
                    <Text style={ui.tag}>Job {invoice.job.number}</Text>
                  ) : null}
                  {invoice.status === 'issued' &&
                  invoice.kind !== 'credit_note' ? (
                    <RowActions>
                      <ActionButton
                        label="Cancel"
                        tone="danger"
                        onPress={() => void cancel(invoice.id)}
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
  head: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
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
  optionTextActive: { color: colors.accent, fontWeight: '700' as const },
};
