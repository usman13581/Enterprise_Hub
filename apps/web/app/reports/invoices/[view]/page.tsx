'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { INVOICE_REPORT_VIEWS } from '@marble/types';
import { ReportRunner } from '@/components/ReportRunner';
import page from '../../../page.module.css';

export default function InvoiceReportPage() {
  const params = useParams<{ view: string }>();
  const view = params.view;
  const meta = useMemo(
    () => INVOICE_REPORT_VIEWS.find((item) => item.key === view),
    [view],
  );

  if (!meta) {
    return (
      <section className={page.page}>
        <h1 className={page.title}>Invoice report not found</h1>
        <p className={page.lede}>Unknown view “{view}”.</p>
      </section>
    );
  }

  const needsAsOf = view === 'outstanding' || view === 'overdue';

  return (
    <ReportRunner
      title={meta.label}
      apiPath={`/reports/invoices/${view}`}
      pdfPath={`/reports/invoices/${view}/pdf`}
      paramConfig={{
        from: true,
        to: true,
        asOf: needsAsOf,
        customerId: true,
        jobId: true,
        kind: view === 'master' || view === 'by-customer' || view === 'by-job',
        status: view === 'master' || view === 'by-status',
      }}
      backHref="/reports"
    />
  );
}
