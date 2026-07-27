'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { day, label, money } from '@/lib/format';
import { useFlash, usePolledItem } from '@/lib/useCollection';
import { Toast } from '@/components/ListControls';
import {
  BalanceStat,
  EmptyState,
  LedgerTable,
  PdfButton,
  Stat,
  StatusBadge,
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

  if (!item) {
    return (
      <section className={page.page}>
        <Link className={finance.backLink} href="/customers">
          ← Customers
        </Link>
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
      <Link className={finance.backLink} href="/customers">
        ← Customers
      </Link>

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
        <Stat title="Total billed" value={money(summary.billed)} />
        <Stat
          title="Advances received"
          value={money(summary.advancesReceived)}
        />
        <BalanceStat title="Balance due" amount={summary.balanceDue} />
        <Stat
          title="Unapplied advances"
          value={money(summary.unallocatedAdvances)}
          hint="Can be adjusted on the next invoice"
        />
        {summary.credited > 0 ? (
          <Stat title="Credit notes" value={money(summary.credited)} />
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
        <table className={finance.table}>
          <thead>
            <tr>
              <th>Job</th>
              <th>Quotation</th>
              <th>Status</th>
              <th className={finance.numeric}>Job value</th>
              <th className={finance.numeric}>Invoiced</th>
              <th className={finance.numeric}>Advances</th>
              <th className={finance.numeric}>Balance</th>
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
                <td className={finance.numeric}>{money(row.jobValue)}</td>
                <td className={finance.numeric}>{money(row.invoiced)}</td>
                <td className={finance.numeric}>{money(row.advances)}</td>
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
          <table className={finance.table}>
            <thead>
              <tr>
                <th>Job</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Opened</th>
                <th className={finance.numeric}>Job value</th>
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
                  <td className={finance.numeric}>{money(job.jobValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}

      {tab === 'quotations' ? (
        quotations.length === 0 ? (
          <EmptyState>No quotations for this customer.</EmptyState>
        ) : (
          <table className={finance.table}>
            <thead>
              <tr>
                <th>Number</th>
                <th>Subject</th>
                <th>Status</th>
                <th className={finance.numeric}>Total</th>
                <th>Job</th>
                <th />
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
                  <td className={finance.numeric}>{money(quotation.total)}</td>
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}

      {tab === 'invoices' ? (
        invoices.length === 0 ? (
          <EmptyState>No invoices for this customer.</EmptyState>
        ) : (
          <table className={finance.table}>
            <thead>
              <tr>
                <th>Number</th>
                <th>Kind</th>
                <th>Job</th>
                <th>Issued</th>
                <th>Status</th>
                <th className={finance.numeric}>Total</th>
                <th className={finance.numeric}>Net payable</th>
                <th />
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
                  <td className={finance.numeric}>{money(invoice.total)}</td>
                  <td className={finance.numeric}>
                    {money(invoice.netPayable)}
                  </td>
                  <td>
                    <div className={finance.rowActions}>
                      <PdfButton
                        path={`/documents/invoices/${invoice.id}.pdf`}
                        onError={setError}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}

      {tab === 'advances' ? (
        advances.length === 0 ? (
          <EmptyState>No advances from this customer.</EmptyState>
        ) : (
          <table className={finance.table}>
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Job</th>
                <th>Received</th>
                <th>Method</th>
                <th className={finance.numeric}>Amount</th>
                <th className={finance.numeric}>Spare</th>
                <th />
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}

      {tab === 'ledger' ? <LedgerTable rows={ledger} /> : null}

      <Toast flash={flash} />
    </section>
  );
}
