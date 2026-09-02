'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { apiDelete, apiPost } from '@/lib/api';
import { useCompanyAdmin } from '@/lib/useCompanyAdmin';
import { amount, day, label, moneyHeader } from '@/lib/format';
import {
  searchItems,
  useFlash,
  usePagination,
  usePolledList,
} from '@/lib/useCollection';
import { Pagination, SearchBox, Toast } from '@/components/ListControls';
import { EmptyState, FilterBar, PdfButton, RowActionsBar, Stat, StatusBadge, TableScroll } from '@/components/Finance';
import { AdvanceForm } from '@/components/MoneyForms';
import type { AdvancePayment, Customer } from '@/lib/types';
import page from '../page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

export default function AdvancesPage() {
  const { items, error, setError, reload } =
    usePolledList<AdvancePayment>('/advances');
  const { items: customers } = usePolledList<Customer>('/customers', 20000);
  const { flash, notify } = useFlash();
  const isAdmin = useCompanyAdmin();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'draft' | 'posted' | 'cancelled'>('all');
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    const byStatus =
      filter === 'all'
        ? items
        : filter === 'cancelled'
          ? items.filter((item) => item.cancelledAt || item.status === 'cancelled')
          : items.filter((item) => item.status === filter);
    return searchItems(byStatus, query);
  }, [items, filter, query]);
  const pager = usePagination(filtered, `${filter}:${query}`);

  const totals = useMemo(
    () =>
      items
        .filter((advance) => advance.status === 'posted' && !advance.cancelledAt)
        .reduce(
          (acc, advance) => ({
            received: acc.received + advance.amount,
            spare: acc.spare + advance.unallocatedAmount,
          }),
          { received: 0, spare: 0 },
        ),
    [items],
  );

  async function onApprove(id: string) {
    try {
      await apiPost(`/advances/${id}/approve`, {});
      await reload();
      notify('Advance approved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve');
    }
  }

  async function onDeleteDraft(id: string) {
    if (!window.confirm('Delete this draft permanently? This cannot be undone.')) {
      return;
    }
    try {
      await apiDelete(`/advances/${id}`);
      await reload();
      notify('Advance deleted', 'danger');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete');
    }
  }

  async function onCancel(id: string) {
    try {
      await apiPost(`/advances/${id}/cancel`, {});
      await reload();
      notify('Advance cancelled');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel');
    }
  }

  return (
    <section className={page.page}>
      <h1 className={page.title}>Advances</h1>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={finance.statGrid}>
        <Stat title={moneyHeader('Advances received')} value={amount(totals.received)} />
        <Stat
          title={moneyHeader('Not yet applied')}
          value={amount(totals.spare)}
          hint="Available to adjust on a future invoice"
        />
      </div>

      {showForm ? (
        <AdvanceForm
          customers={customers}
          onSaved={async (message) => {
            setShowForm(false);
            await reload();
            notify(message);
          }}
          onError={setError}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <>
          <div className={styles.toolbar}>
            <span className={styles.count}>{items.length} receipts</span>
            <button
              className={styles.button}
              onClick={() => setShowForm(true)}
              disabled={customers.length === 0}
            >
              Record advance
            </button>
          </div>

          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search by receipt number, customer, reference…"
          />

          <FilterBar
            active={filter}
            onChange={setFilter}
            options={[
              { key: 'all', label: 'All' },
              { key: 'draft', label: 'Draft' },
              { key: 'posted', label: 'Posted' },
              { key: 'cancelled', label: 'Cancelled' },
            ]}
          />

          {filtered.length === 0 ? (
            <EmptyState>
              {items.length === 0
                ? 'No advances recorded yet.'
                : 'No advances match your search.'}
            </EmptyState>
          ) : (
            <TableScroll>
              <table className={finance.table}>
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th>Customer</th>
                    <th>Job</th>
                    <th>Received</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th className={finance.numeric}>{moneyHeader('Amount')}</th>
                    <th className={finance.numeric}>{moneyHeader('Spare')}</th>
                    <th className={finance.actions} aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {pager.paged.map((advance) => (
                    <tr key={advance.id}>
                      <td>
                        <strong>{advance.number}</strong>
                      </td>
                      <td>
                        <Link
                          className={finance.link}
                          href={`/customers/${advance.customerId}`}
                        >
                          {advance.customer?.name ?? '—'}
                        </Link>
                      </td>
                      <td>
                        {advance.job ? (
                          <Link
                            className={finance.link}
                            href={`/jobs/${advance.job.id}`}
                          >
                            {advance.job.number}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{day(advance.receivedAt)}</td>
                      <td>{label(advance.method)}</td>
                      <td>
                        <StatusBadge
                          status={
                            advance.cancelledAt ? 'cancelled' : advance.status
                          }
                        />
                      </td>
                      <td className={finance.numeric}>{amount(advance.amount)}</td>
                      <td className={finance.numeric}>
                        {amount(advance.unallocatedAmount)}
                      </td>
                      <td className={finance.actions}>
                        <RowActionsBar>
                          <PdfButton
                            path={`/documents/advances/${advance.id}.pdf`}
                            onError={setError}
                          >
                            Receipt
                          </PdfButton>
                          {advance.status === 'draft' ? (
                            <button
                              className={styles.button}
                              onClick={() => void onApprove(advance.id)}
                            >
                              Approve
                            </button>
                          ) : null}
                          {advance.status === 'draft' && isAdmin ? (
                            <button
                              className={`${styles.ghost} ${styles.danger}`}
                              onClick={() => void onDeleteDraft(advance.id)}
                            >
                              Delete
                            </button>
                          ) : null}
                          {advance.allocatedAmount === 0 &&
                          !advance.cancelledAt &&
                          !(advance.status === 'draft' && isAdmin) ? (
                            <button
                              className={styles.ghost}
                              onClick={() => void onCancel(advance.id)}
                            >
                              Cancel
                            </button>
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
