import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { computeInvoiceTotals } from '@marble/domain';
import { apiPost } from '../../lib/api';
import { day, label, money } from '../../lib/format';
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
import {
  AllocationPicker,
  ChipSelect,
  CreditNoteForm,
  EMPTY_INVOICE_LINE,
  InvoiceLineEditor,
  allocationPayload,
  invoiceLinePayload,
  type InvoiceLineDraft,
} from '../../components/MoneyForms';
import type { Customer, Invoice, JobListItem } from '../../lib/types';
import { colors, ui } from '../../lib/ui';

type Filter = 'all' | 'issued' | 'cancelled' | 'credit_note';
type Kind = 'progressive' | 'custom' | 'final';

type Draft = {
  kind: Kind;
  customerId: string;
  jobId: string;
  dueDate: string;
  notes: string;
  lines: InvoiceLineDraft[];
};

const EMPTY: Draft = {
  kind: 'custom',
  customerId: '',
  jobId: '',
  dueDate: '',
  notes: '',
  lines: [{ ...EMPTY_INVOICE_LINE }],
};

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
  ).total;

  function startCreate() {
    setDraft({ ...EMPTY, lines: [{ ...EMPTY_INVOICE_LINE }] });
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
        lines: invoiceLinePayload(draft.lines),
        allocations: allocationPayload(allocations),
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
      <ScreenScroll>
        <Text style={ui.title}>Invoices</Text>
        <Text style={ui.lede}>
          UAE tax invoices with 5% VAT. Raise one here or from a job.
        </Text>
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
            <ChipSelect
              value={draft.kind}
              onChange={(kind) => setDraft({ ...draft, kind })}
              options={[
                { key: 'progressive', label: 'Progressive' },
                { key: 'custom', label: 'Custom' },
                { key: 'final', label: 'Final' },
              ]}
            />
            <Text style={ui.label}>Customer *</Text>
            <ChipSelect
              value={draft.customerId}
              onChange={(customerId) =>
                setDraft({ ...draft, customerId, jobId: '' })
              }
              options={customers.map((customer) => ({
                key: customer.id,
                label: customer.name,
              }))}
            />
            {eligibleJobs.length > 0 ? (
              <>
                <Text style={ui.label}>Job (optional)</Text>
                <ChipSelect
                  value={draft.jobId}
                  onChange={(jobId) => setDraft({ ...draft, jobId })}
                  options={[
                    { key: '', label: 'No job' },
                    ...eligibleJobs.map((job) => ({
                      key: job.id,
                      label: job.number,
                    })),
                  ]}
                />
              </>
            ) : null}
            <Text style={ui.label}>Due date (YYYY-MM-DD)</Text>
            <TextInput
              style={ui.input}
              value={draft.dueDate}
              onChangeText={(dueDate) => setDraft({ ...draft, dueDate })}
              placeholder="Optional"
              placeholderTextColor={colors.soft}
            />
            <InvoiceLineEditor
              lines={draft.lines}
              onChange={(lines) => setDraft({ ...draft, lines })}
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
                onPress={startCreate}
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
                <RecordRow
                  key={invoice.id}
                  title={invoice.number}
                  status={invoice.status}
                  pdfPath={`/documents/invoices/${invoice.id}.pdf`}
                  onPdfError={setError}
                  meta={[
                    invoice.customer?.name,
                    label(invoice.kind),
                    money(invoice.netPayable),
                    invoice.job ? `Job ${invoice.job.number}` : null,
                    day(invoice.issueDate),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                >
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
