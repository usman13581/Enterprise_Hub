'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { amount, day, label, moneyHeader } from '@/lib/format';
import { useFlash, usePolledItem } from '@/lib/useCollection';
import { Toast } from '@/components/ListControls';
import {
  BalanceStat,
  BackLink,
  EmptyState,
  LedgerTable,
  PdfButton,
  RowActionsBar,
  Stat,
  StatusBadge,
  TableScroll,
  Tabs,
} from '@/components/Finance';
import { AdvanceForm } from '@/components/MoneyForms';
import type { CustomerHub } from '@/lib/types';
import page from '../../page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

type Tab = 'jobs' | 'quotations' | 'invoices' | 'advances' | 'ledger';

export default function CustomerHubPage() {
  const params = useParams<{ id: string }>();
  const customerId = params?.id;
  const { item, error, setError, reload } = usePolledItem<CustomerHub>(
    customerId ? `/customers/${customerId}/hub` : null,
  );
  const { flash, notify } = useFlash();
  const [tab, setTab] = useState<Tab>('jobs');
  const [showAdvance, setShowAdvance] = useState(false);
  const reportRange = useMemo(() => {
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const to = now.toISOString().slice(0, 10);
    return { from, to };
  }, []);

  if (!item) {
    return (
      <section className={page.page}>
        <BackLink href="/customers">← Customers</BackLink>
        <header className={page.header}>
          <h1 className={page.title}>Customer</h1>
          {error ? (
            <p className={styles.error}>{error}</p>
          ) : (
            <p className={page.lede}>Loading…</p>
          )}
        </header>
      </section>
    );
  }

  const { customer, summary, byJob, quotations, jobs, invoices, advances, ledger } =
    item;

  return (
    <section className={page.page}>
      <BackLink href="/customers">← Customers</BackLink>

      <div className={finance.headerRow}>
        <header className={page.header}>
          <h1 className={page.title}>{customer.name}</h1>
          <p className={page.lede}>
            {[customer.contact, customer.phone, customer.email]
              .filter(Boolean)
              .join(' · ') || 'No contact details'}
            {customer.trn ? ` · TRN ${customer.trn}` : ''}
          </p>
        </header>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={finance.statGrid}>
        <Stat title={moneyHeader('Total billed')} value={amount(summary.billed)} />
        <Stat
          title={moneyHeader('Advances received')}
          value={amount(summary.advancesReceived)}
        />
        <BalanceStat title="Balance due" amount={summary.balanceDue} />
        <Stat
          title={moneyHeader('Unapplied advances')}
          value={amount(summary.unallocatedAdvances)}
          hint="Can be adjusted on the next invoice"
        />
        {summary.credited > 0 ? (
          <Stat title={moneyHeader('Credit notes')} value={amount(summary.credited)} />
        ) : null}
      </div>

      <div className={finance.actionBar}>
        <Link className={styles.button} href="/quotations">
          New quotation
        </Link>
        <button className={styles.ghost} onClick={() => setShowAdvance(true)}>
          Record advance
        </button>
        <Link className={styles.ghost} href="/invoices">
          New invoice
        </Link>
      </div>

      {showAdvance ? (
        <AdvanceForm
          customerId={customer.id}
          onSaved={async (message) => {
            setShowAdvance(false);
            await reload();
            notify(message);
          }}
          onError={setError}
          onCancel={() => setShowAdvance(false)}
        />
      ) : null}

      <p className={finance.sectionTitle}>Where the money sits</p>
      {byJob.length === 0 ? (
        <EmptyState>
          No jobs yet. Approve a quotation to open the first one.
        </EmptyState>
      ) : (
        <TableScroll>
          <table className={finance.table}>
            <thead>
              <tr>
                <th>Job</th>
                <th>Quotation</th>
                <th>Status</th>
                <th className={finance.numeric}>{moneyHeader('Job value')}</th>
                <th className={finance.numeric}>{moneyHeader('Invoiced')}</th>
                <th className={finance.numeric}>{moneyHeader('Advances')}</th>
                <th className={finance.numeric}>{moneyHeader('Balance')}</th>
              </tr>
            </thead>
            <tbody>
              {byJob.map((row) => (
                <tr key={row.jobId}>
                  <td>
                    <Link className={finance.link} href={`/jobs/${row.jobId}`}>
                      {row.jobNumber}
                    </Link>
                  </td>
                  <td>{row.quotationNumber ?? '—'}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td className={finance.numeric}>{amount(row.jobValue)}</td>
                  <td className={finance.numeric}>{amount(row.invoiced)}</td>
                  <td className={finance.numeric}>{amount(row.advances)}</td>
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
      )}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'jobs', label: 'Jobs', count: jobs.length },
          { key: 'quotations', label: 'Quotations', count: quotations.length },
          { key: 'invoices', label: 'Invoices', count: invoices.length },
          { key: 'advances', label: 'Advances', count: advances.length },
          { key: 'ledger', label: 'Ledger', count: ledger.length },
        ]}
      />

      {tab === 'jobs' ? (
        jobs.length === 0 ? (
          <EmptyState>No jobs for this customer.</EmptyState>
        ) : (
          <TableScroll>
            <table className={finance.table}>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Opened</th>
                  <th className={finance.numeric}>{moneyHeader('Job value')}</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <Link className={finance.link} href={`/jobs/${job.id}`}>
                        {job.number}
                      </Link>
                    </td>
                    <td>{job.title ?? '—'}</td>
                    <td>
                      <StatusBadge status={job.status} />
                    </td>
                    <td>{day(job.createdAt)}</td>
                    <td className={finance.numeric}>{amount(job.jobValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )
      ) : null}

      {tab === 'quotations' ? (
        quotations.length === 0 ? (
          <EmptyState>No quotations for this customer.</EmptyState>
        ) : (
          <TableScroll>
            <table className={finance.table}>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th className={finance.numeric}>{moneyHeader('Total')}</th>
                  <th>Job</th>
                  <th className={finance.actions} aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {quotations.map((quotation) => (
                  <tr key={quotation.id}>
                    <td>
                      <strong>{quotation.number}</strong>
                    </td>
                    <td>{quotation.title ?? '—'}</td>
                    <td>
                      <StatusBadge status={quotation.status} />
                    </td>
                    <td className={finance.numeric}>{amount(quotation.total)}</td>
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
                      </RowActionsBar>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )
      ) : null}

      {tab === 'invoices' ? (
        invoices.length === 0 ? (
          <EmptyState>No invoices for this customer.</EmptyState>
        ) : (
          <TableScroll>
            <table className={finance.table}>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Kind</th>
                  <th>Job</th>
                  <th>Issued</th>
                  <th>Status</th>
                  <th className={finance.numeric}>{moneyHeader('Total')}</th>
                  <th className={finance.numeric}>{moneyHeader('Net payable')}</th>
                  <th className={finance.actions} aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <strong>{invoice.number}</strong>
                    </td>
                    <td>{label(invoice.kind)}</td>
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
                      </RowActionsBar>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )
      ) : null}

      {tab === 'advances' ? (
        advances.length === 0 ? (
          <EmptyState>No advances from this customer.</EmptyState>
        ) : (
          <TableScroll>
            <table className={finance.table}>
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Job</th>
                  <th>Received</th>
                  <th>Method</th>
                  <th className={finance.numeric}>{moneyHeader('Amount')}</th>
                  <th className={finance.numeric}>{moneyHeader('Spare')}</th>
                  <th className={finance.actions} aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {advances.map((advance) => (
                  <tr key={advance.id}>
                    <td>
                      <strong>{advance.number}</strong>
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
                      </RowActionsBar>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )
      ) : null}

      {tab === 'ledger' ? (
        <>
          <div className={finance.actionBar}>
            <Link
              className={styles.ghost}
              href={`/reports/customer-statement?customerId=${customer.id}&from=${reportRange.from}&to=${reportRange.to}`}
            >
              Open customer ledger report
            </Link>
          </div>
          <LedgerTable rows={ledger} />
        </>
      ) : null}

      <Toast flash={flash} />
    </section>
  );
}
