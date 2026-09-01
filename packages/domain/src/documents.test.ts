import { describe, expect, it } from 'vitest';
import { applyDiscount } from './discount';
import {
  computeCounterTopTotals,
  computeInvoiceTotals,
  computePurchasingTotals,
  computeQuotationTotals,
} from './documents';

describe('applyDiscount', () => {
  it('caps fixed discount at gross', () => {
    expect(applyDiscount(100, 'fixed', 150)).toEqual({
      net: 0,
      discountAmount: 100,
    });
  });

  it('applies percent discount', () => {
    expect(applyDiscount(200, 'percent', 10)).toEqual({
      net: 180,
      discountAmount: 20,
    });
  });
});

describe('computeQuotationTotals', () => {
  it('applies line and document discounts before VAT', () => {
    const totals = computeQuotationTotals(
      [
        {
          qty: 10,
          sellPrice: 100,
          purchasePrice: 50,
          discountMode: 'percent',
          discountValue: 10,
        },
      ],
      { discountMode: 'fixed', discountValue: 50 },
    );
    expect(totals.lineGrossTotal).toBe(1000);
    expect(totals.lineDiscountTotal).toBe(100);
    expect(totals.discount).toBe(50);
    expect(totals.subtotal).toBe(850);
    expect(totals.vatAmount).toBe(42.5);
    expect(totals.total).toBe(892.5);
  });
});

describe('computeCounterTopTotals', () => {
  it('sums item discounts then document discount', () => {
    const totals = computeCounterTopTotals(
      [
        {
          amount: 0,
          items: [
            { amount: 1000, discountMode: 'fixed', discountValue: 100 },
            { amount: 500, discountMode: 'none', discountValue: 0 },
          ],
        },
      ],
      { discountMode: 'percent', discountValue: 5 },
    );
    expect(totals.lineDiscountTotal).toBe(100);
    expect(totals.subtotal).toBe(1330);
    expect(totals.total).toBe(1396.5);
  });
});

describe('computeInvoiceTotals', () => {
  it('applies discounts before advance allocation', () => {
    const totals = computeInvoiceTotals(
      [{ qty: 2, unitPrice: 500, discountMode: 'fixed', discountValue: 50 }],
      100,
      { discountMode: 'none', discountValue: 0 },
    );
    expect(totals.subtotal).toBe(950);
    expect(totals.total).toBe(997.5);
    expect(totals.advanceApplied).toBe(100);
    expect(totals.netPayable).toBe(897.5);
  });
});

describe('computePurchasingTotals', () => {
  it('computes line discount and VAT for exclusive tax', () => {
    const totals = computePurchasingTotals([
      { qty: 10, unitCost: 100, discountMode: 'percent', discountValue: 10 },
    ]);
    expect(totals.subtotal).toBe(900);
    expect(totals.inputVat).toBe(45);
    expect(totals.total).toBe(945);
  });
});
