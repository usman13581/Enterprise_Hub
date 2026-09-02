'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  QUOTATION_KIND_LABELS,
  QUOTATION_LOOKUP_CATEGORY_LABELS,
  hasFeature,
  type QuotationKind,
  type QuotationLookupCategory,
  type SessionPayload,
} from '@marble/types';
import { apiDelete, apiFetch, apiPost, apiPut } from '@/lib/api';
import { useCompanyAdmin } from '@/lib/useCompanyAdmin';
import { dueDateIso } from '@/lib/dates';
import { amount, day, moneyHeader } from '@/lib/format';
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
  EditIconButton,
  PdfButton,
  RowActionsBar,
  TableScroll,
} from '@/components/Finance';
import {
  discountFromStored,
  discountPayload,
  EMPTY_DISCOUNT,
  type DiscountDraft,
} from '@/components/DiscountFields';
import {
  EMPTY_QUOTATION_LINE,
  QuotationLineEditor,
  quotationLinePayload,
  type QuotationLineDraft,
} from '@/components/LineEditor';
import {
  LookupAttachPicker,
  QuotationLookupsPanel,
} from '@/components/QuotationLookups';
import { SearchableSelect } from '@/components/SearchableSelect';
import type { Customer, Product, Quotation } from '@/lib/types';
import page from '../page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

type Filter = 'all' | 'draft' | 'approved' | 'cancelled';
type CreateStep = 'list' | 'pick-kind' | 'general-form';
type PageTab = 'quotations' | QuotationLookupCategory;

type Draft = {
  customerId: string;
  title: string;
  notes: string;
  validUntil: string;
  lines: QuotationLineDraft[];
  lookupIds: string[];
  documentDiscount: DiscountDraft;
};

const EMPTY: Draft = {
  customerId: '',
  title: '',
  notes: '',
  validUntil: dueDateIso(),
  lines: [{ ...EMPTY_QUOTATION_LINE }],
  lookupIds: [],
  documentDiscount: { ...EMPTY_DISCOUNT },
};

export default function QuotationsPage() {
  const router = useRouter();
  const { items, error, setError, reload } =
    usePolledList<Quotation>('/quotations');
  const { items: customers } = usePolledList<Customer>('/customers', 20000);
  const { items: products } = usePolledList<Product>('/products', 20000);
  const { flash, notify } = useFlash();

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [step, setStep] = useState<CreateStep>('list');
  const [kind, setKind] = useState<QuotationKind>('general');
  const [pageTab, setPageTab] = useState<PageTab>('quotations');
  const [saving, setSaving] = useState(false);
  const [features, setFeatures] = useState<string[]>([]);
  const isAdmin = useCompanyAdmin();

  useEffect(() => {
    void apiFetch<SessionPayload>('/auth/session').then((s) => {
      setFeatures(s.features ?? []);
    });
  }, []);

  const canCounterTop = hasFeature(features, 'quotation.counter_top');

  const filtered = useMemo(() => {
    const byStatus =
      filter === 'all' ? items : items.filter((item) => item.status === filter);
    return searchItems(byStatus, query);
  }, [items, filter, query]);
  const pager = usePagination(filtered, `${filter}:${query}:${pageTab}`);

  function startCreate() {
    setEditingId(null);
    setKind('general');
    setStep('pick-kind');
  }

  function continueWithKind() {
    if (kind === 'counter_top') {
      if (!canCounterTop) {
        setError('Counter Top quotations are not enabled for this company');
        return;
      }
      router.push('/quotations/counter-top');
      return;
    }
    setDraft({
      ...EMPTY,
      validUntil: dueDateIso(),
      lines: [{ ...EMPTY_QUOTATION_LINE }],
      lookupIds: [],
    });
    setStep('general-form');
  }

  function startEdit(quotation: Quotation) {
    if (quotation.kind === 'counter_top') {
      router.push(`/quotations/counter-top?edit=${quotation.id}`);
      return;
    }
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
        discountMode: (line.discountMode as DiscountDraft['discountMode']) ?? 'none',
        discountValue: String(line.discountValue ?? 0),
      })),
      lookupIds: (quotation.lookups ?? []).map((lookup) => lookup.id),
      documentDiscount: discountFromStored(
        quotation.discountMode,
        quotation.discountValue,
      ),
    });
    setEditingId(quotation.id);
    setStep('general-form');
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
      kind: 'general' as const,
      customerId: draft.customerId,
      title: draft.title,
      notes: draft.notes,
      validUntil: draft.validUntil || null,
      ...discountPayload(draft.documentDiscount),
      lookupIds: draft.lookupIds,
      lines: quotationLinePayload(draft.lines),
      sections: [],
    };

    try {
      if (editingId) await apiPut(`/quotations/${editingId}`, payload);
      else await apiPost('/quotations', payload);
      setStep('list');
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
    action: 'approve' | 'cancel' | 'delete',
    successText: string,
  ) {
    try {
      if (action === 'delete') {
        if (!window.confirm('Delete this draft permanently? This cannot be undone.')) {
          return;
        }
        await apiDelete(`/quotations/${id}`);
      } else {
        await apiPost(`/quotations/${id}/${action}`, {});
      }
      await reload();
      notify(successText, action === 'cancel' || action === 'delete' ? 'danger' : 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  async function duplicateFrom(id: string, mode: 'revise' | 'copy') {
    try {
      const path = mode === 'revise' ? 'revise' : 'copy';
      const created = await apiPost<Quotation>(`/quotations/${id}/${path}`, {});
      await reload();
      notify(
        mode === 'revise'
          ? `Revision ${created.number} created as draft`
          : `Copy ${created.number} created as draft`,
      );
      if (created.kind === 'counter_top') {
        router.push(`/quotations/counter-top?edit=${created.id}`);
        return;
      }
      startEdit(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not duplicate quotation');
    }
  }

  return (
    <section className={page.page}>
      <h1 className={page.title}>Quotations</h1>

      <FilterBar
        active={pageTab}
        onChange={(key) => {
          setPageTab(key);
          setStep('list');
        }}
        options={[
          { key: 'quotations', label: 'Quotations' },
          { key: 'terms', label: QUOTATION_LOOKUP_CATEGORY_LABELS.terms },
          { key: 'notes', label: QUOTATION_LOOKUP_CATEGORY_LABELS.notes },
          { key: 'bank', label: QUOTATION_LOOKUP_CATEGORY_LABELS.bank },
          { key: 'spec', label: QUOTATION_LOOKUP_CATEGORY_LABELS.spec },
        ]}
      />

      {pageTab !== 'quotations' ? (
        <QuotationLookupsPanel category={pageTab} />
      ) : null}

      {pageTab === 'quotations' && error ? (
        <p className={styles.error}>{error}</p>
      ) : null}

      {pageTab === 'quotations' && step === 'pick-kind' ? (
        <div className={styles.form}>
          <p className={styles.formTitle}>New quotation</p>
          <p className={page.lede} style={{ marginTop: 0 }}>
            Choose the quotation type to continue.
          </p>
          <div className={styles.field}>
            <label className={styles.label}>Quotation type</label>
            <select
              className={styles.select}
              value={kind}
              onChange={(e) => setKind(e.target.value as QuotationKind)}
            >
              <option value="general">{QUOTATION_KIND_LABELS.general}</option>
              {canCounterTop ? (
                <option value="counter_top">
                  {QUOTATION_KIND_LABELS.counter_top}
                </option>
              ) : null}
            </select>
          </div>
          <div className={styles.actions}>
            <button
              className={styles.button}
              type="button"
              onClick={continueWithKind}
            >
              Continue
            </button>
            <button
              className={styles.ghost}
              type="button"
              onClick={() => setStep('list')}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {pageTab === 'quotations' && step === 'general-form' ? (
        <form className={styles.form} onSubmit={onSubmit}>
          <p className={styles.formTitle}>
            {editingId
              ? 'Edit quotation'
              : QUOTATION_KIND_LABELS.general}
          </p>
          <div className={styles.grid}>
            <SearchableSelect
              label="Customer *"
              value={draft.customerId}
              onChange={(customerId) => setDraft({ ...draft, customerId })}
              required
              placeholder="Search customers…"
              options={customers.map((customer) => ({
                id: customer.id,
                label: customer.name,
              }))}
            />
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
            documentDiscount={draft.documentDiscount}
            onDocumentDiscountChange={(documentDiscount) =>
              setDraft({ ...draft, documentDiscount })
            }
          />

          <div className={styles.field} style={{ marginTop: '0.9rem' }}>
            <label className={styles.label}>Notes</label>
            <textarea
              className={styles.textarea}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>

          <div style={{ marginTop: '1rem' }}>
            <p className={styles.formTitle}>Attach lookups</p>
            <LookupAttachPicker
              kind="general"
              selectedIds={draft.lookupIds}
              onChange={(lookupIds) => setDraft({ ...draft, lookupIds })}
            />
          </div>

          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save draft'}
            </button>
            <button
              className={styles.ghost}
              type="button"
              onClick={() => setStep(editingId ? 'list' : 'pick-kind')}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {pageTab === 'quotations' && step === 'list' ? (
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
            <TableScroll>
              <table className={finance.table}>
                <thead>
                  <tr>
                    <th className={finance.rowLead} aria-label="Edit" />
                    <th>Number</th>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Subject</th>
                    <th className={finance.numeric}>{moneyHeader('Total')}</th>
                    <th>Job</th>
                    <th className={finance.actions} aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {pager.paged.map((quotation) => (
                    <tr key={quotation.id}>
                      <td className={finance.rowLead}>
                        {quotation.status === 'draft' ? (
                          <EditIconButton
                            label="Edit quotation"
                            onClick={() => startEdit(quotation)}
                          />
                        ) : null}
                      </td>
                      <td>
                        <strong>{quotation.number}</strong>
                        <div className={styles.cardMeta}>
                          {day(quotation.createdAt)}
                        </div>
                      </td>
                      <td>{quotation.customer?.name ?? '—'}</td>
                      <td>
                        {QUOTATION_KIND_LABELS[
                          quotation.kind === 'counter_top'
                            ? 'counter_top'
                            : 'general'
                        ] ?? 'General'}
                      </td>
                      <td>{quotation.title ?? '—'}</td>
                      <td className={finance.numeric}>
                        {amount(quotation.total)}
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
                      <td className={finance.actions}>
                        <RowActionsBar>
                          <PdfButton
                            path={`/documents/quotations/${quotation.id}.pdf`}
                            onError={setError}
                          />
                          {quotation.status === 'draft' ? (
                            <>
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
                              {isAdmin ? (
                                <button
                                  className={`${styles.ghost} ${styles.danger}`}
                                  onClick={() =>
                                    void act(
                                      quotation.id,
                                      'delete',
                                      'Quotation deleted',
                                    )
                                  }
                                >
                                  Delete
                                </button>
                              ) : (
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
                              )}
                            </>
                          ) : null}
                          {quotation.status === 'approved' ? (
                            <button
                              className={styles.ghost}
                              onClick={() => void duplicateFrom(quotation.id, 'revise')}
                            >
                              Revise
                            </button>
                          ) : null}
                          <button
                            className={styles.ghost}
                            onClick={() => void duplicateFrom(quotation.id, 'copy')}
                          >
                            Copy as new
                          </button>
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
      ) : null}

      <Toast flash={flash} />
    </section>
  );
}
