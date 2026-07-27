'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { apiDelete, apiPost, apiPut } from '@/lib/api';
import { day, money } from '@/lib/format';
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
  StatusBadge,
} from '@/components/Finance';
import {
  EMPTY_QUOTATION_LINE,
  QuotationLineEditor,
  quotationLinePayload,
  type QuotationLineDraft,
} from '@/components/LineEditor';
import type { Customer, Product, Quotation } from '@/lib/types';
import page from '../page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

type Filter = 'all' | 'draft' | 'approved' | 'cancelled';

type Draft = {
  customerId: string;
  title: string;
  notes: string;
  validUntil: string;
  lines: QuotationLineDraft[];
};

const EMPTY: Draft = {
  customerId: '',
  title: '',
  notes: '',
  validUntil: '',
  lines: [{ ...EMPTY_QUOTATION_LINE }],
};

export default function QuotationsPage() {
  const { items, error, setError, reload } =
    usePolledList<Quotation>('/quotations');
  const { items: customers } = usePolledList<Customer>('/customers', 20000);
  const { items: products } = usePolledList<Product>('/products', 20000);
  const { flash, notify } = useFlash();

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const byStatus =
      filter === 'all' ? items : items.filter((item) => item.status === filter);
    return searchItems(byStatus, query);
  }, [items, filter, query]);
  const pager = usePagination(filtered);

  function startCreate() {
    setDraft({ ...EMPTY, lines: [{ ...EMPTY_QUOTATION_LINE }] });
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(quotation: Quotation) {
    setDraft({
      customerId: quotation.customerId,
      title: quotation.title ?? '',
      notes: quotation.notes ?? '',
      validUntil: quotation.validUntil?.slice(0, 10) ?? '',
      lines: quotation.lines.map((line) => ({
        productId: line.productId ?? '',
        description: line.description,
        unit: line.unit,
        qty: String(line.qty),
        purchasePrice: String(line.purchasePrice),
        sellPrice: String(line.sellPrice),
      })),
    });
    setEditingId(quotation.id);
    setShowForm(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!draft.customerId) {
      setError('Choose a customer first');
      return;
    }

    setSaving(true);
    const wasEditing = Boolean(editingId);
    const payload = {
      customerId: draft.customerId,
      title: draft.title,
      notes: draft.notes,
      validUntil: draft.validUntil || null,
      lines: quotationLinePayload(draft.lines),
    };

    try {
      if (editingId) await apiPut(`/quotations/${editingId}`, payload);
      else await apiPost('/quotations', payload);
      setShowForm(false);
      setEditingId(null);
      await reload();
      notify(wasEditing ? 'Quotation saved' : 'Quotation created');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function act(
    id: string,
    action: 'approve' | 'cancel',
    successText: string,
  ) {
    try {
      await apiPost(`/quotations/${id}/${action}`, {});
      await reload();
      notify(successText, action === 'cancel' ? 'danger' : 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  async function onDelete(id: string) {
    try {
      await apiDelete(`/quotations/${id}`);
      await reload();
      notify('Quotation deleted', 'danger');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <section className={page.page}>
      <h1 className={page.title}>Quotations</h1>
      <p className={page.lede}>
        Quote a customer with per-line purchase and sell prices. Approving a
        quotation opens the job; cancelling leaves no job behind.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      {showForm ? (
        <form className={styles.form} onSubmit={onSubmit}>
          <p className={styles.formTitle}>
            {editingId ? 'Edit quotation' : 'New quotation'}
          </p>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>Customer *</label>
              <select
                className={styles.select}
                value={draft.customerId}
                onChange={(e) =>
                  setDraft({ ...draft, customerId: e.target.value })
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
              <label className={styles.label}>Subject</label>
              <input
                className={styles.input}
                value={draft.title}
                placeholder="Villa flooring, lobby cladding…"
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Valid until</label>
              <input
                className={styles.input}
                type="date"
                value={draft.validUntil}
                onChange={(e) =>
                  setDraft({ ...draft, validUntil: e.target.value })
                }
              />
            </div>
          </div>

          <QuotationLineEditor
            lines={draft.lines}
            onChange={(lines) => setDraft({ ...draft, lines })}
            products={products}
          />

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
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create'}
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
            <span className={styles.count}>{items.length} quotations</span>
            <button
              className={styles.button}
              onClick={startCreate}
              disabled={customers.length === 0}
              title={
                customers.length === 0
                  ? 'Add a customer before quoting'
                  : undefined
              }
            >
              New quotation
            </button>
          </div>

          <FilterBar
            active={filter}
            onChange={setFilter}
            options={[
              { key: 'all', label: 'All' },
              { key: 'draft', label: 'Draft' },
              { key: 'approved', label: 'Approved' },
              { key: 'cancelled', label: 'Cancelled' },
            ]}
          />

          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search by number, customer, subject…"
          />

          {filtered.length === 0 ? (
            <EmptyState>
              {items.length === 0
                ? 'No quotations yet. Create one to start the quotation → job → invoice flow.'
                : 'No quotations match this filter.'}
            </EmptyState>
          ) : (
            <table className={finance.table}>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Customer</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th className={finance.numeric}>Total</th>
                  <th className={finance.numeric}>Margin</th>
                  <th>Job</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pager.paged.map((quotation) => (
                  <tr key={quotation.id}>
                    <td>
                      <strong>{quotation.number}</strong>
                      <div className={styles.cardMeta}>
                        {day(quotation.createdAt)}
                      </div>
                    </td>
                    <td>{quotation.customer?.name ?? '—'}</td>
                    <td>{quotation.title ?? '—'}</td>
                    <td>
                      <StatusBadge status={quotation.status} />
                    </td>
                    <td className={finance.numeric}>
                      {money(quotation.total)}
                    </td>
                    <td className={finance.numeric}>
                      {money(quotation.profit)}
                    </td>
                    <td>
                      {quotation.job ? (
                        <Link
                          className={finance.link}
                          href={`/jobs/${quotation.job.id}`}
                        >
                          {quotation.job.number}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <div className={finance.rowActions}>
                        <PdfButton
                          path={`/documents/quotations/${quotation.id}.pdf`}
                          onError={setError}
                        />
                        {quotation.status === 'draft' ? (
                          <>
                            <button
                              className={styles.ghost}
                              onClick={() => startEdit(quotation)}
                            >
                              Edit
                            </button>
                            <button
                              className={styles.button}
                              onClick={() =>
                                void act(
                                  quotation.id,
                                  'approve',
                                  'Approved — job created',
                                )
                              }
                            >
                              Approve
                            </button>
                            <button
                              className={`${styles.ghost} ${styles.danger}`}
                              onClick={() =>
                                void act(
                                  quotation.id,
                                  'cancel',
                                  'Quotation cancelled',
                                )
                              }
                            >
                              Cancel
                            </button>
                            <button
                              className={`${styles.ghost} ${styles.danger}`}
                              onClick={() => void onDelete(quotation.id)}
                            >
                              Delete
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
