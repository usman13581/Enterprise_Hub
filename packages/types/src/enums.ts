export const QUOTATION_STATUSES = ['draft', 'approved', 'cancelled'] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

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

export const INVOICE_STATUSES = ['issued', 'cancelled'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

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
