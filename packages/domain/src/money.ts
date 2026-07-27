/**
 * All money math runs on integer fils (1 AED = 100 fils) and only converts
 * back to a decimal at the edges. Doing it the other way round lets rounding
 * error accumulate across quotation lines, VAT, and advance allocation until
 * an invoice no longer reconciles against its own ledger.
 */
export const FILS_PER_AED = 100;

/** UAE VAT rate for tax invoices (v1). */
export const UAE_VAT_RATE = 0.05;

/**
 * Rounds half away from zero after stripping IEEE754 representation noise.
 * Scaling naively is not safe here: `1.005 * 100` evaluates to
 * 100.49999999999999, so a plain Math.round would silently lose a fil, and
 * Math.round is also asymmetric for negatives (-100.5 rounds to -100).
 */
function scaleRound(value: number, factor: number): number {
  const scaled = Number((value * factor).toPrecision(15));
  const rounded = Math.sign(scaled) * Math.round(Math.abs(scaled));
  return rounded === 0 ? 0 : rounded;
}

export function toFils(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return scaleRound(amount, FILS_PER_AED);
}

export function fromFils(fils: number): number {
  return Math.round(fils) / FILS_PER_AED;
}

export function roundMoney(amount: number): number {
  return fromFils(toFils(amount));
}

export function sumFils(values: number[]): number {
  return values.reduce((total, value) => total + Math.round(value), 0);
}

/** Extends a quantity against a unit price, rounding once at the end. */
export function extendFils(qty: number, unitPrice: number): number {
  if (!Number.isFinite(qty) || !Number.isFinite(unitPrice)) return 0;
  return scaleRound(qty * unitPrice, FILS_PER_AED);
}

export function vatOnFils(taxableFils: number, rate = UAE_VAT_RATE): number {
  return scaleRound(taxableFils, rate);
}

export function clampFils(fils: number, min = 0): number {
  return Math.max(min, Math.round(fils));
}

export function calcVat(taxableAmount: number, rate = UAE_VAT_RATE) {
  const taxableFils = toFils(taxableAmount);
  const vatFils = vatOnFils(taxableFils, rate);
  return {
    taxable: fromFils(taxableFils),
    vat: fromFils(vatFils),
    total: fromFils(taxableFils + vatFils),
  };
}

export function formatMoney(amount: number, currency = 'AED'): string {
  const value = roundMoney(amount).toLocaleString('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${value}`;
}
