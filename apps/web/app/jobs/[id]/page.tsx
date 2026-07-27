'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { apiPost } from '@/lib/api';
import { day, label, money, qty } from '@/lib/format';
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
import { AdvanceForm, JobInvoiceForm } from '@/components/MoneyForms';
import type { JobHub } from '@/lib/types';
import page from '../../page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

type Tab = 'invoices' | 'advances' | 'ledger' | 'quotation';
type Panel = 'progressive' | 'custom' | 'final' | 'advance' | null;

export default function JobHubPage() {
  const params = useParams<{ id: string }>();
  const jobId = params?.id;
  const { item, error, setError, reload } = usePolledItem<JobHub>(
    jobId ? `/jobs/${jobId}/hub` : null,
  );
  const { flash, notify } = useFlash();
  const [tab, setTab] = useState<Tab>('invoices');
  const [panel, setPanel] = useState<Panel>(null);

  if (!item) {
    return (
      <section className={page.page}>
        <Link className={finance.backLink} href="/jobs">
          ← Jobs
        </Link>
        <h1 className={page.title}>Job</h1>
        {error ? <p className={styles.error}>{error}</p> : <p className={page.lede}>Loading…</p>}
      </section>
    );
  }

  const { job, financials, invoices, advances, ledger } = item;
  const quotationLines = job.quotation?.lines ?? [];
  const canInvoice = job.status !== 'closed';

  async function transition(action: 'complete' | 'close', message: string) {
    try {
      await apiPost(`/jobs/${job.id}/${action}`, {});
      await reload();
      notify(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  async function cancelInvoice(id: string) {
    try {
      await apiPost(`/invoices/${id}/cancel`, {});
      await reload();
      notify('Invoice cancelled', 'danger');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel');
    }
  }

  async function afterWrite(message: string) {
    setPanel(null);
    await reload();
    notify(message);
  }

  return (
    <section className={page.page}>
      <Link className={finance.backLink} href="/jobs">
        ← Jobs
      </Link>

      <div className={finance.headerRow}>
        <div>
          <h1 className={page.title}>Job {job.number}</h1>
          <p className={page.lede}>
            {job.title ?? 'No subject'} ·{' '}
            <Link className={finance.link} href={`/customers/${job.customerId}`}>
              {job.customer?.name}
            </Link>
            {job.quotation ? ` · from quotation ${job.quotation.number}` : ''}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={finance.statGrid}>
        <Stat title="Job value" value={money(financials.jobValue)} hint="Incl. VAT" />
        <Stat
          title="Invoiced to date"
          value={money(financials.invoicedToDate)}
        />
        <BalanceStat
          title="Left to invoice"
          amount={financials.balanceRemaining}
        />
        <Stat
          title="Advances applied"
          value={money(financials.advancesApplied)}
        />
        <Stat
          title="Planned margin"
          value={money(financials.profit)}
          hint={`Cost ${money(financials.purchaseTotal)}`}
        />
      </div>

      <div className={finance.actionBar}>
        <button
          className={styles.button}
          disabled={!canInvoice}
          onClick={() => setPanel('progressive')}
        >
          Progressive invoice
        </button>
        <button
          className={styles.ghost}
          disabled={!canInvoice}
          onClick={() => setPanel('custom')}
        >
          Custom invoice
        </button>
        <button
          className={styles.ghost}
          disabled={!canInvoice || financials.balanceRemaining <= 0}
          onClick={() => setPanel('final')}
        >
          Final invoice
        </button>
        <button
          className={styles.ghost}
          disabled={!canInvoice}
          onClick={() => setPanel('advance')}
        >
          Record advance
        </button>
        {job.status === 'open' ? (
          <button
            className={styles.ghost}
            onClick={() => void transition('complete', 'Job marked complete')}
          >
            Mark complete
          </button>
        ) : null}
        {job.status !== 'closed' ? (
          <button
            className={`${styles.ghost} ${styles.danger}`}
            onClick={() => void transition('close', 'Job closed')}
          >
            Close job
          </button>
        ) : null}
      </div>

      {!canInvoice ? (
        <p className={finance.panelNote}>
          This job is closed. No further invoices or advances can be recorded
          against it.
        </p>
      ) : null}

      {panel === 'advance' ? (
        <AdvanceForm
          customerId={job.customerId}
          jobId={job.id}
          onSaved={(message) => void afterWrite(message)}
          onError={setError}
          onCancel={() => setPanel(null)}
        />
      ) : null}

      {panel && panel !== 'advance' ? (
        <JobInvoiceForm
          jobId={job.id}
          customerId={job.customerId}
          kind={panel}
          jobValue={financials.jobValue}
          balanceRemaining={financials.balanceRemaining}
          onSaved={(message) => void afterWrite(message)}
          onError={setError}
          onCancel={() => setPanel(null)}
        />
      ) : null}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'invoices', label: 'Invoices', count: invoices.length },
          { key: 'advances', label: 'Advances', count: advances.length },
          { key: 'ledger', label: 'Ledger', count: ledger.length },
          {
            key: 'quotation',
            label: 'Quotation lines',
            count: quotationLines.length,
          },
        ]}
      />

      {tab === 'invoices' ? (
        invoices.length === 0 ? (
          <EmptyState>No invoices raised against this job yet.</EmptyState>
        ) : (
          <table className={finance.table}>
            <thead>
              <tr>
                <th>Number</th>
                <th>Kind</th>
                <th>Issued</th>
                <th>Status</th>
                <th className={finance.numeric}>Total</th>
                <th className={finance.numeric}>Advance</th>
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
                  <td>{day(invoice.issueDate)}</td>
                  <td>
                    <StatusBadge status={invoice.status} />
                  </td>
                  <td className={finance.numeric}>{money(invoice.total)}</td>
                  <td className={finance.numeric}>
                    {money(invoice.advanceApplied)}
                  </td>
                  <td className={finance.numeric}>
                    {money(invoice.netPayable)}
                  </td>
                  <td>
                    <div className={finance.rowActions}>
                      <PdfButton
                        path={`/documents/invoices/${invoice.id}.pdf`}
                        onError={setError}
                      />
                      {invoice.status === 'issued' ? (
                        <button
                          className={`${styles.ghost} ${styles.danger}`}
                          onClick={() => void cancelInvoice(invoice.id)}
                        >
                          Cancel
                        </button>
                      ) : null}
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
          <EmptyState>No advances recorded against this job.</EmptyState>
        ) : (
          <table className={finance.table}>
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Received</th>
                <th>Method</th>
                <th className={finance.numeric}>Amount</th>
                <th className={finance.numeric}>Applied</th>
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
                  <td>{day(advance.receivedAt)}</td>
                  <td>{label(advance.method)}</td>
                  <td className={finance.numeric}>{money(advance.amount)}</td>
                  <td className={finance.numeric}>
                    {money(advance.allocatedAmount)}
                  </td>
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

      {tab === 'quotation' ? (
        quotationLines.length === 0 ? (
          <EmptyState>The source quotation has no lines.</EmptyState>
        ) : (
          <table className={finance.table}>
            <thead>
              <tr>
                <th>Description</th>
                <th>Unit</th>
                <th className={finance.numeric}>Qty</th>
                <th className={finance.numeric}>Purchase</th>
                <th className={finance.numeric}>Sell</th>
                <th className={finance.numeric}>Amount</th>
                <th className={finance.numeric}>Margin</th>
              </tr>
            </thead>
            <tbody>
              {quotationLines.map((line) => (
                <tr key={line.id}>
                  <td>{line.description}</td>
                  <td>{line.unit}</td>
                  <td className={finance.numeric}>{qty(line.qty)}</td>
                  <td className={finance.numeric}>
                    {money(line.purchasePrice)}
                  </td>
                  <td className={finance.numeric}>{money(line.sellPrice)}</td>
                  <td className={finance.numeric}>{money(line.lineTotal)}</td>
                  <td className={finance.numeric}>
                    {money((line.sellPrice - line.purchasePrice) * line.qty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}

      <Toast flash={flash} />
    </section>
  );
}
