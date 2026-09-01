export const MODULE_NAV = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'suppliers', label: 'Suppliers', href: '/suppliers' },
  { key: 'products', label: 'Products', href: '/products' },
  { key: 'purchase-orders', label: 'Purchase Orders', href: '/purchase-orders' },
  { key: 'customers', label: 'Customers', href: '/customers' },
  { key: 'quotations', label: 'Quotations', href: '/quotations' },
  { key: 'jobs', label: 'Jobs / Orders', href: '/jobs' },
  { key: 'invoices', label: 'Invoices', href: '/invoices' },
  { key: 'advances', label: 'Advances', href: '/advances' },
  { key: 'hr', label: 'Human Resource', href: '/hr' },
  { key: 'accounts', label: 'Accounts', href: '/accounts' },
  { key: 'reports', label: 'Reports', href: '/reports' },
  { key: 'audit', label: 'Audit', href: '/audit' },
] as const;

export type ModuleNavKey = (typeof MODULE_NAV)[number]['key'];

/** Sidebar / home menu glyphs — shared by web and mobile. */
export const MODULE_NAV_ICONS: Record<ModuleNavKey, string> = {
  home: '⌂',
  customers: '◎',
  suppliers: '◇',
  products: '▣',
  quotations: '✎',
  jobs: '⚒',
  invoices: '▤',
  advances: '↓',
  'purchase-orders': '⇣',
  accounts: '☰',
  reports: '▦',
  audit: '◉',
  hr: '♙',
};

export function moduleNavIcon(key: string): string {
  return MODULE_NAV_ICONS[key as ModuleNavKey] ?? '•';
}

export const APP_NAV_ICONS = {
  team: '☷',
  subscription: '★',
  support: '?',
  profile: '⚙',
  notifications: '🔔',
  signOut: '⎋',
  exitAdmin: '↩',
} as const;

export const ADMIN_NAV_ICONS: Record<string, string> = {
  companies: '◎',
  applications: '✎',
  plans: '★',
  subscriptions: '▤',
  renewals: '↻',
  notifications: '🔔',
  support: '?',
  audit: '◉',
};

/** Finance reports (non-invoice). Order matches Wave 1 build list. */
export const REPORT_NAV = [
  {
    key: 'customer-statement',
    label: 'Customer statement',
    description: 'Opening, movements, and closing balance for a customer.',
    group: 'customers',
    params: ['from', 'to', 'customerId', 'jobId'] as const,
  },
  {
    key: 'customer-balances',
    label: 'Customer balances',
    description: 'Billed, received, and balance due as of a date.',
    group: 'customers',
    params: ['asOf', 'customerId'] as const,
  },
  {
    key: 'aged-receivables',
    label: 'Aged receivables',
    description: 'Outstanding invoices by age, with advances applied FIFO.',
    group: 'customers',
    params: ['asOf', 'customerId'] as const,
  },
  {
    key: 'job-costing',
    label: 'Job costing',
    description: 'Job value, invoiced, remaining, cost, and planned margin.',
    group: 'jobs',
    params: ['jobId'] as const,
  },
  {
    key: 'customer-margin',
    label: 'Customer-wise margin',
    description: 'Planned margin by customer from job financials.',
    group: 'customers',
    params: ['from', 'to', 'customerId'] as const,
  },
  {
    key: 'monthly-pnl',
    label: 'Monthly P&L',
    description: 'Invoiced net vs margin of jobs completed in the period.',
    group: 'jobs',
    params: ['from', 'to'] as const,
  },
  {
    key: 'advances-register',
    label: 'Advances register',
    description: 'Receipts with method, reference, allocated and leftover.',
    group: 'advances',
    params: ['from', 'to', 'customerId', 'jobId'] as const,
  },
  {
    key: 'unallocated-advances',
    label: 'Unallocated advances',
    description: 'Money held on account as of a date.',
    group: 'advances',
    params: ['asOf', 'customerId'] as const,
  },
  {
    key: 'unbilled',
    label: 'Billing progress / unbilled',
    description: 'Job value vs invoiced to date vs remaining.',
    group: 'jobs',
    params: ['asOf', 'customerId', 'jobId'] as const,
  },
  {
    key: 'allocation-rec',
    label: 'Advance allocation rec',
    description: 'Advance = allocated + leftover; invoice applied = allocations.',
    group: 'advances',
    params: ['from', 'to', 'customerId'] as const,
  },
  {
    key: 'supplier-product-register',
    label: 'Supplier product register',
    description: 'Supplier catalog, purchase prices, sell prices, and estimated margin.',
    group: 'supplier-catalog',
    params: ['supplierId'] as const,
  },
  {
    key: 'supplier-cost-summary',
    label: 'Supplier cost summary',
    description: 'Catalog cost exposure and estimated margin grouped by supplier.',
    group: 'supplier-catalog',
    params: ['supplierId'] as const,
  },
  {
    key: 'supplier-quotation-usage',
    label: 'Supplier quotation usage',
    description: 'Quoted products, quantities, costs, and margins by supplier.',
    group: 'supplier-catalog',
    params: ['from', 'to', 'supplierId'] as const,
  },
  {
    key: 'supplier-job-costing',
    label: 'Supplier job costing',
    description: 'Supplier-attributed material cost and margin by job.',
    group: 'supplier-catalog',
    params: ['from', 'to', 'supplierId'] as const,
  },
  {
    key: 'supplier-statement',
    label: 'Supplier statement',
    description: 'Supplier payable movements, payments, advances, and closing balance.',
    group: 'supplier-finance',
    params: ['from', 'to', 'supplierId'] as const,
  },
  {
    key: 'aged-payables',
    label: 'Aged payables',
    description: 'Outstanding supplier purchase invoices by age.',
    group: 'supplier-finance',
    params: ['asOf', 'supplierId'] as const,
  },
  {
    key: 'purchase-invoice-register',
    label: 'Purchase invoice register',
    description: 'Supplier bills with input VAT, due dates, and balances.',
    group: 'supplier-finance',
    params: ['from', 'to', 'supplierId'] as const,
  },
  {
    key: 'supplier-payment-register',
    label: 'Supplier payment register',
    description: 'Supplier payments and unapplied advances.',
    group: 'supplier-finance',
    params: ['from', 'to', 'supplierId'] as const,
  },
  {
    key: 'lpo-register',
    label: 'LPO register',
    description: 'Ordered, received, invoiced, and remaining commitments.',
    group: 'supplier-finance',
    params: ['from', 'to', 'supplierId'] as const,
  },
  {
    key: 'supplier-spend',
    label: 'Supplier spend',
    description: 'Posted supplier spend by supplier and period.',
    group: 'supplier-finance',
    params: ['from', 'to', 'supplierId'] as const,
  },
  {
    key: 'supplier-price-history',
    label: 'Supplier price history',
    description: 'Purchase prices recorded from posted supplier invoices.',
    group: 'supplier-finance',
    params: ['from', 'to', 'supplierId'] as const,
  },
  {
    key: 'input-vat-summary',
    label: 'Input VAT summary',
    description: 'Input VAT and payable cash-out by period.',
    group: 'tax',
    params: ['from', 'to', 'supplierId'] as const,
  },
] as const;

export type ReportKey = (typeof REPORT_NAV)[number]['key'];

/** Invoice pack A views. */
export const INVOICE_REPORT_VIEWS = [
  {
    key: 'master',
    label: 'Master register',
    description: 'All tax invoices and credit notes in the period.',
    group: 'registers',
  },
  {
    key: 'by-customer',
    label: 'By customer',
    description: 'Invoice rows grouped by customer with subtotals.',
    group: 'registers',
  },
  {
    key: 'by-job',
    label: 'By job',
    description: 'Invoice rows grouped by job with subtotals.',
    group: 'registers',
  },
  {
    key: 'by-kind',
    label: 'By kind',
    description: 'Progressive, custom, final, and credit-note buckets.',
    group: 'registers',
  },
  {
    key: 'by-status',
    label: 'By status',
    description: 'Issued vs cancelled for numbering control.',
    group: 'registers',
  },
  {
    key: 'monthly',
    label: 'Monthly summary',
    description: 'One row per calendar month of billed activity.',
    group: 'registers',
  },
  {
    key: 'lines',
    label: 'Invoice lines / product',
    description: 'Line description, qty, prices, and totals.',
    group: 'registers',
  },
  {
    key: 'credit-notes',
    label: 'Credit notes',
    description: 'Credit notes that reverse billed value and VAT.',
    group: 'compliance',
  },
  {
    key: 'outstanding',
    label: 'Outstanding',
    description: 'Issued invoices still collectible as of a date.',
    group: 'collections',
  },
  {
    key: 'overdue',
    label: 'Overdue',
    description: 'Outstanding invoices past due as of a date.',
    group: 'collections',
  },
  {
    key: 'advances-on-invoices',
    label: 'Advances on invoices',
    description: 'One row per advance allocation onto a tax invoice.',
    group: 'collections',
  },
  {
    key: 'uae-tax',
    label: 'UAE tax listing',
    description: 'Buyer TRN, taxable, VAT 5%, and gross for the period.',
    group: 'compliance',
  },
  {
    key: 'vat-drilldown',
    label: 'VAT by month',
    description: 'Issued VAT minus credit-note VAT by calendar month.',
    group: 'compliance',
  },
  {
    key: 'numbering-gaps',
    label: 'Number series gaps',
    description: 'Missing or duplicate invoice numbers in the period.',
    group: 'compliance',
  },
  {
    key: 'cancelled',
    label: 'Cancelled invoices',
    description: 'Voided invoices with original totals.',
    group: 'compliance',
  },
] as const;

export type InvoiceReportView = (typeof INVOICE_REPORT_VIEWS)[number]['key'];
