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
