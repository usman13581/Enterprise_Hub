import { describe, expect, it } from 'vitest';
import {
  calcVat,
  extendFils,
  formatMoney,
  fromFils,
  roundMoney,
  sumFils,
  toFils,
  UAE_VAT_RATE,
  vatOnFils,
} from './money';

describe('fils conversion', () => {
  it('round-trips two-decimal amounts exactly', () => {
    for (const amount of [0, 0.01, 0.05, 1.15, 99.99, 12345.67]) {
      expect(fromFils(toFils(amount))).toBe(amount);
    }
  });

  it('rounds half up at the fil boundary', () => {
    expect(toFils(1.005)).toBe(101);
    expect(toFils(1.004)).toBe(100);
  });

  it('treats non-finite input as zero rather than propagating NaN', () => {
    expect(toFils(Number.NaN)).toBe(0);
    expect(toFils(Number.POSITIVE_INFINITY)).toBe(0);
    expect(extendFils(Number.NaN, 10)).toBe(0);
  });

  it('avoids the float drift that plain addition produces', () => {
    const naive = 0.1 + 0.2;
    expect(naive).not.toBe(0.3);
    expect(fromFils(sumFils([toFils(0.1), toFils(0.2)]))).toBe(0.3);
  });

  it('stays exact across many small additions', () => {
    const cents = Array.from({ length: 1000 }, () => toFils(0.07));
    expect(fromFils(sumFils(cents))).toBe(70);
  });
});

describe('extendFils', () => {
  it('extends fractional quantities to the nearest fil', () => {
    expect(fromFils(extendFils(12.5, 240.5))).toBe(3006.25);
  });

  it('rounds once instead of compounding per-unit error', () => {
    expect(fromFils(extendFils(3, 0.335))).toBe(1.01);
  });
});

describe('VAT', () => {
  it('uses the UAE 5 percent rate', () => {
    expect(UAE_VAT_RATE).toBe(0.05);
    expect(fromFils(vatOnFils(toFils(100)))).toBe(5);
  });

  it('rounds VAT to the nearest fil', () => {
    expect(fromFils(vatOnFils(toFils(10.13)))).toBe(0.51);
  });

  it('returns taxable, vat, and gross that add up', () => {
    const result = calcVat(1999.99);
    expect(result.taxable).toBe(1999.99);
    expect(result.vat).toBe(100);
    expect(result.total).toBe(2099.99);
    expect(roundMoney(result.taxable + result.vat)).toBe(result.total);
  });
});

describe('formatMoney', () => {
  it('always shows two decimals with the currency prefix', () => {
    expect(formatMoney(1234.5)).toBe('AED 1,234.50');
    expect(formatMoney(0)).toBe('AED 0.00');
  });
});
