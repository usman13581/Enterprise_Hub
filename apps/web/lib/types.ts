/**
 * Response shapes live in @marble/types so web, mobile, and the API cannot
 * drift. This module only re-exports them, and adds the few list-view shapes
 * that come back with extra relation counts.
 */
export type {
  AccountsOverview,
  AdvancePayment,
  Company,
  CompanyProfile,
  Customer,
  CustomerHub,
  Invoice,
  InvoiceAllocation,
  InvoiceKind,
  InvoiceLine,
  InvoiceStatus,
  Job,
  JobFinancials,
  JobHub,
  JobStatus,
  LedgerEntry,
  MoneySummary,
  PaymentMethod,
  Product,
  ProductImage,
  Quotation,
  QuotationKind,
  QuotationLine,
  QuotationLookup,
  QuotationSection,
  QuotationStatus,
  Supplier,
} from '@marble/types';

import type { Job } from '@marble/types';

export type JobListItem = Job & {
  _count?: { invoices: number; advances: number };
};

export type AvailableAdvance = {
  id: string;
  number: string;
  amount: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  receivedAt: string;
  job: { id: string; number: string } | null;
};
