'use client';

import Link from 'next/link';
import { INVOICE_REPORT_VIEWS, REPORT_NAV } from '@marble/types';
import page from '../page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

export default function ReportsIndexPage() {
  return (
    <section className={page.page}>
      <h1 className={page.title}>Reports</h1>
      <p className={page.lede}>
        Parameters, on-screen summary, table, then Print PDF — same numbers on
        web and mobile.
      </p>

      <h2 className={finance.sectionTitle}>Finance</h2>
      <div className={finance.reportGrid}>
        {REPORT_NAV.map((report) => (
          <Link
            key={report.key}
            href={`/reports/${report.key}`}
            className={finance.reportCard}
          >
            <strong>{report.label}</strong>
            <span>{report.description}</span>
          </Link>
        ))}
      </div>

      <h2 className={finance.sectionTitle}>Invoices</h2>
      <div className={finance.reportGrid}>
        {INVOICE_REPORT_VIEWS.map((view) => (
          <Link
            key={view.key}
            href={`/reports/invoices/${view.key}`}
            className={finance.reportCard}
          >
            <strong>{view.label}</strong>
            <span>{view.description}</span>
          </Link>
        ))}
      </div>

      <p className={styles.count} style={{ marginTop: '1.5rem' }}>
        <Link href="/accounts" className={finance.link}>
          ← Back to accounts
        </Link>
      </p>
    </section>
  );
}
