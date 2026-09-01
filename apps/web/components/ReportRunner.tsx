'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { money } from '@/lib/format';
import { searchItems, usePagination, usePolledList } from '@/lib/useCollection';
import { Pagination, SearchBox } from '@/components/ListControls';
import {
  BackLink,
  EmptyState,
  PdfButton,
  Stat,
  TableScroll,
} from '@/components/Finance';
import { SearchableSelect } from '@/components/SearchableSelect';
import type { Customer, JobListItem } from '@/lib/types';
import type { Supplier } from '@marble/types';
import page from '../app/page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

export type ReportColumn = {
  key: string;
  label: string;
  align?: 'left' | 'right';
  money?: boolean;
};

export type ReportStat = {
  label: string;
  value: string | number;
  money?: boolean;
};

export type ReportResult = {
  key: string;
  title: string;
  params: Record<string, string | null>;
  summary: ReportStat[];
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null>>;
  footerNote?: string | null;
};

export type ReportParamsConfig = {
  from?: boolean;
  to?: boolean;
  asOf?: boolean;
  customerId?: boolean;
  jobId?: boolean;
  supplierId?: boolean;
  supplierRequired?: boolean;
  kind?: boolean;
  status?: boolean;
  customerRequired?: boolean;
  jobRequired?: boolean;
};

function monthBounds() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date();
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    asOf: to.toISOString().slice(0, 10),
  };
}

function buildQuery(params: Record<string, string>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function ReportRunner({
  title,
  apiPath,
  pdfPath,
  paramConfig,
  backHref = '/reports',
}: {
  title: string;
  apiPath: string;
  pdfPath: string;
  paramConfig: ReportParamsConfig;
  backHref?: string;
}) {
  const defaults = useMemo(() => monthBounds(), []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [asOf, setAsOf] = useState(defaults.asOf);
  const [customerId, setCustomerId] = useState('');
  const [jobId, setJobId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState(
    paramConfig.status ? 'issued' : 'all',
  );
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rowQuery, setRowQuery] = useState('');

  const { items: customers } = usePolledList<Customer>('/customers', 30_000);
  const { items: jobs } = usePolledList<JobListItem>('/jobs', 30_000);
  const { items: suppliers } = usePolledList<Supplier>('/suppliers', 30_000);
  const reportRows = result?.rows ?? [];
  const filteredRows = searchItems(reportRows, rowQuery);
  const rowPager = usePagination(filteredRows, rowQuery);

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (paramConfig.from) params.from = from;
    if (paramConfig.to) params.to = to;
    if (paramConfig.asOf) params.asOf = asOf;
    if (paramConfig.customerId && customerId) params.customerId = customerId;
    if (paramConfig.jobId && jobId) params.jobId = jobId;
    if (paramConfig.supplierId && supplierId) params.supplierId = supplierId;
    if (paramConfig.kind && kind !== 'all') params.kind = kind;
    if (paramConfig.status && status !== 'all') params.status = status;
    return params;
  }, [
    paramConfig,
    from,
    to,
    asOf,
    customerId,
    jobId,
    supplierId,
    kind,
    status,
  ]);

  async function run(params = queryParams) {
    if (paramConfig.customerRequired && !params.customerId) {
      setError('Select a customer');
      return;
    }
    if (paramConfig.jobRequired && !params.jobId) {
      setError('Select a job');
      return;
    }
    if (paramConfig.supplierRequired && !params.supplierId) {
      setError('Select a supplier');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ReportResult>(
        `${apiPath}${buildQuery(params)}`,
      );
      setResult(data);
      setApplied(params);
      setRowQuery('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (paramConfig.customerRequired || paramConfig.jobRequired) return;
    void run(queryParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  const pdfFullPath = `${pdfPath}${buildQuery(applied)}`;

  return (
    <section className={page.page}>
      <BackLink href={backHref}>← Reports</BackLink>
      <h1 className={page.title}>{result?.title ?? title}</h1>
      <p className={page.lede}>
        Adjust parameters, run the report, then print the same numbers as PDF.
      </p>

      <div className={finance.paramBar}>
        {paramConfig.from ? (
          <label className={finance.paramField}>
            <span>From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
        ) : null}
        {paramConfig.to ? (
          <label className={finance.paramField}>
            <span>To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        ) : null}
        {paramConfig.asOf ? (
          <label className={finance.paramField}>
            <span>As of</span>
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
            />
          </label>
        ) : null}
        {paramConfig.customerId ? (
          <SearchableSelect
            label={`Customer${paramConfig.customerRequired ? ' *' : ''}`}
            value={customerId}
            onChange={setCustomerId}
            allowEmpty={!paramConfig.customerRequired}
            emptyLabel={
              paramConfig.customerRequired ? 'Select customer…' : 'All customers'
            }
            placeholder="Search customers…"
            required={paramConfig.customerRequired}
            options={customers.map((customer) => ({
              id: customer.id,
              label: customer.name,
            }))}
          />
        ) : null}
        {paramConfig.jobId ? (
          <SearchableSelect
            label={`Job${paramConfig.jobRequired ? ' *' : ''}`}
            value={jobId}
            onChange={setJobId}
            allowEmpty={!paramConfig.jobRequired}
            emptyLabel={paramConfig.jobRequired ? 'Select job…' : 'All jobs'}
            placeholder="Search jobs…"
            required={paramConfig.jobRequired}
            disabled={!customerId && paramConfig.customerRequired}
            options={jobs
              .filter((job) => !customerId || job.customerId === customerId)
              .map((job) => ({
                id: job.id,
                label: `${job.number}${job.customer?.name ? ` — ${job.customer.name}` : ''}`,
              }))}
          />
        ) : null}
        {paramConfig.supplierId ? (
          <SearchableSelect
            label={`Supplier${paramConfig.supplierRequired ? ' *' : ''}`}
            value={supplierId}
            onChange={setSupplierId}
            allowEmpty={!paramConfig.supplierRequired}
            emptyLabel={
              paramConfig.supplierRequired ? 'Select supplier…' : 'All suppliers'
            }
            placeholder="Search suppliers…"
            required={paramConfig.supplierRequired}
            options={suppliers.map((supplier) => ({
              id: supplier.id,
              label: supplier.name,
            }))}
          />
        ) : null}
        {paramConfig.kind ? (
          <label className={finance.paramField}>
            <span>Kind</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="all">All</option>
              <option value="progressive">Progressive</option>
              <option value="custom">Custom</option>
              <option value="final">Final</option>
              <option value="credit_note">Credit note</option>
            </select>
          </label>
        ) : null}
        {paramConfig.status ? (
          <label className={finance.paramField}>
            <span>Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">All</option>
              <option value="issued">Issued</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        ) : null}
        <button
          type="button"
          className={styles.button}
          disabled={loading}
          onClick={() => void run()}
        >
          {loading ? 'Loading…' : 'Run'}
        </button>
        {result ? (
          <PdfButton path={pdfFullPath} onError={setError}>
            Print PDF
          </PdfButton>
        ) : null}
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {result ? (
        <>
          <div className={finance.statGrid}>
            {result.summary.map((stat) => (
              <Stat
                key={stat.label}
                title={stat.label}
                value={
                  typeof stat.value === 'number' && stat.money
                    ? money(stat.value)
                    : String(stat.value)
                }
              />
            ))}
          </div>

          {result.rows.length > 0 ? (
            <SearchBox
              value={rowQuery}
              onChange={setRowQuery}
              placeholder="Search report rows…"
            />
          ) : null}

          {result.rows.length === 0 ? (
            <EmptyState>No rows for these parameters.</EmptyState>
          ) : filteredRows.length === 0 ? (
            <EmptyState>No report rows match your search.</EmptyState>
          ) : (
            <TableScroll>
              <table className={finance.table}>
                <thead>
                  <tr>
                    {result.columns.map((col) => (
                      <th
                        key={col.key}
                        className={
                          col.align === 'right' ? finance.numeric : undefined
                        }
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowPager.paged.map((row, index) => (
                    <tr key={index}>
                      {result.columns.map((col) => {
                        const raw = row[col.key];
                        const display =
                          col.money && typeof raw === 'number'
                            ? money(raw)
                            : raw == null || raw === ''
                              ? '—'
                              : String(raw);
                        return (
                          <td
                            key={col.key}
                            className={
                              col.align === 'right'
                                ? finance.numeric
                                : undefined
                            }
                          >
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}

          {result.rows.length > 0 && filteredRows.length > 0 ? (
            <Pagination
              page={rowPager.page}
              setPage={rowPager.setPage}
              pageSize={rowPager.pageSize}
              setPageSize={rowPager.setPageSize}
              pageCount={rowPager.pageCount}
              total={rowPager.total}
            />
          ) : null}

          {result.footerNote ? (
            <p className={finance.footerNote}>{result.footerNote}</p>
          ) : null}
        </>
      ) : !loading && !error ? (
        <EmptyState>
          {paramConfig.customerRequired || paramConfig.jobRequired
            ? 'Choose required parameters and run the report.'
            : 'Loading…'}
        </EmptyState>
      ) : null}

      <p className={styles.count} style={{ marginTop: '1rem' }}>
        <Link href="/reports" className={finance.link}>
          All reports
        </Link>
      </p>
    </section>
  );
}
