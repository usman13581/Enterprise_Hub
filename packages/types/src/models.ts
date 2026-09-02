import type {
  AdvanceStatus,
  DiscountMode,
  InvoiceKind,
  InvoiceStatus,
  JobStatus,
  LedgerDirection,
  LedgerEntryType,
  PaymentMethod,
  QuotationKind,
  QuotationLookupAppliesTo,
  QuotationLookupCategory,
  QuotationStatus,
} from './enums';

export type CompanySummary = {
  id: string;
  name: string;
  tradeName: string | null;
};

export type SessionPayload = {
  kind?: 'company' | 'platform';
  companyId?: string;
  userId?: string;
  email: string;
  companyName?: string;
  companyRole?: 'admin' | 'member';
  features?: string[];
  readOnly?: boolean;
  actingAdminId?: string;
  unreadNotifications?: number;
  /** Platform admin session fields */
  adminId?: string;
  name?: string;
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
  country: string;
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
  discountMode: DiscountMode;
  discountValue: number;
  lineTotal: number;
  sortOrder: number;
};

export type QuotationSectionItem = {
  id: string;
  label: string;
  value: string;
  amount: number;
  discountMode: DiscountMode;
  discountValue: number;
  sortOrder: number;
};

export type QuotationSection = {
  id: string;
  productId: string | null;
  productName: string;
  amount: number;
  discountMode: DiscountMode;
  discountValue: number;
  sortOrder: number;
  items: QuotationSectionItem[];
};

export type QuotationLookup = {
  id: string;
  category: QuotationLookupCategory;
  appliesTo: QuotationLookupAppliesTo;
  title: string;
  body: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Quotation = {
  id: string;
  number: string;
  kind: QuotationKind;
  status: QuotationStatus;
  customerId: string;
  customer: { id: string; name: string; trn: string | null } | null;
  title: string | null;
  notes: string | null;
  contactName: string | null;
  contactPhone: string | null;
  location: string | null;
  validUntil: string | null;
  discountMode: DiscountMode;
  discountValue: number;
  /** Applied document discount amount, denormalized at save. */
  discount: number;
  lineDiscountTotal: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  purchaseTotal: number;
  profit: number;
  approvedAt: string | null;
  cancelledAt: string | null;
  revisionOfId: string | null;
  rootQuotationId: string | null;
  revisionNumber: number;
  revisionOf: { id: string; number: string } | null;
  rootQuotation: { id: string; number: string } | null;
  createdAt: string;
  lines: QuotationLine[];
  sections: QuotationSection[];
  lookups: QuotationLookup[];
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
  discountMode: DiscountMode;
  discountValue: number;
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
  discountMode: DiscountMode;
  discountValue: number;
  discount: number;
  lineDiscountTotal: number;
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
  status: AdvanceStatus;
  cancelledAt: string | null;
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
  payableBySupplier: Array<{
    supplierId: string;
    supplierName: string;
    invoiced: number;
    paid: number;
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
  totalPayable: number;
};

export type HREmployee = {
  id: string;
  companyId: string;
  userId: string | null;
  employeeNumber: string;
  firstName: string;
  lastName: string | null;
  preferredName: string | null;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  employmentType: string;
  status: string;
  departmentId: string | null;
  designationId: string | null;
  joiningDate: string;
  emiratesIdNumber: string | null;
  emiratesIdExpiry: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  visaExpiry: string | null;
  workPermitExpiry: string | null;
  department?: { id: string; name: string } | null;
  designation?: { id: string; name: string } | null;
};

export type HRDashboard = {
  employees: number;
  activeEmployees: number;
  openAttendance: number;
  pendingLeave: number;
  pendingOvertime: number;
  expiringDocuments: number;
  canManage: boolean;
};

export type HRLeaveRequest = {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
  leaveType?: { name: string; code: string; paid: boolean };
  employee?: { employeeNumber: string; firstName: string; lastName: string | null };
};

export type HRPayrollPeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
};

export type LpoLine = {
  id: string;
  productId: string | null;
  productName: string;
  unit: string;
  orderedQty: number;
  receivedQty: number;
  invoicedQty: number;
  unitCost: number;
  vatRate: number;
  discountMode: DiscountMode;
  discountValue: number;
  lineTotal: number;
};

export type LpoPurchaseInvoiceSummary = {
  id: string;
  number: string;
  status: string;
  total: number;
  balance: number;
};

export type LpoReceiptSummary = {
  id: string;
  number: string;
  receiptDate: string;
};

export type Lpo = {
  id: string;
  number: string;
  supplierId: string;
  status: string;
  requestedDeliveryDate: string | null;
  discountMode: DiscountMode;
  discountValue: number;
  discount: number;
  lineDiscountTotal: number;
  subtotal: number;
  inputVat: number;
  total: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  lines: LpoLine[];
  supplier?: { id: string; name: string };
  purchaseInvoices?: LpoPurchaseInvoiceSummary[];
  receipts?: LpoReceiptSummary[];
};

export type PurchaseInvoice = {
  id: string;
  number: string;
  supplierId: string;
  lpoId: string | null;
  supplierInvoiceNumber: string | null;
  issueDate: string;
  dueDate: string | null;
  status: string;
  discountMode: DiscountMode;
  discountValue: number;
  discount: number;
  lineDiscountTotal: number;
  subtotal: number;
  inputVat: number;
  total: number;
  paidAmount: number;
  balance: number;
  currency: string;
  supplier?: { id: string; name: string };
};

export type SupplierFinanceSummary = {
  payable: number;
  overdue: number;
  advances: number;
  openLpos: number;
  pendingReceipts: number;
  postedPurchaseInvoices: number;
};
