'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { apiPost } from '@/lib/api';
import { day, label, money } from '@/lib/format';
import {
  searchItems,
  useFlash,
  usePagination,
  usePolledList,
} from '@/lib/useCollection';
import { Pagination, SearchBox, Toast } from '@/components/ListControls';
import {
  EmptyState,
  FilterBar,
  PdfButton,
  RowActionsBar,
  StatusBadge,
  TableScroll,
} from '@/components/Finance';
import {
  EMPTY_INVOICE_LINE,
  InvoiceLineEditor,
  invoiceLinePayload,
  type InvoiceLineDraft,
} from '@/components/LineEditor';
import {
  AllocationPicker,
  allocationPayload,
} from '@/components/MoneyForms';
import type { Customer, Invoice, JobListItem } from '@/lib/types';
import page from '../page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

type Filter = 'all' | 'issued' | 'cancelled' | 'credit_note';

type Draft = {
  kind: 'progressive' | 'custom' | 'final';
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

export default function InvoicesPage() {
  const { items, error, setError, reload } = usePolledList<Invoice>('/invoices');
  const { items: customers } = usePolledList<Customer>('/customers', 20000);
  const { items: jobs } = usePolledList<JobListItem>('/jobs', 20000);
  const { flash, notify } = useFlash();

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
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
  const pager = usePagination(filtered);

  /** Only open jobs of the chosen customer can be billed. */
  const eligibleJobs = jobs.filter(
    (job) => job.customerId === draft.customerId && job.status !== 'closed',
  );

  function startCreate() {
    setDraft({ ...EMPTY, lines: [{ ...EMPTY_INVOICE_LINE }] });
    setAllocations({});
    setShowForm(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await apiPost('/invoices', {
        kind: draft.kind,
        customerId: draft.customerId,
        jobId: draft.jobId || null,
        dueDate: draft.dueDate || null,
        notes: draft.notes || null,
        lines: invoiceLinePayload(draft.lines),
        allocations: allocationPayload(allocations),
      });
      setShowForm(false);
      await reload();
      notify('Invoice issued');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not issue');
    } finally {
      setSaving(false);
    }
  }

  async function onCancel(id: string) {
    try {
      await apiPost(`/invoices/${id}/cancel`, {});
      await reload();
      notify('Invoice cancelled', 'danger');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel');
    }
  }

  const invoiceTotal = invoiceLinePayload(draft.lines).reduce(
    (total, line) => total + line.qty * line.unitPrice * 1.05,
    0,
  );

  return (
    <section className={page.page}>
      <h1 className={page.title}>Invoices</h1>
      <p className={page.lede}>
        UAE tax invoices with 5% VAT and advance adjustment. Raise one here, from
        a job, or from a customer.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

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
      ) : null}

      {showForm ? (
        <form className={styles.form} onSubmit={onSubmit}>
          <p className={styles.formTitle}>New invoice</p>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>Customer *</label>
              <select
                className={styles.select}
                value={draft.customerId}
                onChange={(e) =>
                  setDraft({ ...draft, customerId: e.target.value, jobId: '' })
                }
                required
              >
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Job</label>
              <select
                className={styles.select}
                value={draft.jobId}
                onChange={(e) => setDraft({ ...draft, jobId: e.target.value })}
                disabled={!draft.customerId}
              >
                <option value="">No job (standalone invoice)</option>
                {eligibleJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.number} · {job.title ?? 'No subject'}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Kind</label>
              <select
                className={styles.select}
                value={draft.kind}
                onChange={(e) =>
                  setDraft({ ...draft, kind: e.target.value as Draft['kind'] })
                }
              >
                <option value="progressive">Progressive</option>
                <option value="custom">Custom</option>
                <option value="final">Final</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Due date</label>
              <input
                className={styles.input}
                type="date"
                value={draft.dueDate}
                onChange={(e) =>
                  setDraft({ ...draft, dueDate: e.target.value })
                }
              />
            </div>
          </div>

          <InvoiceLineEditor
            lines={draft.lines}
            onChange={(lines) => setDraft({ ...draft, lines })}
            advanceApplied={allocationPayload(allocations).reduce(
              (total, entry) => total + entry.amount,
              0,
            )}
          />

          {draft.customerId ? (
            <>
              <p className={finance.sectionTitle}>Adjust advances</p>
              <AllocationPicker
                customerId={draft.customerId}
                jobId={draft.jobId || null}
                invoiceTotal={invoiceTotal}
                value={allocations}
                onChange={setAllocations}
              />
            </>
          ) : null}

          <div className={styles.field} style={{ marginTop: '0.9rem' }}>
            <label className={styles.label}>Notes</label>
            <textarea
              className={styles.textarea}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>

          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={saving}>
              {saving ? 'Issuing…' : 'Issue invoice'}
            </button>
            <button
              className={styles.ghost}
              type="button"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className={styles.toolbar}>
            <span className={styles.count}>{items.length} invoices</span>
            <button
              className={styles.button}
              onClick={startCreate}
              disabled={customers.length === 0}
            >
              New invoice
            </button>
          </div>

          <FilterBar
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
            placeholder="Search by number, customer, job…"
          />

          {filtered.length === 0 ? (
            <EmptyState>
              {items.length === 0
                ? 'No invoices yet. Approve a quotation and bill its job, or raise a standalone invoice.'
                : 'No invoices match this filter.'}
            </EmptyState>
          ) : (
            <TableScroll>
              <table className={finance.table}>
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Customer</th>
                    <th>Job</th>
                    <th>Kind</th>
                    <th>Issued</th>
                    <th>Status</th>
                    <th className={finance.numeric}>Total</th>
                    <th className={finance.numeric}>Net payable</th>
                    <th className={finance.actions} aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {pager.paged.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>
                        <strong>{invoice.number}</strong>
                      </td>
                      <td>{invoice.customer?.name ?? '—'}</td>
                      <td>
                        {invoice.job ? (
                          <Link
                            className={finance.link}
                            href={`/jobs/${invoice.job.id}`}
                          >
                            {invoice.job.number}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{label(invoice.kind)}</td>
                      <td>{day(invoice.issueDate)}</td>
                      <td>
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className={finance.numeric}>{money(invoice.total)}</td>
                      <td className={finance.numeric}>
                        {money(invoice.netPayable)}
                      </td>
                      <td className={finance.actions}>
                        <RowActionsBar>
                          <PdfButton
                            path={`/documents/invoices/${invoice.id}.pdf`}
                            onError={setError}
                          />
                          {invoice.status === 'issued' &&
                          invoice.kind !== 'credit_note' ? (
                            <>
                              <button
                                className={styles.ghost}
                                onClick={() => setCreditFor(invoice)}
                              >
                                Credit note
                              </button>
                              <button
                                className={`${styles.ghost} ${styles.danger}`}
                                onClick={() => void onCancel(invoice.id)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : null}
                        </RowActionsBar>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
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

      <Toast flash={flash} />
    </section>
  );
}

function CreditNoteForm({
  invoice,
  onSaved,
  onError,
  onCancel,
}: {
  invoice: Invoice;
  onSaved: () => void | Promise<void>;
  onError: (message: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<InvoiceLineDraft[]>([
    { ...EMPTY_INVOICE_LINE },
  ]);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await apiPost('/invoices/credit-notes', {
        invoiceId: invoice.id,
        reason,
        lines: invoiceLinePayload(lines),
      });
      await onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not credit');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <p className={styles.formTitle}>
        Credit note against {invoice.number}
      </p>
      <p className={finance.panelNote}>
        The original invoice stays on the ledger. This adds a credit, so it
        cannot exceed the {money(invoice.total)} originally billed.
      </p>
      <div className={styles.field} style={{ marginTop: '0.9rem' }}>
        <label className={styles.label}>Reason *</label>
        <input
          className={styles.input}
          value={reason}
          placeholder="Material returned, rework agreed…"
          onChange={(e) => setReason(e.target.value)}
          required
        />
      </div>
      <InvoiceLineEditor
        lines={lines}
        onChange={setLines}
        advanceApplied={0}
      />
      <div className={styles.actions}>
        <button className={styles.button} type="submit" disabled={saving}>
          {saving ? 'Issuing…' : 'Issue credit note'}
        </button>
        <button className={styles.ghost} type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
