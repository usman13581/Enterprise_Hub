import {
  INVOICE_REPORT_VIEWS,
  REPORT_NAV,
  type InvoiceReportView,
  type ReportKey,
} from './nav';

export const REPORT_GROUP_ORDER = [
  'customers',
  'jobs',
  'advances',
  'supplier-catalog',
  'supplier-finance',
  'tax',
] as const;

export type ReportGroupKey = (typeof REPORT_GROUP_ORDER)[number];

export const REPORT_GROUP_META: Record<
  ReportGroupKey,
  { label: string; hint: string }
> = {
  customers: {
    label: 'Customers & receivables',
    hint: 'Statements, balances, and aging',
  },
  jobs: {
    label: 'Jobs & profitability',
    hint: 'Costing, unbilled work, and P&L',
  },
  advances: {
    label: 'Advances & billing',
    hint: 'Receipts, allocations, and unapplied money',
  },
  'supplier-catalog': {
    label: 'Supplier catalog & costing',
    hint: 'Products, quotes, and material cost',
  },
  'supplier-finance': {
    label: 'Supplier payables',
    hint: 'Bills, payments, LPOs, and spend',
  },
  tax: {
    label: 'VAT & tax',
    hint: 'Input VAT and tax summaries',
  },
};

export const INVOICE_REPORT_GROUP_ORDER = [
  'registers',
  'collections',
  'compliance',
] as const;

export type InvoiceReportGroupKey = (typeof INVOICE_REPORT_GROUP_ORDER)[number];

export const INVOICE_REPORT_GROUP_META: Record<
  InvoiceReportGroupKey,
  { label: string; hint: string }
> = {
  registers: {
    label: 'Registers & summaries',
    hint: 'Master lists and grouped invoice views',
  },
  collections: {
    label: 'Outstanding & collections',
    hint: 'Due, overdue, and advance allocations',
  },
  compliance: {
    label: 'Tax & invoice control',
    hint: 'VAT listings, credit notes, and numbering',
  },
};

function matchesQuery(
  query: string,
  label: string,
  description: string,
  groupLabel: string,
) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    label.toLowerCase().includes(q) ||
    description.toLowerCase().includes(q) ||
    groupLabel.toLowerCase().includes(q)
  );
}

export function groupFinanceReports(query = '') {
  return REPORT_GROUP_ORDER.map((key) => {
    const meta = REPORT_GROUP_META[key];
    const reports = REPORT_NAV.filter(
      (report) =>
        report.group === key &&
        matchesQuery(query, report.label, report.description, meta.label),
    );
    return { key, ...meta, reports };
  }).filter((group) => group.reports.length > 0);
}

export function groupInvoiceReports(query = '') {
  return INVOICE_REPORT_GROUP_ORDER.map((key) => {
    const meta = INVOICE_REPORT_GROUP_META[key];
    const reports = INVOICE_REPORT_VIEWS.filter(
      (report) =>
        report.group === key &&
        matchesQuery(query, report.label, report.description, meta.label),
    );
    return { key, ...meta, reports };
  }).filter((group) => group.reports.length > 0);
}

export function countVisibleReports(query = '') {
  const finance = groupFinanceReports(query).reduce(
    (total, group) => total + group.reports.length,
    0,
  );
  const invoices = groupInvoiceReports(query).reduce(
    (total, group) => total + group.reports.length,
    0,
  );
  return { finance, invoices, total: finance + invoices };
}

export type FinanceReport = (typeof REPORT_NAV)[number];
export type InvoiceReport = (typeof INVOICE_REPORT_VIEWS)[number];

export type { ReportKey, InvoiceReportView };
