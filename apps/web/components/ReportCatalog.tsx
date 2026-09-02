'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  countVisibleReports,
  groupCustomerLedgerReports,
  groupInvoiceReports,
  groupJobsReports,
  groupOtherFinanceReports,
  groupSupplierLedgerReports,
  type ReportGroupKey,
} from '@marble/types';
import { SearchBox } from '@/components/ListControls';
import styles from './reports.module.css';

type Scope =
  | 'all'
  | 'customer-ledgers'
  | 'supplier-ledgers'
  | 'jobs'
  | 'invoices';

type ReportGroup = {
  key: ReportGroupKey;
  label: string;
  hint: string;
  reports: Array<{
    key: string;
    label: string;
    description: string;
  }>;
};

function ReportGroupPanel({ group }: { group: ReportGroup }) {
  return (
    <article className={styles.groupPanel}>
      <div className={styles.groupHead}>
        <h3 className={styles.groupTitle}>{group.label}</h3>
        <p className={styles.groupHint}>{group.hint}</p>
        <p className={styles.groupCount}>
          {group.reports.length} report
          {group.reports.length === 1 ? '' : 's'}
        </p>
      </div>
      <ul className={styles.reportList}>
        {group.reports.map((report) => (
          <li key={report.key} className={styles.reportItem}>
            <Link href={`/reports/${report.key}`} className={styles.reportLink}>
              <span className={styles.reportRow}>
                <span className={styles.reportName}>{report.label}</span>
                <span className={styles.reportArrow} aria-hidden>
                  →
                </span>
              </span>
              <span className={styles.reportDesc}>{report.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}

function FinancePillar({
  title,
  hint,
  groups,
}: {
  title: string;
  hint: string;
  groups: ReportGroup[];
}) {
  if (groups.length === 0) return null;
  return (
    <section className={styles.pillar}>
      <div className={styles.pillarHead}>
        <div>
          <h2 className={styles.pillarTitle}>{title}</h2>
          <p className={styles.pillarHint}>{hint}</p>
        </div>
      </div>
      <div className={styles.groupGrid}>
        {groups.map((group) => (
          <ReportGroupPanel key={group.key} group={group} />
        ))}
      </div>
    </section>
  );
}

export function ReportCatalog() {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');

  const customerGroups = useMemo(
    () => groupCustomerLedgerReports(query),
    [query],
  );
  const supplierGroups = useMemo(
    () => groupSupplierLedgerReports(query),
    [query],
  );
  const jobsGroups = useMemo(() => groupJobsReports(query), [query]);
  const otherGroups = useMemo(() => groupOtherFinanceReports(query), [query]);
  const invoiceGroups = useMemo(() => groupInvoiceReports(query), [query]);
  const counts = useMemo(() => countVisibleReports(query), [query]);

  const showCustomer =
    scope === 'all' || scope === 'customer-ledgers';
  const showSupplier =
    scope === 'all' || scope === 'supplier-ledgers';
  const showJobs = scope === 'all' || scope === 'jobs';
  const showOther = scope === 'all';
  const showInvoices = scope === 'all' || scope === 'invoices';

  const visibleCount =
    (showCustomer ? customerGroups.length : 0) +
    (showSupplier ? supplierGroups.length : 0) +
    (showJobs ? jobsGroups.length : 0) +
    (showOther ? otherGroups.length : 0) +
    (showInvoices ? invoiceGroups.length : 0);

  const empty = visibleCount === 0;

  return (
    <div className={styles.catalog}>
      <div className={styles.toolbar}>
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search reports by name or topic…"
        />
        <p className={styles.meta}>
          {counts.total} report{counts.total === 1 ? '' : 's'} ·{' '}
          {counts.finance} finance · {counts.invoices} invoice views
        </p>
        <div className={styles.filters}>
          {(
            [
              ['all', 'All reports'],
              ['customer-ledgers', 'Customer ledgers'],
              ['supplier-ledgers', 'Supplier ledgers'],
              ['jobs', 'Jobs'],
              ['invoices', 'Invoices'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`${styles.filter} ${
                scope === key ? styles.filterActive : ''
              }`}
              onClick={() => setScope(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <p className={styles.empty}>No reports match your search.</p>
      ) : null}

      {showCustomer ? (
        <FinancePillar
          title="Customer ledgers"
          hint="Receivables, balances, and customer aging."
          groups={customerGroups}
        />
      ) : null}

      {showSupplier ? (
        <FinancePillar
          title="Supplier ledgers"
          hint="Payables, bills, payments, and supplier aging."
          groups={supplierGroups}
        />
      ) : null}

      {showJobs ? (
        <FinancePillar
          title="Jobs & billing"
          hint="Job costing, profitability, advances, and unbilled work."
          groups={jobsGroups}
        />
      ) : null}

      {showOther ? (
        <FinancePillar
          title="Catalog & tax"
          hint="Supplier catalog costing and VAT summaries."
          groups={otherGroups}
        />
      ) : null}

      {showInvoices && invoiceGroups.length > 0 ? (
        <section className={styles.pillar}>
          <div className={styles.pillarHead}>
            <div>
              <h2 className={styles.pillarTitle}>Invoices</h2>
              <p className={styles.pillarHint}>
                Registers, collections, and tax listings for sales invoices.
              </p>
            </div>
          </div>
          <div className={styles.groupGrid}>
            {invoiceGroups.map((group) => (
              <article key={group.key} className={styles.groupPanel}>
                <div className={styles.groupHead}>
                  <h3 className={styles.groupTitle}>{group.label}</h3>
                  <p className={styles.groupHint}>{group.hint}</p>
                  <p className={styles.groupCount}>
                    {group.reports.length} view
                    {group.reports.length === 1 ? '' : 's'}
                  </p>
                </div>
                <ul className={styles.reportList}>
                  {group.reports.map((report) => (
                    <li key={report.key} className={styles.reportItem}>
                      <Link
                        href={`/reports/invoices/${report.key}`}
                        className={styles.reportLink}
                      >
                        <span className={styles.reportRow}>
                          <span className={styles.reportName}>
                            {report.label}
                          </span>
                          <span className={styles.reportArrow} aria-hidden>
                            →
                          </span>
                        </span>
                        <span className={styles.reportDesc}>
                          {report.description}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
