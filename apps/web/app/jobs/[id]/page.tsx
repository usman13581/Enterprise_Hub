'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { apiPost } from '@/lib/api';
import { amount, day, label, moneyHeader, qty } from '@/lib/format';
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
        <BackLink href="/jobs">← Jobs</BackLink>
        <header className={page.header}>
          <h1 className={page.title}>Job</h1>
          {error ? (
            <p className={styles.error}>{error}</p>
          ) : (
            <p className={page.lede}>Loading…</p>
          )}
        </header>
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

  async function issueInvoice(id: string) {
    try {
      await apiPost(`/invoices/${id}/issue`, {});
      await reload();
      notify('Invoice issued');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not issue');
    }
  }

  async function approveAdvance(id: string) {
    try {
      await apiPost(`/advances/${id}/approve`, {});
      await reload();
      notify('Advance approved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve');
    }
  }

  async function afterWrite(message: string) {
    setPanel(null);
    await reload();
    notify(message);
  }

  return (
    <section className={page.page}>
      <BackLink href="/jobs">← Jobs</BackLink>

      <div className={finance.headerRow}>
        <header className={page.header}>
          <h1 className={page.title}>Job {job.number}</h1>
          <p className={page.lede}>
            {job.title ?? 'No subject'} ·{' '}
            <Link className={finance.link} href={`/customers/${job.customerId}`}>
              {job.customer?.name}
            </Link>
            {job.quotation ? ` · from quotation ${job.quotation.number}` : ''}
          </p>
        </header>
        <StatusBadge status={job.status} />
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={finance.statGrid}>
        <Stat title={moneyHeader('Job value')} value={amount(financials.jobValue)} hint="Incl. VAT" />
        <Stat
          title={moneyHeader('Invoiced to date')}
          value={amount(financials.invoicedToDate)}
        />
        <BalanceStat
          title="Left to invoice"
          amount={financials.balanceRemaining}
        />
        <Stat
          title={moneyHeader('Advances applied')}
          value={amount(financials.advancesApplied)}
        />
        <Stat
          title={moneyHeader('Planned margin')}
          value={amount(financials.profit)}
          hint={`Cost ${amount(financials.purchaseTotal)}`}
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
          <TableScroll>
            <table className={finance.table}>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Kind</th>
                  <th>Issued</th>
                  <th>Status</th>
                  <th className={finance.numeric}>{moneyHeader('Total')}</th>
                  <th className={finance.numeric}>{moneyHeader('Advance')}</th>
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
                    <td>{day(invoice.issueDate)}</td>
                    <td>
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className={finance.numeric}>{amount(invoice.total)}</td>
                    <td className={finance.numeric}>
                      {amount(invoice.advanceApplied)}
                    </td>
                    <td className={finance.numeric}>
                      {amount(invoice.netPayable)}
                    </td>
                    <td className={finance.actions}>
                      <RowActionsBar>
                        <PdfButton
                          path={`/documents/invoices/${invoice.id}.pdf`}
                          onError={setError}
                        />
                        {invoice.status === 'draft' ? (
                          <button
                            className={styles.button}
                            onClick={() => void issueInvoice(invoice.id)}
                          >
                            Issue
                          </button>
                        ) : null}
                        {invoice.status === 'issued' || invoice.status === 'draft' ? (
                          <button
                            className={`${styles.ghost} ${styles.danger}`}
                            onClick={() => void cancelInvoice(invoice.id)}
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
        )
      ) : null}

      {tab === 'advances' ? (
        advances.length === 0 ? (
          <EmptyState>No advances recorded against this job.</EmptyState>
        ) : (
          <TableScroll>
            <table className={finance.table}>
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Received</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th className={finance.numeric}>{moneyHeader('Amount')}</th>
                  <th className={finance.numeric}>{moneyHeader('Applied')}</th>
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
                    <td>{day(advance.receivedAt)}</td>
                    <td>{label(advance.method)}</td>
                    <td>
                      <StatusBadge
                        status={
                          advance.status ??
                          (advance.cancelledAt ? 'cancelled' : 'posted')
                        }
                      />
                    </td>
                    <td className={finance.numeric}>{amount(advance.amount)}</td>
                    <td className={finance.numeric}>
                      {amount(advance.allocatedAmount)}
                    </td>
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
                            onClick={() => void approveAdvance(advance.id)}
                          >
                            Approve
                          </button>
                        ) : null}
                      </RowActionsBar>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )
      ) : null}

      {tab === 'ledger' ? <LedgerTable rows={ledger} /> : null}

      {tab === 'quotation' ? (
        quotationLines.length === 0 ? (
          <EmptyState>The source quotation has no lines.</EmptyState>
        ) : (
          <TableScroll>
            <table className={finance.table}>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Unit</th>
                  <th className={finance.numeric}>Qty</th>
                  <th className={finance.numeric}>{moneyHeader('Purchase')}</th>
                  <th className={finance.numeric}>{moneyHeader('Sell')}</th>
                  <th className={finance.numeric}>{moneyHeader('Amount')}</th>
                  <th className={finance.numeric}>{moneyHeader('Margin')}</th>
                </tr>
              </thead>
              <tbody>
                {quotationLines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.description}</td>
                    <td>{line.unit}</td>
                    <td className={finance.numeric}>{qty(line.qty)}</td>
                    <td className={finance.numeric}>
                      {amount(line.purchasePrice)}
                    </td>
                    <td className={finance.numeric}>{amount(line.sellPrice)}</td>
                    <td className={finance.numeric}>{amount(line.lineTotal)}</td>
                    <td className={finance.numeric}>
                      {amount((line.sellPrice - line.purchasePrice) * line.qty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )
      ) : null}

      <Toast flash={flash} />
    </section>
  );
}
