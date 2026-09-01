'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type ComponentProps } from 'react';
import { apiPost } from '@/lib/api';
import { Pagination, SearchBox, Toast } from '@/components/ListControls';
import { EmptyState, EditIconButton, FilterBar, StatusBadge, TableScroll } from '@/components/Finance';
import { LpoQuickForm } from '@/components/PurchasingForms';
import { searchItems, useFlash, usePagination, usePolledList } from '@/lib/useCollection';
import { amount, moneyHeader } from '@/lib/format';
import type { Lpo, Product, Supplier } from '@marble/types';
import page from '../page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

type Filter =
  | 'all'
  | 'draft'
  | 'approved'
  | 'sent'
  | 'partially_received'
  | 'closed'
  | 'cancelled';

export default function LposPage() {
  const router = useRouter();
  const { items, error, setError, reload } = usePolledList<Lpo>('/lpos');
  const { items: suppliers } = usePolledList<Supplier>('/suppliers');
  const { items: products } = usePolledList<Product>('/products');
  const { flash, notify } = useFlash();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const filtered = useMemo(() => {
    const byStatus =
      filter === 'all' ? items : items.filter((item) => item.status === filter);
    return searchItems(byStatus, query);
  }, [items, filter, query]);
  const pager = usePagination(filtered, `${filter}:${query}`);

  async function create(
    payload: Parameters<ComponentProps<typeof LpoQuickForm>['onCreate']>[0],
  ) {
    if (saving) return;
    setSaving(true);
    try {
      await apiPost('/lpos', payload);
      setShowForm(false);
      await reload();
      notify('LPO saved as draft');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create LPO');
    } finally {
      setSaving(false);
    }
  }

  async function transition(id: string, action: 'approve' | 'send' | 'cancel') {
    try {
      await apiPost(`/lpos/${id}/${action}`, {});
      await reload();
      notify(`LPO ${action}d`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${action} LPO`);
    }
  }

  return (
    <section className={page.page}>
      <h1 className={page.title}>Purchase Orders</h1>
      {error ? <p className={styles.error}>{error}</p> : null}
      {showForm ? (
        <LpoQuickForm
          suppliers={suppliers}
          products={products}
          saving={saving}
          onCreate={create}
          onCancel={() => setShowForm(false)}
        />
      ) : null}
      {!showForm ? (
        <>
          <div className={styles.toolbar}>
            <span className={styles.count}>{items.length} LPOs</span>
            <button className={styles.button} onClick={() => setShowForm(true)}>
              Create new LPO
            </button>
          </div>
          <FilterBar
            active={filter}
            onChange={setFilter}
            options={[
              { key: 'all', label: 'All' },
              { key: 'draft', label: 'Draft' },
              { key: 'approved', label: 'Approved' },
              { key: 'sent', label: 'Sent' },
              { key: 'partially_received', label: 'Partially received' },
              { key: 'closed', label: 'Closed' },
              { key: 'cancelled', label: 'Cancelled' },
            ]}
          />
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search LPOs or suppliers…"
          />
        </>
      ) : null}
      {filtered.length ? (
        <TableScroll>
          <table className={finance.table}>
            <thead>
              <tr>
                <th className={finance.rowLead} aria-label="Edit" />
                <th>LPO</th>
                <th>Supplier</th>
                <th>Status</th>
                <th className={finance.numeric}>{moneyHeader('Total')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pager.paged.map((item) => (
                <tr key={item.id}>
                  <td className={finance.rowLead}>
                    {item.status === 'draft' ? (
                      <EditIconButton
                        label="Edit LPO"
                        onClick={() =>
                          router.push(`/purchase-orders/${item.id}?edit=1`)
                        }
                      />
                    ) : null}
                  </td>
                  <td>
                    <Link className={finance.link} href={`/purchase-orders/${item.id}`}>
                      {item.number}
                    </Link>
                  </td>
                  <td>{item.supplier?.name || item.supplierId}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td className={finance.numeric}>
                    {amount(item.total)}
                  </td>
                  <td>
                    {item.status === 'draft' ? (
                      <button
                        className={styles.ghost}
                        onClick={() => void transition(item.id, 'approve')}
                      >
                        Approve
                      </button>
                    ) : item.status === 'approved' ? (
                      <button
                        className={styles.ghost}
                        onClick={() => void transition(item.id, 'send')}
                      >
                        Send
                      </button>
                    ) : item.status === 'sent' ? (
                      <button
                        className={styles.ghost}
                        onClick={() => void transition(item.id, 'cancel')}
                      >
                        Cancel
                      </button>
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
            ? 'No LPOs yet.'
            : 'No LPOs match this filter.'}
        </EmptyState>
      )}
      <Pagination page={pager.page} setPage={pager.setPage} pageSize={pager.pageSize} setPageSize={pager.setPageSize} pageCount={pager.pageCount} total={pager.total} />
      <Toast flash={flash} />
    </section>
  );
}
