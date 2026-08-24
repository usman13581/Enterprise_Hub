'use client';

import Link from 'next/link';
import { useState } from 'react';
import { money } from '@/lib/format';
import { usePolledItem } from '@/lib/useCollection';
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

type Tab = 'receivables' | 'profit';

export default function AccountsPage() {
  const { item, error } = usePolledItem<AccountsOverview>('/accounts/overview');
  const [tab, setTab] = useState<Tab>('receivables');

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
      <p className={page.lede}>
        Company position across every customer and job. Balances come from the
        ledger, so they always agree with the individual statements.
      </p>

      <div className={finance.statGrid}>
        <Stat title="Total billed" value={money(item.summary.billed)} />
        <Stat
          title="Advances received"
          value={money(item.summary.advancesReceived)}
        />
        <BalanceStat
          title="Receivable"
          amount={item.summary.balanceDue}
        />
        <Stat
          title="Unapplied advances"
          value={money(item.summary.unallocatedAdvances)}
        />
        <Stat
          title="Credit notes"
          value={money(item.summary.credited)}
        />
        <Stat
          title="Planned margin"
          value={money(item.totalProfit)}
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
            key: 'profit',
            label: 'Margin by job',
            count: item.profitByJob.length,
          },
        ]}
      />

      {tab === 'receivables' ? (
        item.receivableByCustomer.length === 0 ? (
          <EmptyState>No customer activity yet.</EmptyState>
        ) : (
          <TableScroll>
            <table className={finance.table}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className={finance.numeric}>Billed</th>
                  <th className={finance.numeric}>Received</th>
                  <th className={finance.numeric}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {item.receivableByCustomer.map((row) => (
                  <tr key={row.customerId}>
                    <td>
                      <Link
                        className={finance.link}
                        href={`/customers/${row.customerId}`}
                      >
                        {row.customerName}
                      </Link>
                    </td>
                    <td className={finance.numeric}>{money(row.billed)}</td>
                    <td className={finance.numeric}>{money(row.received)}</td>
                    <td
                      className={`${finance.numeric} ${
                        row.balance > 0 ? finance.due : finance.clear
                      }`}
                    >
                      {money(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )
      ) : null}

      {tab === 'profit' ? (
        item.profitByJob.length === 0 ? (
          <EmptyState>No jobs yet.</EmptyState>
        ) : (
          <TableScroll>
            <table className={finance.table}>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th className={finance.numeric}>Job value</th>
                  <th className={finance.numeric}>Cost</th>
                  <th className={finance.numeric}>Margin</th>
                </tr>
              </thead>
              <tbody>
                {item.profitByJob.map((row) => (
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
                    <td className={finance.numeric}>{money(row.jobValue)}</td>
                    <td className={finance.numeric}>{money(row.purchaseTotal)}</td>
                    <td
                      className={`${finance.numeric} ${
                        row.profit < 0 ? finance.due : ''
                      }`}
                    >
                      {money(row.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )
      ) : null}
    </section>
  );
}
