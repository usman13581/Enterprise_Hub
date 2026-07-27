import type {
  InvoiceKind,
  InvoiceStatus,
  JobStatus,
  LedgerDirection,
  LedgerEntryType,
  PaymentMethod,
  QuotationStatus,
} from './enums';

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

export type Supplier = {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  trn: string | null;
  notes: string | null;
  active: boolean;
  _count?: { products: number };
};

export type ProductImage = {
  id: string;
  url: string;
  isDefault: boolean;
};

export type Product = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  purchasePrice: number;
  sellPrice: number;
  description: string | null;
  supplierId: string | null;
  supplier: { id: string; name: string } | null;
  images: ProductImage[];
  active: boolean;
};

export type Customer = {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  trn: string | null;
  notes: string | null;
  active: boolean;
};

export type CompanyProfile = {
  id: string;
  legalName: string;
  tradeName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  trn: string | null;
  bankDetails: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  quotationPrefix: string;
  invoicePrefix: string;
  jobPrefix: string;
  advancePrefix: string;
  creditNotePrefix: string;
  currency: string;
};

export type Company = {
  id: string;
  name: string;
  slug: string;
  profile: CompanyProfile | null;
};

export type QuotationLine = {
  id: string;
  productId: string | null;
  description: string;
  unit: string;
  qty: number;
  purchasePrice: number;
  sellPrice: number;
  lineTotal: number;
  sortOrder: number;
};

export type Quotation = {
  id: string;
  number: string;
  status: QuotationStatus;
  customerId: string;
  customer: { id: string; name: string; trn: string | null } | null;
  title: string | null;
  notes: string | null;
  validUntil: string | null;
  subtotal: number;
  vatAmount: number;
  total: number;
  purchaseTotal: number;
  profit: number;
  approvedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  lines: QuotationLine[];
  job: { id: string; number: string; status: JobStatus } | null;
};

export type Job = {
  id: string;
  number: string;
  status: JobStatus;
  customerId: string;
  customer: { id: string; name: string; trn: string | null } | null;
  quotationId: string;
  quotation: { id: string; number: string; title: string | null } | null;
  title: string | null;
  jobValue: number;
  jobNet: number;
  purchaseTotal: number;
  completedAt: string | null;
  closedAt: string | null;
  createdAt: string;
};

export type InvoiceLine = {
  id: string;
  description: string;
  unit: string;
  qty: number;
  unitPrice: number;
  purchasePrice: number;
  lineTotal: number;
  sortOrder: number;
};

export type InvoiceAllocation = {
  id: string;
  advanceId: string;
  amount: number;
  advance?: { id: string; number: string; receivedAt: string } | null;
};

export type Invoice = {
  id: string;
  number: string;
  kind: InvoiceKind;
  status: InvoiceStatus;
  customerId: string;
  customer: { id: string; name: string; trn: string | null } | null;
  jobId: string | null;
  job: { id: string; number: string; status: JobStatus } | null;
  creditNoteForId: string | null;
  issueDate: string;
  dueDate: string | null;
  notes: string | null;
  subtotal: number;
  vatAmount: number;
  total: number;
  advanceApplied: number;
  netPayable: number;
  createdAt: string;
  lines: InvoiceLine[];
  allocations: InvoiceAllocation[];
};

export type AdvancePayment = {
  id: string;
  number: string;
  customerId: string;
  customer: { id: string; name: string } | null;
  jobId: string | null;
  job: { id: string; number: string } | null;
  amount: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  method: PaymentMethod;
  reference: string | null;
  receivedAt: string;
  notes: string | null;
};

export type LedgerEntry = {
  id: string;
  entryType: LedgerEntryType;
  direction: LedgerDirection;
  amount: number;
  occurredAt: string;
  memo: string | null;
  customerId: string;
  jobId: string | null;
  invoiceId: string | null;
  advanceId: string | null;
  runningBalance: number;
};

export type MoneySummary = {
  billed: number;
  credited: number;
  advancesReceived: number;
  balanceDue: number;
  unallocatedAdvances: number;
};

export type JobFinancials = {
  jobValue: number;
  invoicedToDate: number;
  advancesApplied: number;
  balanceRemaining: number;
  purchaseTotal: number;
  profit: number;
};

export type CustomerHub = {
  customer: Customer;
  summary: MoneySummary;
  byJob: Array<{
    jobId: string;
    jobNumber: string;
    quotationNumber: string | null;
    status: JobStatus;
    jobValue: number;
    invoiced: number;
    advances: number;
    balance: number;
  }>;
  quotations: Quotation[];
  jobs: Job[];
  invoices: Invoice[];
  advances: AdvancePayment[];
  ledger: LedgerEntry[];
};

export type JobHub = {
  /** The hub returns the source quotation's lines so job P&L can be shown. */
  job: Job & {
    quotation:
      | (NonNullable<Job['quotation']> & { lines: QuotationLine[] })
      | null;
  };
  financials: JobFinancials;
  invoices: Invoice[];
  advances: AdvancePayment[];
  ledger: LedgerEntry[];
};

export type AccountsOverview = {
  summary: MoneySummary;
  receivableByCustomer: Array<{
    customerId: string;
    customerName: string;
    billed: number;
    received: number;
    balance: number;
  }>;
  profitByJob: Array<{
    jobId: string;
    jobNumber: string;
    customerName: string;
    jobValue: number;
    purchaseTotal: number;
    profit: number;
    status: JobStatus;
  }>;
  openJobs: number;
  totalProfit: number;
};
