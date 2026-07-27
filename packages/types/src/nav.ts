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
  { key: 'audit', label: 'Audit', href: '/audit' },
] as const;

export type ModuleNavKey = (typeof MODULE_NAV)[number]['key'];
