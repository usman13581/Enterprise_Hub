'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  countVisibleReports,
  groupFinanceReports,
  groupInvoiceReports,
} from '@marble/types';
import { SearchBox } from '@/components/ListControls';
import styles from './reports.module.css';

type Scope = 'all' | 'finance' | 'invoices';

export function ReportCatalog() {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');

  const financeGroups = useMemo(() => groupFinanceReports(query), [query]);
  const invoiceGroups = useMemo(() => groupInvoiceReports(query), [query]);
  const counts = useMemo(() => countVisibleReports(query), [query]);

  const showFinance = scope === 'all' || scope === 'finance';
  const showInvoices = scope === 'all' || scope === 'invoices';
  const empty =
    (showFinance ? financeGroups.length : 0) +
      (showInvoices ? invoiceGroups.length : 0) ===
    0;

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
              ['finance', 'Finance'],
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

      {showFinance && financeGroups.length > 0 ? (
        <section className={styles.pillar}>
          <div className={styles.pillarHead}>
            <div>
              <h2 className={styles.pillarTitle}>Finance</h2>
              <p className={styles.pillarHint}>
                Customer, job, supplier, and tax reporting outside invoice
                registers.
              </p>
            </div>
          </div>
          <div className={styles.groupGrid}>
            {financeGroups.map((group) => (
              <article key={group.key} className={styles.groupPanel}>
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
                      <Link
                        href={`/reports/${report.key}`}
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
