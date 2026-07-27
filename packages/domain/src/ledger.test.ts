import { describe, expect, it } from 'vitest';
import {
  jobFinancials,
  summarizeLedger,
  withRunningBalance,
  type LedgerEntryLike,
} from './ledger';

const entry = (over: Partial<LedgerEntryLike>): LedgerEntryLike => ({
  id: 'e1',
  entryType: 'invoice_issued',
  direction: 'debit',
  amount: 100,
  occurredAt: '2026-01-01T00:00:00.000Z',
  customerId: 'cust-1',
  ...over,
});

describe('withRunningBalance', () => {
  it('orders oldest first and accumulates debits and credits', () => {
    const rows = withRunningBalance([
      entry({ id: 'c', amount: 200, occurredAt: '2026-03-01T00:00:00.000Z' }),
      entry({ id: 'a', amount: 1000, occurredAt: '2026-01-01T00:00:00.000Z' }),
      entry({
        id: 'b',
        entryType: 'advance_received',
        direction: 'credit',
        amount: 400,
        occurredAt: '2026-02-01T00:00:00.000Z',
      }),
    ]);

    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(rows.map((r) => r.runningBalance)).toEqual([1000, 600, 800]);
  });

  it('breaks ties on id so the order is stable', () => {
    const rows = withRunningBalance([
      entry({ id: 'z', amount: 1 }),
      entry({ id: 'a', amount: 2 }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(['a', 'z']);
  });

  it('accepts Date objects as well as ISO strings', () => {
    const rows = withRunningBalance([
      entry({ id: 'a', occurredAt: new Date('2026-01-02T00:00:00.000Z') }),
      entry({ id: 'b', occurredAt: new Date('2026-01-01T00:00:00.000Z') }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('does not drift over many fractional entries', () => {
    const rows = withRunningBalance(
      Array.from({ length: 300 }, (_, i) =>
        entry({ id: `e${String(i).padStart(4, '0')}`, amount: 0.07 }),
      ),
    );
    expect(rows[rows.length - 1].runningBalance).toBe(21);
  });
});

describe('summarizeLedger', () => {
  it('separates billed, advances, and credit notes', () => {
    const summary = summarizeLedger(
      [
        entry({ id: 'a', entryType: 'invoice_issued', amount: 1050 }),
        entry({
          id: 'b',
          entryType: 'advance_received',
          direction: 'credit',
          amount: 400,
        }),
        entry({
          id: 'c',
          entryType: 'credit_note',
          direction: 'credit',
          amount: 50,
        }),
      ],
      150,
    );

    expect(summary).toEqual({
      billed: 1050,
      credited: 50,
      advancesReceived: 400,
      balanceDue: 600,
      unallocatedAdvances: 150,
    });
  });

  it('removes a cancelled invoice from the billed figure and the balance', () => {
    const summary = summarizeLedger([
      entry({ id: 'a', entryType: 'invoice_issued', amount: 500 }),
      entry({
        id: 'b',
        entryType: 'invoice_cancelled',
        direction: 'credit',
        amount: 500,
      }),
    ]);
    expect(summary.billed).toBe(0);
    expect(summary.balanceDue).toBe(0);
  });

  it('is all zeroes for a customer with no activity', () => {
    expect(summarizeLedger([])).toEqual({
      billed: 0,
      credited: 0,
      advancesReceived: 0,
      balanceDue: 0,
      unallocatedAdvances: 0,
    });
  });

  it('shows a credit balance when advances exceed billing', () => {
    const summary = summarizeLedger([
      entry({ id: 'a', entryType: 'invoice_issued', amount: 100 }),
      entry({
        id: 'b',
        entryType: 'advance_received',
        direction: 'credit',
        amount: 500,
      }),
    ]);
    expect(summary.balanceDue).toBe(-400);
  });
});

describe('jobFinancials', () => {
  it('tracks billing progress on gross and margin on net', () => {
    const result = jobFinancials({
      jobValue: 10500,
      jobNet: 10000,
      purchaseTotal: 7000,
      advancesApplied: 2000,
      invoices: [
        { total: 3150, kind: 'progressive', status: 'issued' },
        { total: 2100, kind: 'progressive', status: 'issued' },
      ],
    });

    expect(result.invoicedToDate).toBe(5250);
    expect(result.balanceRemaining).toBe(5250);
    expect(result.profit).toBe(3000);
    expect(result.advancesApplied).toBe(2000);
  });

  it('excludes cancelled invoices from billing progress', () => {
    const result = jobFinancials({
      jobValue: 1000,
      jobNet: 952.38,
      purchaseTotal: 500,
      advancesApplied: 0,
      invoices: [
        { total: 400, kind: 'progressive', status: 'issued' },
        { total: 600, kind: 'progressive', status: 'cancelled' },
      ],
    });
    expect(result.invoicedToDate).toBe(400);
    expect(result.balanceRemaining).toBe(600);
  });

  it('subtracts credit notes from billing progress', () => {
    const result = jobFinancials({
      jobValue: 1000,
      jobNet: 952.38,
      purchaseTotal: 500,
      advancesApplied: 0,
      invoices: [
        { total: 1000, kind: 'final', status: 'issued' },
        { total: 250, kind: 'credit_note', status: 'issued' },
      ],
    });
    expect(result.invoicedToDate).toBe(750);
    expect(result.balanceRemaining).toBe(250);
  });

  it('reports a negative remainder when a job is over-invoiced', () => {
    const result = jobFinancials({
      jobValue: 1000,
      jobNet: 952.38,
      purchaseTotal: 0,
      advancesApplied: 0,
      invoices: [{ total: 1200, kind: 'custom', status: 'issued' }],
    });
    expect(result.balanceRemaining).toBe(-200);
  });
});
