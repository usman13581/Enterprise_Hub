export const MODULE_NAV = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'customers', label: 'Customers', href: '/customers' },
  { key: 'suppliers', label: 'Suppliers', href: '/suppliers' },
  { key: 'products', label: 'Products', href: '/products' },
  { key: 'quotations', label: 'Quotations', href: '/quotations' },
  { key: 'jobs', label: 'Jobs', href: '/jobs' },
  { key: 'invoices', label: 'Invoices', href: '/invoices' },
  { key: 'accounts', label: 'Accounts', href: '/accounts' },
  { key: 'profile', label: 'Company profile', href: '/profile' },
  { key: 'audit', label: 'Audit', href: '/audit' },
] as const;

export type ModuleNavKey = (typeof MODULE_NAV)[number]['key'];

export type CompanySummary = {
  id: string;
  name: string;
  tradeName: string | null;
};

export type SessionPayload = {
  companyId: string;
  userId: string;
  email: string;
  companyName: string;
};
