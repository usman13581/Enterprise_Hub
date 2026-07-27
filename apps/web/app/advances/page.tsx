'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { apiDelete } from '@/lib/api';
import { day, label, money } from '@/lib/format';
import {
  searchItems,
  useFlash,
  usePagination,
  usePolledList,
} from '@/lib/useCollection';
import { Pagination, SearchBox, Toast } from '@/components/ListControls';
import { EmptyState, PdfButton, Stat } from '@/components/Finance';
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
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);

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

  async function onDelete(id: string) {
    try {
      await apiDelete(`/advances/${id}`);
      await reload();
      notify('Advance deleted', 'danger');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete');
    }
  }

  return (
    <section className={page.page}>
      <h1 className={page.title}>Advances</h1>
      <p className={page.lede}>
        Money received before invoicing. Recording an advance credits the
        customer immediately; applying it to an invoice only marks which document
        it settles.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={finance.statGrid}>
        <Stat title="Advances received" value={money(totals.received)} />
        <Stat
          title="Not yet applied"
          value={money(totals.spare)}
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

          {filtered.length === 0 ? (
            <EmptyState>
              {items.length === 0
                ? 'No advances recorded yet.'
                : 'No advances match your search.'}
            </EmptyState>
          ) : (
            <table className={finance.table}>
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Customer</th>
                  <th>Job</th>
                  <th>Received</th>
                  <th>Method</th>
                  <th className={finance.numeric}>Amount</th>
                  <th className={finance.numeric}>Spare</th>
                  <th />
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
                    <td className={finance.numeric}>{money(advance.amount)}</td>
                    <td className={finance.numeric}>
                      {money(advance.unallocatedAmount)}
                    </td>
                    <td>
                      <div className={finance.rowActions}>
                        <PdfButton
                          path={`/documents/advances/${advance.id}.pdf`}
                          onError={setError}
                        >
                          Receipt
                        </PdfButton>
                        {advance.allocatedAmount === 0 ? (
                          <button
                            className={`${styles.ghost} ${styles.danger}`}
                            onClick={() => void onDelete(advance.id)}
                          >
                            Delete
                          </button>
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
