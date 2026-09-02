'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiPost, apiPut } from '@/lib/api';
import { useCompanyAdmin } from '@/lib/useCompanyAdmin';
import {
  searchItems,
  useFlash,
  usePagination,
  usePolledList,
} from '@/lib/useCollection';
import { EditIconButton, EmptyState, FilterBar, StatusBadge, TableScroll } from '@/components/Finance';
import { Pagination, SearchBox, Toast } from '@/components/ListControls';
import { amount, moneyHeader } from '@/lib/format';
import type { PurchaseInvoice } from '@marble/types';
import {
  PurchaseInvoiceForm,
  type PurchaseInvoicePreset,
  type PurchaseInvoiceSavePayload,
} from '@/components/PurchasingForms';
import page from '../page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

type Filter =
  | 'all'
  | 'draft'
  | 'posted'
  | 'partially_paid'
  | 'paid'
  | 'cancelled';

export default function PurchaseInvoicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supplierId = searchParams.get('supplierId');
  const lpoId = searchParams.get('lpoId');
  const preset = useMemo<PurchaseInvoicePreset | undefined>(() => {
    if (!supplierId || !lpoId) return undefined;
    return { supplierId, lpoId };
  }, [supplierId, lpoId]);
  const { items, error, setError, reload } = usePolledList<PurchaseInvoice>(
    supplierId ? `/purchase-invoices?supplierId=${supplierId}` : '/purchase-invoices',
  );
  const { flash, notify } = useFlash();
  const isAdmin = useCompanyAdmin();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (preset) setShowForm(true);
  }, [preset]);
  const filtered = useMemo(() => {
    const byStatus =
      filter === 'all'
        ? items
        : items.filter((item) => item.status === filter);
    return searchItems(byStatus, query);
  }, [items, filter, query]);
  const pager = usePagination(filtered, `${filter}:${query}`);

  async function create(payload: PurchaseInvoiceSavePayload) {
    if (saving) return;
    setSaving(true);
    try {
      await apiPost('/purchase-invoices', payload);
      setShowForm(false);
      await reload();
      notify('Purchase invoice saved as draft');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save purchase invoice');
    } finally {
      setSaving(false);
    }
  }

  async function deleteDraft(id: string) {
    if (!window.confirm('Delete this draft permanently? This cannot be undone.')) {
      return;
    }
    try {
      await apiDelete(`/purchase-invoices/${id}`);
      await reload();
      notify('Purchase invoice deleted', 'danger');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete invoice');
    }
  }

  async function post(id: string) {
    try {
      await apiPost(`/purchase-invoices/${id}/post`, {});
      await reload();
      notify('Purchase invoice posted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post invoice');
    }
  }

  return (
    <section className={page.page}>
      <h1 className={page.title}>Purchase invoices</h1>
      {error ? <p className={styles.error}>{error}</p> : null}
      {showForm ? (
        <PurchaseInvoiceForm
          preset={preset}
          saving={saving}
          onSave={create}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <div className={styles.toolbar}>
          <span className={styles.count}>{items.length} purchase invoices</span>
          <button className={styles.button} onClick={() => setShowForm(true)}>
            New purchase invoice
          </button>
        </div>
      )}
      {!showForm ? (
        <>
          <FilterBar
            active={filter}
            onChange={setFilter}
            options={[
              { key: 'all', label: 'All' },
              { key: 'draft', label: 'Draft' },
              { key: 'posted', label: 'Posted' },
              { key: 'partially_paid', label: 'Partially paid' },
              { key: 'paid', label: 'Paid' },
              { key: 'cancelled', label: 'Cancelled' },
            ]}
          />
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search purchase invoices…"
          />
        </>
      ) : null}
      {filtered.length ? (
        <TableScroll>
          <table className={finance.table}>
            <thead>
              <tr>
                <th className={finance.rowLead} aria-label="Edit" />
                <th>Invoice</th>
                <th>Supplier</th>
                <th>Supplier ref</th>
                <th>Issue date</th>
                <th>Status</th>
                <th className={finance.numeric}>{moneyHeader('Total')}</th>
                <th className={finance.numeric}>{moneyHeader('Balance')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pager.paged.map((item) => (
                <tr key={item.id}>
                  <td className={finance.rowLead}>
                    {item.status === 'draft' ? (
                      <EditIconButton
                        label="Edit purchase invoice"
                        onClick={() =>
                          router.push(`/purchase-invoices/${item.id}?edit=1`)
                        }
                      />
                    ) : null}
                  </td>
                  <td>
                    <Link className={finance.link} href={`/purchase-invoices/${item.id}`}>
                      {item.number}
                    </Link>
                  </td>
                  <td>{item.supplier?.name || item.supplierId}</td>
                  <td>{item.supplierInvoiceNumber || '—'}</td>
                  <td>{new Date(item.issueDate).toLocaleDateString()}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td className={finance.numeric}>{amount(item.total)}</td>
                  <td className={finance.numeric}>{amount(item.balance)}</td>
                  <td>
                    {item.status === 'draft' ? (
                      <>
                        <button className={styles.ghost} onClick={() => void post(item.id)}>
                          Post
                        </button>
                        {isAdmin ? (
                          <button
                            className={`${styles.ghost} ${styles.danger}`}
                            onClick={() => void deleteDraft(item.id)}
                          >
                            Delete
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      ) : (
        <EmptyState>
          {items.length === 0
            ? 'No purchase invoices recorded.'
            : 'No purchase invoices match this filter.'}
        </EmptyState>
      )}
      {!showForm && filtered.length > 0 ? (
        <Pagination
          page={pager.page}
          setPage={pager.setPage}
          pageSize={pager.pageSize}
          setPageSize={pager.setPageSize}
          pageCount={pager.pageCount}
          total={pager.total}
        />
      ) : null}
      <Toast flash={flash} />
    </section>
  );
}
