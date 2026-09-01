'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { apiPatch, apiPost } from '@/lib/api';
import { dueDateIso } from '@/lib/dates';
import { amount, day, label, moneyHeader } from '@/lib/format';
import {
  searchItems,
  useFlash,
  usePagination,
  usePolledList,
} from '@/lib/useCollection';
import { Pagination, SearchBox, Toast } from '@/components/ListControls';
import {
  EmptyState,
  EditIconButton,
  FilterBar,
  PdfButton,
  RowActionsBar,
  StatusBadge,
  TableScroll,
} from '@/components/Finance';
import { SearchableSelect } from '@/components/SearchableSelect';
import {
  discountFromStored,
  discountPayload,
  EMPTY_DISCOUNT,
  type DiscountDraft,
} from '@/components/DiscountFields';
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
import { PurchaseInvoiceForm } from '@/components/PurchasingForms';
import type { Customer, Invoice, JobListItem } from '@/lib/types';
import page from '../page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

type Filter = 'all' | 'draft' | 'issued' | 'cancelled' | 'credit_note';

type Draft = {
  kind: 'progressive' | 'custom' | 'final';
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

export default function InvoicesPage() {
  const { items, error, setError, reload } = usePolledList<Invoice>('/invoices');
  const { items: customers } = usePolledList<Customer>('/customers', 20000);
  const { items: jobs } = usePolledList<JobListItem>('/jobs', 20000);
  const { flash, notify } = useFlash();

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
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
  const pager = usePagination(filtered, `${filter}:${query}`);

  /** Only open jobs of the chosen customer can be billed. */
  const eligibleJobs = jobs.filter(
    (job) => job.customerId === draft.customerId && job.status !== 'closed',
  );

  function startCreate() {
    setDraft({
      ...EMPTY,
      dueDate: dueDateIso(),
      lines: [{ ...EMPTY_INVOICE_LINE }],
    });
    setAllocations({});
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(invoice: Invoice) {
    setDraft({
      kind: invoice.kind === 'credit_note' ? 'custom' : invoice.kind,
      customerId: invoice.customerId,
      jobId: invoice.jobId ?? '',
      dueDate: invoice.dueDate ? invoice.dueDate.slice(0, 10) : '',
      notes: invoice.notes ?? '',
      lines:
        invoice.lines.length > 0
          ? invoice.lines.map((line) => ({
              description: line.description,
              unit: line.unit,
              qty: String(line.qty),
              unitPrice: String(line.unitPrice),
              purchasePrice: String(line.purchasePrice),
              discountMode: line.discountMode,
              discountValue: String(line.discountValue ?? 0),
            }))
          : [{ ...EMPTY_INVOICE_LINE }],
      documentDiscount: discountFromStored(
        invoice.discountMode,
        invoice.discountValue,
      ),
    });
    const next: Record<string, string> = {};
    for (const allocation of invoice.allocations ?? []) {
      next[allocation.advanceId] = String(allocation.amount);
    }
    setAllocations(next);
    setEditingId(invoice.id);
    setShowForm(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const payload = {
      kind: draft.kind,
      customerId: draft.customerId,
      jobId: draft.jobId || null,
      dueDate: draft.dueDate || null,
      notes: draft.notes || null,
      ...discountPayload(draft.documentDiscount),
      lines: invoiceLinePayload(draft.lines),
      allocations: allocationPayload(allocations),
    };
    try {
      if (editingId) {
        await apiPatch(`/invoices/${editingId}`, payload);
        notify('Draft saved');
      } else {
        await apiPost('/invoices', payload);
        notify('Invoice saved as draft');
      }
      setShowForm(false);
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function onIssue(id: string) {
    try {
      await apiPost(`/invoices/${id}/issue`, {});
      await reload();
      notify('Invoice issued');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not issue');
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

      {error ? <p className={styles.error}>{error}</p> : null}

      {creditFor ? (
        <CreditNoteForm
          invoice={creditFor}
          onSaved={async () => {
            setCreditFor(null);
            await reload();
            notify('Credit note saved as draft');
          }}
          onError={setError}
          onCancel={() => setCreditFor(null)}
        />
      ) : null}

      {showPurchaseForm ? (
        <PurchaseInvoiceForm
          saving={savingPurchase}
          onSave={async (payload) => {
            if (savingPurchase) return;
            setSavingPurchase(true);
            try {
              await apiPost('/purchase-invoices', payload);
              setShowPurchaseForm(false);
              notify('Purchase invoice saved as draft');
            } catch (err) {
              setError(
                err instanceof Error ? err.message : 'Could not save purchase invoice',
              );
            } finally {
              setSavingPurchase(false);
            }
          }}
          onCancel={() => setShowPurchaseForm(false)}
        />
      ) : showForm ? (
        <form className={styles.form} onSubmit={onSubmit}>
          <p className={styles.formTitle}>New invoice</p>
          <div className={styles.grid}>
            <SearchableSelect
              label="Customer *"
              value={draft.customerId}
              onChange={(customerId) =>
                setDraft({ ...draft, customerId, jobId: '' })
              }
              required
              placeholder="Search customers…"
              options={customers.map((customer) => ({
                id: customer.id,
                label: customer.name,
              }))}
            />
            <SearchableSelect
              label="Job"
              value={draft.jobId}
              onChange={(jobId) => setDraft({ ...draft, jobId })}
              allowEmpty
              emptyLabel="No job (standalone invoice)"
              disabled={!draft.customerId}
              placeholder="Search jobs…"
              options={eligibleJobs.map((job) => ({
                id: job.id,
                label: `${job.number} · ${job.title ?? 'No subject'}`,
              }))}
            />
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
            documentDiscount={draft.documentDiscount}
            onDocumentDiscountChange={(documentDiscount) =>
              setDraft({ ...draft, documentDiscount })
            }
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
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save draft'}
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
          </div>
          <div className={styles.actions}>
            <button
              className={styles.button}
              onClick={startCreate}
              disabled={customers.length === 0}
            >
              New job invoice
            </button>
            <button
              className={styles.ghost}
              onClick={() => {
                setShowForm(false);
                setShowPurchaseForm(true);
              }}
            >
              New purchase invoice
            </button>
            <Link className={styles.ghost} href="/purchase-invoices">
              View purchase invoices
            </Link>
          </div>

          <FilterBar
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
                    <th className={finance.rowLead} aria-label="Edit" />
                    <th>Number</th>
                    <th>Customer</th>
                    <th>Job</th>
                    <th>Kind</th>
                    <th>Issued</th>
                    <th>Status</th>
                    <th className={finance.numeric}>{moneyHeader('Total')}</th>
                    <th className={finance.numeric}>{moneyHeader('Net payable')}</th>
                    <th className={finance.actions} aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {pager.paged.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className={finance.rowLead}>
                        {invoice.status === 'draft' &&
                        invoice.kind !== 'credit_note' ? (
                          <EditIconButton
                            label="Edit invoice"
                            onClick={() => startEdit(invoice)}
                          />
                        ) : null}
                      </td>
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
                      <td className={finance.numeric}>{amount(invoice.total)}</td>
                      <td className={finance.numeric}>
                        {amount(invoice.netPayable)}
                      </td>
                      <td className={finance.actions}>
                        <RowActionsBar>
                          <PdfButton
                            path={`/documents/invoices/${invoice.id}.pdf`}
                            onError={setError}
                          />
                          {invoice.status === 'draft' ? (
                            <>
                              <button
                                className={styles.button}
                                onClick={() => void onIssue(invoice.id)}
                              >
                                Issue
                              </button>
                              <button
                                className={`${styles.ghost} ${styles.danger}`}
                                onClick={() => void onCancel(invoice.id)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : null}
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
  const [documentDiscount, setDocumentDiscount] = useState<DiscountDraft>({
    ...EMPTY_DISCOUNT,
  });
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await apiPost('/invoices/credit-notes', {
        invoiceId: invoice.id,
        reason,
        ...discountPayload(documentDiscount),
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
        cannot exceed {amount(invoice.total)} originally billed.
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
        documentDiscount={documentDiscount}
        onDocumentDiscountChange={setDocumentDiscount}
      />
      <div className={styles.actions}>
        <button className={styles.button} type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save draft'}
        </button>
        <button className={styles.ghost} type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
