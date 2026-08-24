import {
  clampFils,
  extendFils,
  fromFils,
  sumFils,
  toFils,
  UAE_VAT_RATE,
  vatOnFils,
} from './money';

export type QuotationLineLike = {
  qty: number;
  sellPrice: number;
  purchasePrice: number;
};

export type QuotationTotals = {
  lineTotals: number[];
  subtotal: number;
  vatAmount: number;
  total: number;
  purchaseTotal: number;
  profit: number;
};

export function computeQuotationTotals(
  lines: QuotationLineLike[],
  vatRate = UAE_VAT_RATE,
): QuotationTotals {
  const lineTotalsFils = lines.map((line) =>
    extendFils(line.qty, line.sellPrice),
  );
  const purchaseFils = lines.map((line) =>
    extendFils(line.qty, line.purchasePrice),
  );

  const subtotalFils = sumFils(lineTotalsFils);
  const vatFils = vatOnFils(subtotalFils, vatRate);
  const purchaseTotalFils = sumFils(purchaseFils);

  return {
    lineTotals: lineTotalsFils.map(fromFils),
    subtotal: fromFils(subtotalFils),
    vatAmount: fromFils(vatFils),
    total: fromFils(subtotalFils + vatFils),
    purchaseTotal: fromFils(purchaseTotalFils),
    profit: fromFils(subtotalFils - purchaseTotalFils),
  };
}

/** Counter Top: sum section amounts, subtract discount, then VAT. */
export function computeCounterTopTotals(
  sectionAmounts: number[],
  discount = 0,
  vatRate = UAE_VAT_RATE,
): Omit<QuotationTotals, 'lineTotals'> & { discount: number } {
  const grossFils = sumFils(sectionAmounts.map((amount) => toFils(amount)));
  const discountFils = Math.min(Math.max(0, toFils(discount)), grossFils);
  const subtotalFils = grossFils - discountFils;
  const vatFils = vatOnFils(subtotalFils, vatRate);

  return {
    discount: fromFils(discountFils),
    subtotal: fromFils(subtotalFils),
    vatAmount: fromFils(vatFils),
    total: fromFils(subtotalFils + vatFils),
    purchaseTotal: 0,
    profit: fromFils(subtotalFils),
  };
}

/** Item line amounts drive the section total when any are set. */
export function resolveCounterTopSectionAmount(
  items: Array<{ amount?: number }>,
  storedSectionAmount = 0,
): number {
  const itemSum = items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  return itemSum > 0 ? itemSum : storedSectionAmount;
}

export type InvoiceLineLike = {
  qty: number;
  unitPrice: number;
  purchasePrice?: number;
};

export type InvoiceTotals = {
  lineTotals: number[];
  subtotal: number;
  vatAmount: number;
  total: number;
  advanceApplied: number;
  netPayable: number;
  purchaseTotal: number;
};

/**
 * `advanceApplied` never pushes `netPayable` below zero — an over-applied
 * advance stays available on the customer ledger rather than turning into a
 * negative amount due on a tax invoice.
 */
export function computeInvoiceTotals(
  lines: InvoiceLineLike[],
  advanceAppliedAmount = 0,
  vatRate = UAE_VAT_RATE,
): InvoiceTotals {
  const lineTotalsFils = lines.map((line) =>
    extendFils(line.qty, line.unitPrice),
  );
  const purchaseFils = lines.map((line) =>
    extendFils(line.qty, line.purchasePrice ?? 0),
  );

  const subtotalFils = sumFils(lineTotalsFils);
  const vatFils = vatOnFils(subtotalFils, vatRate);
  const totalFils = subtotalFils + vatFils;
  const appliedFils = Math.min(clampFils(toFils(advanceAppliedAmount)), totalFils);

  return {
    lineTotals: lineTotalsFils.map(fromFils),
    subtotal: fromFils(subtotalFils),
    vatAmount: fromFils(vatFils),
    total: fromFils(totalFils),
    advanceApplied: fromFils(appliedFils),
    netPayable: fromFils(totalFils - appliedFils),
    purchaseTotal: fromFils(sumFils(purchaseFils)),
  };
}

/**
 * Splits a target gross amount (or percentage of job value) into a single
 * taxable line so progressive invoices can be raised without hand-entered
 * lines. The caller supplies gross-of-VAT intent; the line is net of VAT.
 */
export function progressiveLineAmount(
  jobValueGross: number,
  options: { percentage?: number; amount?: number },
  vatRate = UAE_VAT_RATE,
): number {
  const grossFils =
    options.amount !== undefined
      ? toFils(options.amount)
      : Math.round(toFils(jobValueGross) * ((options.percentage ?? 0) / 100));

  const netFils = Math.round(grossFils / (1 + vatRate));
  return fromFils(clampFils(netFils));
}
