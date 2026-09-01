import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { computeInvoiceTotals } from '@marble/domain';
import { apiPost } from '../../lib/api';
import { dueDateIso } from '../../lib/dates';
import { amount, day, label } from '../../lib/format';
import {
  searchItems,
  useFlash,
  usePagination,
  usePolledList,
} from '../../lib/useCollection';
import { Pagination, SearchBox, Toast } from '../../components/ListControls';
import { ScreenScroll } from '../../components/ScreenScroll';
import {
  ActionButton,
  FilterChips,
  LinkAction,
  RecordRow,
  RowActions,
} from '../../components/Finance';
import { FormField, FormPicker } from '../../components/FormField';
import { SearchablePicker } from '../../components/SearchablePicker';
import {
  AllocationPicker,
  CreditNoteForm,
  EMPTY_INVOICE_LINE,
  InvoiceLineEditor,
  allocationPayload,
  invoiceLinePayload,
  type InvoiceLineDraft,
} from '../../components/MoneyForms';
import {
  discountPayload,
  EMPTY_DISCOUNT,
  type DiscountDraft,
} from '../../components/DiscountInput';
import type { Customer, Invoice, JobListItem } from '../../lib/types';
import { colors, ui } from '../../lib/ui';

type Filter = 'all' | 'draft' | 'issued' | 'cancelled' | 'credit_note';
type Kind = 'progressive' | 'custom' | 'final';

type Draft = {
  kind: Kind;
  customerId: string;
  jobId: string;
  dueDate: string;
  notes: string;
  lines: InvoiceLineDraft[];
  documentDiscount: DiscountDraft;
};

const EMPTY: Draft = {
  kind: 'custom',
  customerId: '',
  jobId: '',
  dueDate: dueDateIso(),
  notes: '',
  lines: [{ ...EMPTY_INVOICE_LINE }],
  documentDiscount: { ...EMPTY_DISCOUNT },
};

export default function InvoicesScreen() {
  const router = useRouter();
  const { items, loading, error, setError, reload } =
    usePolledList<Invoice>('/invoices');
  const { items: customers } = usePolledList<Customer>('/customers', 20000);
  const { items: jobs } = usePolledList<JobListItem>('/jobs', 20000);
  const { flash, notify } = useFlash();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [creditFor, setCreditFor] = useState<Invoice | null>(null);

  const filtered = useMemo(() => {
    const byFilter =
      filter === 'all'
        ? items
        : filter === 'credit_note'
          ? items.filter((item) => item.kind === 'credit_note')
          : items.filter((item) => item.status === filter);
    return searchItems(byFilter, query);
  }, [items, filter, query]);
  const pager = usePagination(filtered, `${filter}:${query}`);

  const eligibleJobs = jobs.filter(
    (job) => job.customerId === draft.customerId && job.status !== 'closed',
  );
  const invoiceTotal = computeInvoiceTotals(
    invoiceLinePayload(draft.lines),
    allocationPayload(allocations).reduce(
      (total, entry) => total + entry.amount,
      0,
    ),
    discountPayload(draft.documentDiscount),
  ).total;

  function startCreate() {
    setDraft({
      ...EMPTY,
      dueDate: dueDateIso(),
      lines: [{ ...EMPTY_INVOICE_LINE }],
    });
    setAllocations({});
    setShowForm(true);
  }

  async function save() {
    if (saving || !draft.customerId) return;
    setSaving(true);
    try {
      await apiPost('/invoices', {
        kind: draft.kind,
        customerId: draft.customerId,
        jobId: draft.jobId || null,
        dueDate: draft.dueDate || null,
        notes: draft.notes,
        ...discountPayload(draft.documentDiscount),
        lines: invoiceLinePayload(draft.lines),
        allocations: allocationPayload(allocations),
      });
      setShowForm(false);
      await reload();
      notify('Invoice saved as draft');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not issue');
    } finally {
      setSaving(false);
    }
  }

  async function issue(id: string) {
    try {
      await apiPost(`/invoices/${id}/issue`, {});
      await reload();
      notify('Invoice issued');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not issue');
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
      <ScreenScroll>
        <Text style={ui.title}>Invoices</Text>
        {error ? <Text style={ui.error}>{error}</Text> : null}

        {creditFor ? (
          <CreditNoteForm
            invoice={creditFor}
            onSaved={async () => {
              setCreditFor(null);
              await reload();
              notify('Credit note issued');
            }}
            onError={setError}
            onCancel={() => setCreditFor(null)}
          />
        ) : showForm ? (
          <View style={ui.card}>
            <Text style={ui.cardTitle}>New invoice</Text>
            <Text style={ui.label}>Kind</Text>
            <FilterChips
              active={draft.kind}
              onChange={(kind) => setDraft({ ...draft, kind })}
              options={[
                { key: 'progressive', label: 'Progressive' },
                { key: 'custom', label: 'Custom' },
                { key: 'final', label: 'Final' },
              ]}
            />
            <FormPicker label="Customer *">
              <SearchablePicker
                value={draft.customerId}
                options={customers.map((customer) => ({
                  id: customer.id,
                  label: customer.name,
                }))}
                searchPlaceholder="Search customers…"
                emptyText="No customers match your search."
                onChange={(customerId) =>
                  setDraft({ ...draft, customerId, jobId: '' })
                }
              />
            </FormPicker>
            {eligibleJobs.length > 0 ? (
              <FormPicker label="Job (optional)">
                <SearchablePicker
                  value={draft.jobId}
                  allowEmpty
                  emptyLabel="No job"
                  options={eligibleJobs.map((job) => ({
                    id: job.id,
                    label: job.number,
                  }))}
                  searchPlaceholder="Search jobs…"
                  emptyText="No jobs match your search."
                  onChange={(jobId) => setDraft({ ...draft, jobId })}
                />
              </FormPicker>
            ) : null}
            <FormField
              label="Due date (YYYY-MM-DD)"
              value={draft.dueDate}
              onChangeText={(dueDate) => setDraft({ ...draft, dueDate })}
              placeholder="Optional"
            />
            <InvoiceLineEditor
              lines={draft.lines}
              onChange={(lines) => setDraft({ ...draft, lines })}
              documentDiscount={draft.documentDiscount}
              onDocumentDiscountChange={(documentDiscount) =>
                setDraft({ ...draft, documentDiscount })
              }
            />
            <AllocationPicker
              customerId={draft.customerId}
              jobId={draft.jobId || null}
              invoiceTotal={invoiceTotal}
              value={allocations}
              onChange={setAllocations}
            />
            <Text style={ui.label}>Notes</Text>
            <TextInput
              style={ui.input}
              value={draft.notes}
              onChangeText={(notes) => setDraft({ ...draft, notes })}
              multiline
            />
            <RowActions>
              <ActionButton
                label={saving ? 'Saving…' : 'Save draft'}
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
                onPress={startCreate}
                disabled={customers.length === 0}
              >
                <Text style={ui.buttonText}>New job invoice</Text>
              </Pressable>
              <Pressable style={ui.ghost} onPress={() => router.push('/module/purchase-invoices' as never)}>
                <Text style={ui.ghostText}>New purchase invoice</Text>
              </Pressable>
            </View>

            <FilterChips
              active={filter}
              onChange={setFilter}
              options={[
                { key: 'all', label: 'All' },
                { key: 'draft', label: 'Draft' },
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
                <RecordRow
                  key={invoice.id}
                  title={invoice.number}
                  status={invoice.status}
                  pdfPath={`/documents/invoices/${invoice.id}.pdf`}
                  onPdfError={setError}
                  meta={[
                    invoice.customer?.name,
                    label(invoice.kind),
                    amount(invoice.netPayable),
                    invoice.job ? `Job ${invoice.job.number}` : null,
                    day(invoice.issueDate),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                >
                  {invoice.status === 'draft' ? (
                    <>
                      <LinkAction
                        label="Issue"
                        onPress={() => void issue(invoice.id)}
                      />
                      <LinkAction
                        label="Cancel"
                        tone="danger"
                        onPress={() => void cancel(invoice.id)}
                      />
                    </>
                  ) : null}
                  {invoice.status === 'issued' &&
                  invoice.kind !== 'credit_note' ? (
                    <>
                      <LinkAction
                        label="Credit note"
                        onPress={() => setCreditFor(invoice)}
                      />
                      <LinkAction
                        label="Cancel"
                        tone="danger"
                        onPress={() => void cancel(invoice.id)}
                      />
                    </>
                  ) : null}
                </RecordRow>
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
      </ScreenScroll>
      <Toast flash={flash} />
    </View>
  );
}
