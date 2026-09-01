'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { amount, day, moneyHeader } from '@/lib/format';
import { searchItems, usePagination, usePolledList } from '@/lib/useCollection';
import { Pagination, SearchBox } from '@/components/ListControls';
import { EmptyState, FilterBar, StatusBadge, TableScroll } from '@/components/Finance';
import type { JobListItem } from '@/lib/types';
import page from '../page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

type Filter = 'all' | 'open' | 'completed' | 'closed';

export default function JobsPage() {
  const { items, error } = usePolledList<JobListItem>('/jobs');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const byStatus =
      filter === 'all' ? items : items.filter((item) => item.status === filter);
    return searchItems(byStatus, query);
  }, [items, filter, query]);
  const pager = usePagination(filtered, `${filter}:${query}`);

  return (
    <section className={page.page}>
      <h1 className={page.title}>Jobs</h1>

      {error ? <p className={styles.error}>{error}</p> : null}

      <FilterBar
        active={filter}
        onChange={setFilter}
        options={[
          { key: 'all', label: 'All' },
          { key: 'open', label: 'Open' },
          { key: 'completed', label: 'Completed' },
          { key: 'closed', label: 'Closed' },
        ]}
      />

      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search by job number, customer, quotation…"
      />

      {filtered.length === 0 ? (
        <EmptyState>
          {items.length === 0
            ? 'No jobs yet. Approve a quotation to open the first one.'
            : 'No jobs match this filter.'}
        </EmptyState>
      ) : (
        <TableScroll>
          <table className={finance.table}>
            <thead>
              <tr>
                <th>Job</th>
                <th>Customer</th>
                <th>Quotation</th>
                <th>Status</th>
                <th className={finance.numeric}>{moneyHeader('Job value')}</th>
                <th className={finance.numeric}>{moneyHeader('Planned margin')}</th>
                <th className={finance.numeric}>Docs</th>
              </tr>
            </thead>
            <tbody>
              {pager.paged.map((job) => (
                <tr key={job.id}>
                  <td>
                    <Link className={finance.link} href={`/jobs/${job.id}`}>
                      {job.number}
                    </Link>
                    <div className={styles.cardMeta}>{day(job.createdAt)}</div>
                  </td>
                  <td>{job.customer?.name ?? '—'}</td>
                  <td>{job.quotation?.number ?? '—'}</td>
                  <td>
                    <StatusBadge status={job.status} />
                  </td>
                  <td className={finance.numeric}>{amount(job.jobValue)}</td>
                  <td className={finance.numeric}>
                    {amount(job.jobNet - job.purchaseTotal)}
                  </td>
                  <td className={finance.numeric}>
                    {job._count?.invoices ?? 0} inv · {job._count?.advances ?? 0}{' '}
                    adv
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
    </section>
  );
}
