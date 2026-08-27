export const MODULE_NAV = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'customers', label: 'Customers', href: '/customers' },
  { key: 'suppliers', label: 'Suppliers', href: '/suppliers' },
  { key: 'products', label: 'Products', href: '/products' },
  { key: 'quotations', label: 'Quotations', href: '/quotations' },
  { key: 'jobs', label: 'Jobs', href: '/jobs' },
  { key: 'invoices', label: 'Invoices', href: '/invoices' },
  { key: 'advances', label: 'Advances', href: '/advances' },
  { key: 'accounts', label: 'Accounts', href: '/accounts' },
  { key: 'reports', label: 'Reports', href: '/reports' },
  { key: 'audit', label: 'Audit', href: '/audit' },
] as const;

export type ModuleNavKey = (typeof MODULE_NAV)[number]['key'];

/** Finance reports (non-invoice). Order matches Wave 1 build list. */
export const REPORT_NAV = [
  {
    key: 'customer-statement',
    label: 'Customer statement',
    description: 'Opening, movements, and closing balance for a customer.',
    params: ['from', 'to', 'customerId', 'jobId'] as const,
  },
  {
    key: 'customer-balances',
    label: 'Customer balances',
    description: 'Billed, received, and balance due as of a date.',
    params: ['asOf', 'customerId'] as const,
  },
  {
    key: 'aged-receivables',
    label: 'Aged receivables',
    description: 'Outstanding invoices by age, with advances applied FIFO.',
    params: ['asOf', 'customerId'] as const,
  },
  {
    key: 'job-costing',
    label: 'Job costing',
    description: 'Job value, invoiced, remaining, cost, and planned margin.',
    params: ['jobId'] as const,
  },
  {
    key: 'customer-margin',
    label: 'Customer-wise margin',
    description: 'Planned margin by customer from job financials.',
    params: ['from', 'to', 'customerId'] as const,
  },
  {
    key: 'monthly-pnl',
    label: 'Monthly P&L',
    description: 'Invoiced net vs margin of jobs completed in the period.',
    params: ['from', 'to'] as const,
  },
  {
    key: 'advances-register',
    label: 'Advances register',
    description: 'Receipts with method, reference, allocated and leftover.',
    params: ['from', 'to', 'customerId', 'jobId'] as const,
  },
  {
    key: 'unallocated-advances',
    label: 'Unallocated advances',
    description: 'Money held on account as of a date.',
    params: ['asOf', 'customerId'] as const,
  },
  {
    key: 'unbilled',
    label: 'Billing progress / unbilled',
    description: 'Job value vs invoiced to date vs remaining.',
    params: ['asOf', 'customerId', 'jobId'] as const,
  },
  {
    key: 'allocation-rec',
    label: 'Advance allocation rec',
    description: 'Advance = allocated + leftover; invoice applied = allocations.',
    params: ['from', 'to', 'customerId'] as const,
  },
] as const;

export type ReportKey = (typeof REPORT_NAV)[number]['key'];

/** Invoice pack A views. */
export const INVOICE_REPORT_VIEWS = [
  {
    key: 'master',
    label: 'Master register',
    description: 'All tax invoices and credit notes in the period.',
  },
  {
    key: 'by-customer',
    label: 'By customer',
    description: 'Invoice rows grouped by customer with subtotals.',
  },
  {
    key: 'by-job',
    label: 'By job',
    description: 'Invoice rows grouped by job with subtotals.',
  },
  {
    key: 'by-kind',
    label: 'By kind',
    description: 'Progressive, custom, final, and credit-note buckets.',
  },
  {
    key: 'by-status',
    label: 'By status',
    description: 'Issued vs cancelled for numbering control.',
  },
  {
    key: 'monthly',
    label: 'Monthly summary',
    description: 'One row per calendar month of billed activity.',
  },
  {
    key: 'credit-notes',
    label: 'Credit notes',
    description: 'Credit notes that reverse billed value and VAT.',
  },
  {
    key: 'outstanding',
    label: 'Outstanding',
    description: 'Issued invoices still collectible as of a date.',
  },
  {
    key: 'overdue',
    label: 'Overdue',
    description: 'Outstanding invoices past due as of a date.',
  },
  {
    key: 'advances-on-invoices',
    label: 'Advances on invoices',
    description: 'One row per advance allocation onto a tax invoice.',
  },
  {
    key: 'uae-tax',
    label: 'UAE tax listing',
    description: 'Buyer TRN, taxable, VAT 5%, and gross for the period.',
  },
  {
    key: 'vat-drilldown',
    label: 'VAT by month',
    description: 'Issued VAT minus credit-note VAT by calendar month.',
  },
  {
    key: 'numbering-gaps',
    label: 'Number series gaps',
    description: 'Missing or duplicate invoice numbers in the period.',
  },
  {
    key: 'cancelled',
    label: 'Cancelled invoices',
    description: 'Voided invoices with original totals.',
  },
  {
    key: 'lines',
    label: 'Invoice lines / product',
    description: 'Line description, qty, prices, and totals.',
  },
] as const;

export type InvoiceReportView = (typeof INVOICE_REPORT_VIEWS)[number]['key'];
