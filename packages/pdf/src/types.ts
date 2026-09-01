export type PdfCompany = {
  legalName: string;
  tradeName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  trn?: string | null;
  bankDetails?: string | null;
  logoUrl?: string | null;
  signatureUrl?: string | null;
  currency: string;
};

export type PdfParty = {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  trn?: string | null;
};

export type PdfLine = {
  description: string;
  unit: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  imageUrl?: string | null;
};

export type CounterTopSectionPdf = {
  productName: string;
  amount: number;
  items: Array<{ label: string; value: string }>;
};

export type PdfDiscountBreakdown = {
  lineGrossTotal?: number;
  lineDiscountTotal?: number;
  /** Applied document-level discount amount. */
  discount?: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  vatRate: number;
};

export type QuotationPdfData = {
  company: PdfCompany;
  customer: PdfParty;
  number: string;
  status: string;
  createdAt: string;
  validUntil?: string | null;
  title?: string | null;
  notes?: string | null;
  lines: PdfLine[];
  subtotal: number;
  vatAmount: number;
  total: number;
  vatRate: number;
  lineGrossTotal?: number;
  lineDiscountTotal?: number;
  /** Counter Top layout — sections, contact block, and split lookup blocks. */
  kind?: 'general' | 'counter_top';
  contactName?: string | null;
  contactPhone?: string | null;
  location?: string | null;
  discount?: number;
  sections?: CounterTopSectionPdf[];
  terms?: string | null;
  bankDetails?: string | null;
  /** General quotation — payment terms block (often split from terms lookup). */
  paymentTerms?: string | null;
};

export type InvoicePdfData = {
  company: PdfCompany;
  customer: PdfParty;
  number: string;
  kind: string;
  status: string;
  issueDate: string;
  dueDate?: string | null;
  jobNumber?: string | null;
  notes?: string | null;
  lines: PdfLine[];
  subtotal: number;
  vatAmount: number;
  total: number;
  advanceApplied: number;
  netPayable: number;
  vatRate: number;
  lineGrossTotal?: number;
  lineDiscountTotal?: number;
  discount?: number;
  allocations: Array<{ number: string; amount: number; receivedAt: string }>;
};

export type AdvanceReceiptPdfData = {
  company: PdfCompany;
  customer: PdfParty;
  number: string;
  amount: number;
  method: string;
  reference?: string | null;
  receivedAt: string;
  jobNumber?: string | null;
  notes?: string | null;
};

export type ReportColumn = {
  key: string;
  label: string;
  align?: 'left' | 'right';
  money?: boolean;
};

export type ReportSummaryStat = {
  label: string;
  value: string | number;
  money?: boolean;
};

export type ReportPdfData = {
  company: PdfCompany;
  title: string;
  subtitle?: string | null;
  meta: Array<[string, string]>;
  summary: ReportSummaryStat[];
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null | undefined>>;
  footerNote?: string | null;
};
