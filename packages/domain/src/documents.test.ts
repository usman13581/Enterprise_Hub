import { describe, expect, it } from 'vitest';
import {
  computeInvoiceTotals,
  computeQuotationTotals,
  progressiveLineAmount,
} from './documents';
import { roundMoney } from './money';

describe('computeQuotationTotals', () => {
  it('totals lines, adds 5 percent VAT, and reports margin', () => {
    const totals = computeQuotationTotals([
      { qty: 10, sellPrice: 250, purchasePrice: 180 },
      { qty: 4.5, sellPrice: 320, purchasePrice: 250 },
    ]);

    expect(totals.lineTotals).toEqual([2500, 1440]);
    expect(totals.subtotal).toBe(3940);
    expect(totals.vatAmount).toBe(197);
    expect(totals.total).toBe(4137);
    expect(totals.purchaseTotal).toBe(2925);
    expect(totals.profit).toBe(1015);
  });

  it('keeps subtotal plus VAT equal to total', () => {
    const totals = computeQuotationTotals([
      { qty: 3, sellPrice: 33.33, purchasePrice: 20 },
      { qty: 7, sellPrice: 11.11, purchasePrice: 5 },
    ]);
    expect(roundMoney(totals.subtotal + totals.vatAmount)).toBe(totals.total);
  });

  it('handles an empty line list without producing NaN', () => {
    const totals = computeQuotationTotals([]);
    expect(totals).toMatchObject({
      subtotal: 0,
      vatAmount: 0,
      total: 0,
      purchaseTotal: 0,
      profit: 0,
    });
  });

  it('reports a loss when sell is below purchase', () => {
    const totals = computeQuotationTotals([
      { qty: 2, sellPrice: 100, purchasePrice: 150 },
    ]);
    expect(totals.profit).toBe(-100);
  });
});

describe('computeInvoiceTotals', () => {
  it('applies an advance and reduces net payable', () => {
    const totals = computeInvoiceTotals(
      [{ qty: 10, unitPrice: 100, purchasePrice: 70 }],
      500,
    );

    expect(totals.subtotal).toBe(1000);
    expect(totals.vatAmount).toBe(50);
    expect(totals.total).toBe(1050);
    expect(totals.advanceApplied).toBe(500);
    expect(totals.netPayable).toBe(550);
    expect(totals.purchaseTotal).toBe(700);
  });

  it('never lets an oversized advance drive net payable negative', () => {
    const totals = computeInvoiceTotals([{ qty: 1, unitPrice: 100 }], 5000);
    expect(totals.total).toBe(105);
    expect(totals.advanceApplied).toBe(105);
    expect(totals.netPayable).toBe(0);
  });

  it('ignores a negative advance instead of inflating the invoice', () => {
    const totals = computeInvoiceTotals([{ qty: 1, unitPrice: 100 }], -50);
    expect(totals.advanceApplied).toBe(0);
    expect(totals.netPayable).toBe(105);
  });

  it('keeps total equal to net payable plus advance applied', () => {
    const totals = computeInvoiceTotals(
      [
        { qty: 2.25, unitPrice: 199.99 },
        { qty: 1, unitPrice: 0.01 },
      ],
      100.55,
    );
    expect(roundMoney(totals.netPayable + totals.advanceApplied)).toBe(
      totals.total,
    );
  });
});

describe('progressiveLineAmount', () => {
  it('converts a gross percentage of job value into a net line', () => {
    // 30% of 10,500 gross is 3,150 gross, which is 3,000 net of 5% VAT.
    expect(progressiveLineAmount(10500, { percentage: 30 })).toBe(3000);
  });

  it('converts an explicit gross amount into a net line', () => {
    expect(progressiveLineAmount(10500, { amount: 1050 })).toBe(1000);
  });

  it('re-grosses back to the requested amount after VAT is added', () => {
    const net = progressiveLineAmount(0, { amount: 2100 });
    const totals = computeInvoiceTotals([{ qty: 1, unitPrice: net }]);
    expect(totals.total).toBe(2100);
  });

  it('never returns a negative line', () => {
    expect(progressiveLineAmount(1000, { percentage: 0 })).toBe(0);
  });
});
