'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { REPORT_NAV, type ReportKey } from '@marble/types';
import { ReportRunner, type ReportParamsConfig } from '@/components/ReportRunner';
import page from '../../page.module.css';

const PARAMS: Record<ReportKey, ReportParamsConfig> = {
  'customer-statement': {
    from: true,
    to: true,
    customerId: true,
    jobId: true,
    customerRequired: true,
  },
  'customer-balances': { asOf: true, customerId: true },
  'aged-receivables': { asOf: true, customerId: true },
  'job-costing': { jobId: true, jobRequired: true },
  'customer-margin': { from: true, to: true, customerId: true },
  'monthly-pnl': { from: true, to: true },
  'advances-register': {
    from: true,
    to: true,
    customerId: true,
    jobId: true,
  },
  'unallocated-advances': { asOf: true, customerId: true },
  unbilled: { asOf: true, customerId: true, jobId: true },
  'allocation-rec': { from: true, to: true, customerId: true },
};

export default function ReportKeyPage() {
  const params = useParams<{ key: string }>();
  const key = params.key;
  const meta = useMemo(
    () => REPORT_NAV.find((report) => report.key === key),
    [key],
  );

  if (!meta || !(key in PARAMS)) {
    return (
      <section className={page.page}>
        <h1 className={page.title}>Report not found</h1>
        <p className={page.lede}>Unknown report key “{key}”.</p>
      </section>
    );
  }

  return (
    <ReportRunner
      title={meta.label}
      apiPath={`/reports/${key}`}
      pdfPath={`/reports/${key}/pdf`}
      paramConfig={PARAMS[key as ReportKey]}
    />
  );
}
