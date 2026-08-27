import { fromFils, roundMoney, toFils } from './money';
import { unallocatedAmount, type AdvanceLike } from './allocations';
import {
  summarizeLedger,
  withRunningBalance,
  type LedgerEntryLike,
} from './ledger';

/** Start of the current calendar month (local UTC date parts). */
export function defaultReportFrom(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}

/** End of “today” for report ranges (inclusive end-of-day UTC). */
export function defaultReportTo(now = new Date()): Date {
  return endOfUtcDay(now);
}

export function defaultAsOf(now = new Date()): Date {
  return endOfUtcDay(now);
}

export function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

export function endOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

export function parseReportDate(
  value: string | undefined | null,
  fallback: Date,
): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function entryTime(value: Date | string): number {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

/**
 * Statement slice: balance before `from`, movements in [from, to], running
 * balances, and closing. Optional job filter keeps only matching entries.
 */
export function customerStatement(input: {
  entries: LedgerEntryLike[];
  from: Date;
  to: Date;
  jobId?: string | null;
  unallocatedAdvances?: number;
}) {
  const scoped = input.jobId
    ? input.entries.filter((entry) => entry.jobId === input.jobId)
    : input.entries;

  const fromMs = input.from.getTime();
  const toMs = input.to.getTime();

  const before = scoped.filter((entry) => entryTime(entry.occurredAt) < fromMs);
  const period = scoped.filter((entry) => {
    const t = entryTime(entry.occurredAt);
    return t >= fromMs && t <= toMs;
  });

  let openingFils = 0;
  for (const entry of before) {
    const amountFils = toFils(entry.amount);
    openingFils += entry.direction === 'debit' ? amountFils : -amountFils;
  }

  const movements = withRunningBalance(period).map((entry) => ({
    ...entry,
    runningBalance: fromFils(toFils(entry.runningBalance) + openingFils),
  }));

  const periodSummary = summarizeLedger(
    period,
    input.unallocatedAdvances ?? 0,
  );

  let movementFils = 0;
  for (const entry of period) {
    const amountFils = toFils(entry.amount);
    movementFils += entry.direction === 'debit' ? amountFils : -amountFils;
  }

  return {
    openingBalance: fromFils(openingFils),
    closingBalance: fromFils(openingFils + movementFils),
    movements,
    periodSummary,
  };
}

export type AgingBucketKey =
  | 'current'
  | 'days1to30'
  | 'days31to60'
  | 'days61to90'
  | 'days90plus';

export const AGING_BUCKET_LABELS: Record<AgingBucketKey, string> = {
  current: 'Current',
  days1to30: '1–30 days',
  days31to60: '31–60 days',
  days61to90: '61–90 days',
  days90plus: '90+ days',
};

export function agingBucket(
  dueOrIssue: Date,
  asOf: Date,
): AgingBucketKey {
  const dueStart = startOfUtcDay(dueOrIssue).getTime();
  const asOfStart = startOfUtcDay(asOf).getTime();
  const days = Math.floor((asOfStart - dueStart) / 86_400_000);
  if (days <= 0) return 'current';
  if (days <= 30) return 'days1to30';
  if (days <= 60) return 'days31to60';
  if (days <= 90) return 'days61to90';
  return 'days90plus';
}

export type AgeableInvoice = {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  jobId?: string | null;
  jobNumber?: string | null;
  issueDate: Date | string;
  dueDate?: Date | string | null;
  netPayable: number;
  /** Already applied on the document (InvoiceAdvanceAllocation sum). */
  advanceApplied: number;
};

/**
 * Applies leftover unallocated advances FIFO onto the oldest outstanding
 * invoices (by due date, then issue date, then number) so cash on account is
 * not double-counted against aged AR.
 */
export function ageReceivables(input: {
  invoices: AgeableInvoice[];
  advances: AdvanceLike[];
  asOf: Date;
}): {
  rows: Array<
    AgeableInvoice & {
      outstanding: number;
      bucket: AgingBucketKey;
      fifoApplied: number;
    }
  >;
  totals: Record<AgingBucketKey, number> & { outstanding: number };
} {
  const leftovers = input.advances
    .map((advance) => ({
      ...advance,
      leftoverFils: toFils(unallocatedAmount(advance)),
    }))
    .filter((advance) => advance.leftoverFils > 0);

  const leftoverByCustomer = new Map<string, number>();
  for (const advance of leftovers) {
    leftoverByCustomer.set(
      advance.customerId,
      (leftoverByCustomer.get(advance.customerId) ?? 0) + advance.leftoverFils,
    );
  }

  const sorted = [...input.invoices].sort((a, b) => {
    const aDue = entryTime(a.dueDate ?? a.issueDate);
    const bDue = entryTime(b.dueDate ?? b.issueDate);
    if (aDue !== bDue) return aDue - bDue;
    const aIssue = entryTime(a.issueDate);
    const bIssue = entryTime(b.issueDate);
    if (aIssue !== bIssue) return aIssue - bIssue;
    return a.number.localeCompare(b.number);
  });

  const rows: Array<
    AgeableInvoice & {
      outstanding: number;
      bucket: AgingBucketKey;
      fifoApplied: number;
    }
  > = [];

  const totals: Record<AgingBucketKey, number> & { outstanding: number } = {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days90plus: 0,
    outstanding: 0,
  };

  for (const invoice of sorted) {
    let remainingFils = toFils(invoice.netPayable);
    let fifoFils = 0;
    const available = leftoverByCustomer.get(invoice.customerId) ?? 0;
    if (available > 0 && remainingFils > 0) {
      const take = Math.min(available, remainingFils);
      fifoFils = take;
      remainingFils -= take;
      leftoverByCustomer.set(invoice.customerId, available - take);
    }

    const outstanding = fromFils(remainingFils);
    if (outstanding <= 0) continue;

    const due = new Date(invoice.dueDate ?? invoice.issueDate);
    const bucket = agingBucket(due, input.asOf);
    rows.push({
      ...invoice,
      outstanding: roundMoney(outstanding),
      bucket,
      fifoApplied: fromFils(fifoFils),
    });
    totals[bucket] = roundMoney(totals[bucket] + outstanding);
    totals.outstanding = roundMoney(totals.outstanding + outstanding);
  }

  return { rows, totals };
}

export function emptyAgingTotals(): Record<AgingBucketKey, number> & {
  outstanding: number;
} {
  return {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days90plus: 0,
    outstanding: 0,
  };
}
