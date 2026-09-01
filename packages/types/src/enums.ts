export const QUOTATION_STATUSES = ['draft', 'approved', 'cancelled'] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

/** UI / create-flow kinds. General is the existing line-item quotation. */
export const QUOTATION_KINDS = ['general', 'counter_top'] as const;
export type QuotationKind = (typeof QUOTATION_KINDS)[number];

export const QUOTATION_KIND_LABELS: Record<QuotationKind, string> = {
  general: 'General Quotation',
  counter_top: 'Counter Top',
};

/** Reusable blocks attached to quotations (company-level lookups). */
export const QUOTATION_LOOKUP_CATEGORIES = [
  'terms',
  'notes',
  'bank',
  /** Counter Top section row labels (Material, Fascia, …). */
  'spec',
] as const;
export type QuotationLookupCategory =
  (typeof QUOTATION_LOOKUP_CATEGORIES)[number];

export const QUOTATION_LOOKUP_CATEGORY_LABELS: Record<
  QuotationLookupCategory,
  string
> = {
  terms: 'Terms & conditions',
  notes: 'Notes',
  bank: 'Bank / payment details',
  spec: 'Spec items',
};

export const QUOTATION_LOOKUP_APPLIES_TO = [
  'general',
  'counter_top',
  'both',
] as const;
export type QuotationLookupAppliesTo =
  (typeof QUOTATION_LOOKUP_APPLIES_TO)[number];

export const QUOTATION_LOOKUP_APPLIES_LABELS: Record<
  QuotationLookupAppliesTo,
  string
> = {
  general: 'General Quotation',
  counter_top: 'Counter Top',
  both: 'Both',
};

export const JOB_STATUSES = ['open', 'completed', 'closed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/**
 * `progressive` and `custom` bill part of an open job, `final` settles the
 * remainder, and `credit_note` reverses value from an earlier invoice.
 */
export const INVOICE_KINDS = [
  'progressive',
  'custom',
  'final',
  'credit_note',
] as const;
export type InvoiceKind = (typeof INVOICE_KINDS)[number];

export const INVOICE_STATUSES = ['draft', 'issued', 'cancelled'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const ADVANCE_STATUSES = ['draft', 'posted', 'cancelled'] as const;
export type AdvanceStatus = (typeof ADVANCE_STATUSES)[number];

export const SUPPLIER_PAYMENT_STATUSES = [
  'draft',
  'posted',
  'reversed',
] as const;
export type SupplierPaymentStatus = (typeof SUPPLIER_PAYMENT_STATUSES)[number];

/** Line or document discount — fixed AED amount or percentage of gross. */
export const DISCOUNT_MODES = ['none', 'fixed', 'percent'] as const;
export type DiscountMode = (typeof DISCOUNT_MODES)[number];

export const PAYMENT_METHODS = [
  'cash',
  'bank_transfer',
  'cheque',
  'card',
  'other',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * A debit increases what the customer owes; a credit reduces it. Advance
 * allocation is deliberately absent because allocating an already-received
 * advance moves no money — it only labels which invoice the advance settles.
 */
export const LEDGER_ENTRY_TYPES = [
  'invoice_issued',
  'invoice_cancelled',
  'advance_received',
  'advance_refunded',
  'credit_note',
  'adjustment',
] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

export const LEDGER_DIRECTIONS = ['debit', 'credit'] as const;
export type LedgerDirection = (typeof LEDGER_DIRECTIONS)[number];

export const LEDGER_DIRECTION_BY_TYPE: Record<
  LedgerEntryType,
  LedgerDirection
> = {
  invoice_issued: 'debit',
  invoice_cancelled: 'credit',
  advance_received: 'credit',
  advance_refunded: 'debit',
  credit_note: 'credit',
  adjustment: 'debit',
};
