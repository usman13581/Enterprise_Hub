'use client';

import Link from 'next/link';
import { ReportCatalog } from '@/components/ReportCatalog';
import page from '../page.module.css';
import finance from '@/components/finance.module.css';

export default function ReportsIndexPage() {
  return (
    <section className={page.page}>
      <h1 className={page.title}>Reports</h1>
      <p className={page.lede}>
        Browse by category, search by name, then open a report for parameters,
        on-screen summary, table, and Print PDF.
      </p>

      <ReportCatalog />

      <p className={finance.panelNote} style={{ marginTop: '1.75rem' }}>
        <Link href="/accounts" className={finance.link}>
          ← Back to accounts
        </Link>
      </p>
    </section>
  );
}
