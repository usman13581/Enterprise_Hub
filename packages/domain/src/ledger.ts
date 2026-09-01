import { fromFils, toFils } from './money';

export type LedgerDirection = 'debit' | 'credit';

export type LedgerEntryLike = {
  id: string;
  entryType: string;
  direction: LedgerDirection;
  amount: number;
  occurredAt: Date | string;
  memo?: string | null;
  customerId: string;
  jobId?: string | null;
  invoiceId?: string | null;
  advanceId?: string | null;
};

export type MoneySummary = {
  billed: number;
  credited: number;
  advancesReceived: number;
  balanceDue: number;
  unallocatedAdvances: number;
};

function time(value: Date | string): number {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

/**
 * Orders entries oldest-first and attaches the running balance a customer
 * statement needs. Debits increase the balance owed, credits reduce it.
 */
export function withRunningBalance<T extends LedgerEntryLike>(
  entries: T[],
): Array<T & { runningBalance: number }> {
  const sorted = [...entries].sort((a, b) => {
    const diff = time(a.occurredAt) - time(b.occurredAt);
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });

  let balanceFils = 0;
  return sorted.map((entry) => {
    const amountFils = toFils(entry.amount);
    balanceFils += entry.direction === 'debit' ? amountFils : -amountFils;
    return { ...entry, runningBalance: fromFils(balanceFils) };
  });
}

export function summarizeLedger(
  entries: LedgerEntryLike[],
  unallocatedAdvances = 0,
): MoneySummary {
  let billedFils = 0;
  let creditedFils = 0;
  let advancesFils = 0;
  let balanceFils = 0;

  for (const entry of entries) {
    const amountFils = toFils(entry.amount);
    balanceFils += entry.direction === 'debit' ? amountFils : -amountFils;

    switch (entry.entryType) {
      case 'invoice_issued':
        billedFils += amountFils;
        break;
      case 'invoice_cancelled':
        billedFils -= amountFils;
        break;
      case 'credit_note':
        creditedFils += amountFils;
        break;
      case 'advance_received':
        advancesFils += amountFils;
        break;
      case 'advance_refunded':
        advancesFils -= amountFils;
        break;
      default:
        break;
    }
  }

  return {
    billed: fromFils(billedFils),
    credited: fromFils(creditedFils),
    advancesReceived: fromFils(advancesFils),
    balanceDue: fromFils(balanceFils),
    unallocatedAdvances: fromFils(toFils(unallocatedAdvances)),
  };
}

export type JobFinancials = {
  jobValue: number;
  invoicedToDate: number;
  advancesApplied: number;
  balanceRemaining: number;
  purchaseTotal: number;
  profit: number;
};

/**
 * Billing progress (`invoicedToDate`, `balanceRemaining`) is tracked on gross,
 * VAT-inclusive amounts because that is what the customer pays. Margin is
 * tracked on `jobNet` excluding VAT, since collected VAT is owed onward and is
 * not revenue. Both sides use the quotation line prices captured on the job,
 * never live catalog prices, so re-pricing a product later cannot rewrite
 * historic margin.
 */
export function jobFinancials(input: {
  jobValue: number;
  jobNet: number;
  invoices: Array<{ total: number; kind: string; status: string }>;
  advancesApplied: number;
  purchaseTotal: number;
}): JobFinancials {
  let invoicedFils = 0;
  let reservedFils = 0;
  for (const invoice of input.invoices) {
    if (invoice.status === 'cancelled') continue;
    const amountFils = toFils(invoice.total);
    const signed = invoice.kind === 'credit_note' ? -amountFils : amountFils;
    if (invoice.status === 'draft') {
      reservedFils += signed;
      continue;
    }
    invoicedFils += signed;
  }

  const jobValueFils = toFils(input.jobValue);
  const purchaseFils = toFils(input.purchaseTotal);

  return {
    jobValue: fromFils(jobValueFils),
    invoicedToDate: fromFils(invoicedFils),
    advancesApplied: fromFils(toFils(input.advancesApplied)),
    balanceRemaining: fromFils(jobValueFils - invoicedFils - reservedFils),
    purchaseTotal: fromFils(purchaseFils),
    profit: fromFils(toFils(input.jobNet) - purchaseFils),
  };
}
