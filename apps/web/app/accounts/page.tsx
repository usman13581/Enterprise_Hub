'use client';

import Link from 'next/link';
import { useState } from 'react';
import { amount, moneyHeader } from '@/lib/format';
import {
  searchItems,
  usePagination,
  usePolledItem,
} from '@/lib/useCollection';
import { Pagination, SearchBox } from '@/components/ListControls';
import {
  BalanceStat,
  EmptyState,
  Stat,
  StatusBadge,
  TableScroll,
  Tabs,
} from '@/components/Finance';
import type { AccountsOverview } from '@/lib/types';
import page from '../page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

type Tab = 'receivables' | 'payables' | 'profit';

export default function AccountsPage() {
  const { item, error } = usePolledItem<AccountsOverview>('/accounts/overview');
  const [tab, setTab] = useState<Tab>('receivables');
  const [query, setQuery] = useState('');
  const filteredReceivables = searchItems(
    item?.receivableByCustomer ?? [],
    query,
  );
  const filteredPayables = searchItems(item?.payableBySupplier ?? [], query);
  const filteredProfit = searchItems(item?.profitByJob ?? [], query);
  const receivablesPager = usePagination(
    filteredReceivables,
    `receivables:${query}`,
  );
  const payablesPager = usePagination(filteredPayables, `payables:${query}`);
  const profitPager = usePagination(filteredProfit, `profit:${query}`);

  if (!item) {
    return (
      <section className={page.page}>
        <header className={page.header}>
          <h1 className={page.title}>Accounts</h1>
          {error ? (
            <p className={styles.error}>{error}</p>
          ) : (
            <p className={page.lede}>Loading…</p>
          )}
        </header>
      </section>
    );
  }

  return (
    <section className={page.page}>
      <h1 className={page.title}>Accounts</h1>

      <div className={finance.statGrid}>
        <Stat title={moneyHeader('Total billed')} value={amount(item.summary.billed)} />
        <Stat
          title={moneyHeader('Advances received')}
          value={amount(item.summary.advancesReceived)}
        />
        <BalanceStat
          title="Receivable"
          amount={item.summary.balanceDue}
        />
        <BalanceStat
          title="Payable"
          amount={item.totalPayable}
        />
        <Stat
          title={moneyHeader('Unapplied advances')}
          value={amount(item.summary.unallocatedAdvances)}
        />
        <Stat
          title={moneyHeader('Credit notes')}
          value={amount(item.summary.credited)}
        />
        <Stat
          title={moneyHeader('Planned margin')}
          value={amount(item.totalProfit)}
          hint={`${item.openJobs} job${item.openJobs === 1 ? '' : 's'} still open`}
        />
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          {
            key: 'receivables',
            label: 'Receivable by customer',
            count: item.receivableByCustomer.length,
          },
          {
            key: 'payables',
            label: 'Payable by supplier',
            count: item.payableBySupplier.length,
          },
          {
            key: 'profit',
            label: 'Margin by job',
            count: item.profitByJob.length,
          },
        ]}
      />

      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder={
          tab === 'receivables'
            ? 'Search customers…'
            : tab === 'payables'
              ? 'Search suppliers…'
              : 'Search jobs or customers…'
        }
      />

      {tab === 'receivables' ? (
        filteredReceivables.length === 0 ? (
          <EmptyState>No customer activity yet.</EmptyState>
        ) : (
          <TableScroll>
            <table className={finance.table}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className={finance.numeric}>{moneyHeader('Billed')}</th>
                  <th className={finance.numeric}>{moneyHeader('Received')}</th>
                  <th className={finance.numeric}>{moneyHeader('Balance')}</th>
                </tr>
              </thead>
              <tbody>
                {receivablesPager.paged.map((row) => (
                  <tr key={row.customerId}>
                    <td>
                      <Link
                        className={finance.link}
                        href={`/customers/${row.customerId}`}
                      >
                        {row.customerName}
                      </Link>
                    </td>
                    <td className={finance.numeric}>{amount(row.billed)}</td>
                    <td className={finance.numeric}>{amount(row.received)}</td>
                    <td
                      className={`${finance.numeric} ${
                        row.balance > 0 ? finance.due : finance.clear
                      }`}
                    >
                      {amount(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )
      ) : null}

      {tab === 'payables' ? (
        filteredPayables.length === 0 ? (
          <EmptyState>No supplier payables yet.</EmptyState>
        ) : (
          <TableScroll>
            <table className={finance.table}>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th className={finance.numeric}>{moneyHeader('Invoiced')}</th>
                  <th className={finance.numeric}>{moneyHeader('Paid')}</th>
                  <th className={finance.numeric}>{moneyHeader('Balance')}</th>
                </tr>
              </thead>
              <tbody>
                {payablesPager.paged.map((row) => (
                  <tr key={row.supplierId}>
                    <td>
                      <Link
                        className={finance.link}
                        href={`/suppliers/${row.supplierId}`}
                      >
                        {row.supplierName}
                      </Link>
                    </td>
                    <td className={finance.numeric}>{amount(row.invoiced)}</td>
                    <td className={finance.numeric}>{amount(row.paid)}</td>
                    <td
                      className={`${finance.numeric} ${
                        row.balance > 0 ? finance.due : finance.clear
                      }`}
                    >
                      {amount(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )
      ) : null}

      {tab === 'profit' ? (
        filteredProfit.length === 0 ? (
          <EmptyState>No jobs yet.</EmptyState>
        ) : (
          <TableScroll>
            <table className={finance.table}>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th className={finance.numeric}>{moneyHeader('Job value')}</th>
                  <th className={finance.numeric}>{moneyHeader('Cost')}</th>
                  <th className={finance.numeric}>{moneyHeader('Margin')}</th>
                </tr>
              </thead>
              <tbody>
                {profitPager.paged.map((row) => (
                  <tr key={row.jobId}>
                    <td>
                      <Link className={finance.link} href={`/jobs/${row.jobId}`}>
                        {row.jobNumber}
                      </Link>
                    </td>
                    <td>{row.customerName}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td className={finance.numeric}>{amount(row.jobValue)}</td>
                    <td className={finance.numeric}>{amount(row.purchaseTotal)}</td>
                    <td
                      className={`${finance.numeric} ${
                        row.profit < 0 ? finance.due : ''
                      }`}
                    >
                      {amount(row.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )
      ) : null}
      {tab === 'receivables' && filteredReceivables.length > 0 ? (
        <Pagination
          page={receivablesPager.page}
          setPage={receivablesPager.setPage}
          pageSize={receivablesPager.pageSize}
          setPageSize={receivablesPager.setPageSize}
          pageCount={receivablesPager.pageCount}
          total={receivablesPager.total}
        />
      ) : null}
      {tab === 'payables' && filteredPayables.length > 0 ? (
        <Pagination
          page={payablesPager.page}
          setPage={payablesPager.setPage}
          pageSize={payablesPager.pageSize}
          setPageSize={payablesPager.setPageSize}
          pageCount={payablesPager.pageCount}
          total={payablesPager.total}
        />
      ) : null}
      {tab === 'profit' && filteredProfit.length > 0 ? (
        <Pagination
          page={profitPager.page}
          setPage={profitPager.setPage}
          pageSize={profitPager.pageSize}
          setPageSize={profitPager.setPageSize}
          pageCount={profitPager.pageCount}
          total={profitPager.total}
        />
      ) : null}
    </section>
  );
}
