import {
  applyDiscount,
  applyDiscountFils,
  normalizeDiscount,
  type DiscountFields,
  type DiscountMode,
} from './discount';
import {
  clampFils,
  extendFils,
  fromFils,
  sumFils,
  toFils,
  UAE_VAT_RATE,
  vatOnFils,
} from './money';

export type { DiscountMode, DiscountFields };
export { normalizeDiscount, applyDiscount };

export type LineWithDiscount = {
  discountMode?: DiscountMode;
  discountValue?: number;
};

export type QuotationLineLike = LineWithDiscount & {
  qty: number;
  sellPrice: number;
  purchasePrice: number;
};

export type TotalsBreakdown = {
  lineGrossTotal: number;
  lineDiscountTotal: number;
  /** Applied document-level discount amount. */
  discount: number;
  subtotal: number;
  vatAmount: number;
  total: number;
};

export type QuotationTotals = TotalsBreakdown & {
  lineTotals: number[];
  lineGrossTotals: number[];
  purchaseTotal: number;
  profit: number;
};

function lineNetFils(
  qty: number,
  unitPrice: number,
  discount: DiscountFields,
): { grossFils: number; netFils: number; discountFils: number } {
  const grossFils = extendFils(qty, unitPrice);
  const normalized = normalizeDiscount(discount);
  const { netFils, discountFils } = applyDiscountFils(
    grossFils,
    normalized.discountMode,
    normalized.discountValue,
  );
  return { grossFils, netFils, discountFils };
}

export function computeQuotationTotals(
  lines: QuotationLineLike[],
  documentDiscount: DiscountFields = {},
  vatRate = UAE_VAT_RATE,
): QuotationTotals {
  const lineResults = lines.map((line) =>
    lineNetFils(line.qty, line.sellPrice, line),
  );
  const purchaseFils = lines.map((line) =>
    extendFils(line.qty, line.purchasePrice),
  );

  const lineGrossFils = lineResults.map((r) => r.grossFils);
  const lineNetFilsArr = lineResults.map((r) => r.netFils);
  const lineDiscountFils = lineResults.reduce((s, r) => s + r.discountFils, 0);
  const beforeDocFils = sumFils(lineNetFilsArr);

  const doc = normalizeDiscount(documentDiscount);
  const { netFils: subtotalFils, discountFils: docDiscountFils } =
    applyDiscountFils(beforeDocFils, doc.discountMode, doc.discountValue);
  const vatFils = vatOnFils(subtotalFils, vatRate);
  const purchaseTotalFils = sumFils(purchaseFils);

  return {
    lineGrossTotals: lineGrossFils.map(fromFils),
    lineTotals: lineNetFilsArr.map(fromFils),
    lineGrossTotal: fromFils(sumFils(lineGrossFils)),
    lineDiscountTotal: fromFils(lineDiscountFils),
    discount: fromFils(docDiscountFils),
    subtotal: fromFils(subtotalFils),
    vatAmount: fromFils(vatFils),
    total: fromFils(subtotalFils + vatFils),
    purchaseTotal: fromFils(purchaseTotalFils),
    profit: fromFils(subtotalFils - purchaseTotalFils),
  };
}

export type CounterTopItemLike = LineWithDiscount & {
  amount?: number;
};

export type CounterTopSectionLike = LineWithDiscount & {
  amount?: number;
  items: CounterTopItemLike[];
};

/** Counter Top: item/section discounts, then document discount, then VAT. */
export function computeCounterTopTotals(
  sections: CounterTopSectionLike[],
  documentDiscount: DiscountFields = {},
  vatRate = UAE_VAT_RATE,
): Omit<QuotationTotals, 'lineTotals' | 'lineGrossTotals'> & {
  lineTotals: number[];
  lineGrossTotals: number[];
} {
  let lineGrossFils = 0;
  let lineDiscountFils = 0;
  const sectionNetFilsArr: number[] = [];
  const sectionGrossFilsArr: number[] = [];

  for (const section of sections) {
    const itemAmounts = section.items.filter((item) => (item.amount ?? 0) > 0);
    if (itemAmounts.length > 0) {
      let sectionGross = 0;
      let sectionNet = 0;
      for (const item of section.items) {
        const amountFils = toFils(item.amount ?? 0);
        if (amountFils <= 0) continue;
        const normalized = normalizeDiscount(item);
        const { netFils, discountFils } = applyDiscountFils(
          amountFils,
          normalized.discountMode,
          normalized.discountValue,
        );
        sectionGross += amountFils;
        sectionNet += netFils;
        lineDiscountFils += discountFils;
      }
      lineGrossFils += sectionGross;
      sectionGrossFilsArr.push(fromFils(sectionGross));
      sectionNetFilsArr.push(sectionNet);
    } else {
      const sectionGrossFilsVal = toFils(section.amount ?? 0);
      const normalized = normalizeDiscount(section);
      const { netFils, discountFils } = applyDiscountFils(
        sectionGrossFilsVal,
        normalized.discountMode,
        normalized.discountValue,
      );
      lineGrossFils += sectionGrossFilsVal;
      lineDiscountFils += discountFils;
      sectionGrossFilsArr.push(fromFils(sectionGrossFilsVal));
      sectionNetFilsArr.push(netFils);
    }
  }

  const beforeDocFils = sumFils(sectionNetFilsArr);
  const doc = normalizeDiscount(documentDiscount);
  const { netFils: subtotalFils, discountFils: docDiscountFils } =
    applyDiscountFils(beforeDocFils, doc.discountMode, doc.discountValue);
  const vatFils = vatOnFils(subtotalFils, vatRate);

  return {
    lineGrossTotals: sectionGrossFilsArr,
    lineTotals: sectionNetFilsArr.map(fromFils),
    lineGrossTotal: fromFils(lineGrossFils),
    lineDiscountTotal: fromFils(lineDiscountFils),
    discount: fromFils(docDiscountFils),
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

export type InvoiceLineLike = LineWithDiscount & {
  qty: number;
  unitPrice: number;
  purchasePrice?: number;
};

export type InvoiceTotals = TotalsBreakdown & {
  lineTotals: number[];
  lineGrossTotals: number[];
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
  documentDiscount: DiscountFields = {},
  vatRate = UAE_VAT_RATE,
): InvoiceTotals {
  const lineResults = lines.map((line) =>
    lineNetFils(line.qty, line.unitPrice, line),
  );
  const purchaseFils = lines.map((line) =>
    extendFils(line.qty, line.purchasePrice ?? 0),
  );

  const lineGrossFils = lineResults.map((r) => r.grossFils);
  const lineNetFilsArr = lineResults.map((r) => r.netFils);
  const lineDiscountFils = lineResults.reduce((s, r) => s + r.discountFils, 0);
  const beforeDocFils = sumFils(lineNetFilsArr);

  const doc = normalizeDiscount(documentDiscount);
  const { netFils: subtotalFils, discountFils: docDiscountFils } =
    applyDiscountFils(beforeDocFils, doc.discountMode, doc.discountValue);
  const vatFils = vatOnFils(subtotalFils, vatRate);
  const totalFils = subtotalFils + vatFils;
  const appliedFils = Math.min(
    clampFils(toFils(advanceAppliedAmount)),
    totalFils,
  );

  return {
    lineGrossTotals: lineGrossFils.map(fromFils),
    lineTotals: lineNetFilsArr.map(fromFils),
    lineGrossTotal: fromFils(sumFils(lineGrossFils)),
    lineDiscountTotal: fromFils(lineDiscountFils),
    discount: fromFils(docDiscountFils),
    subtotal: fromFils(subtotalFils),
    vatAmount: fromFils(vatFils),
    total: fromFils(totalFils),
    advanceApplied: fromFils(appliedFils),
    netPayable: fromFils(totalFils - appliedFils),
    purchaseTotal: fromFils(sumFils(purchaseFils)),
  };
}

export type PurchasingLineLike = LineWithDiscount & {
  qty: number;
  unitCost: number;
  vatRate?: number;
};

export type PurchasingTotals = TotalsBreakdown & {
  lineTotals: number[];
  lineGrossTotals: number[];
  inputVat: number;
};

/** LPO and purchase invoice shared totals — discount before per-line VAT. */
export function computePurchasingTotals(
  lines: PurchasingLineLike[],
  documentDiscount: DiscountFields = {},
  options: { taxInclusive?: boolean } = {},
): PurchasingTotals {
  const taxInclusive = options.taxInclusive ?? false;
  let lineGrossFils = 0;
  let lineDiscountFils = 0;
  const lineNetFilsArr: number[] = [];
  const lineGrossFilsArr: number[] = [];
  let inputVatFils = 0;

  for (const line of lines) {
    const grossFils = extendFils(line.qty, line.unitCost);
    const normalized = normalizeDiscount(line);
    const { netFils: discountedGrossFils, discountFils } = applyDiscountFils(
      grossFils,
      normalized.discountMode,
      normalized.discountValue,
    );
    lineGrossFils += grossFils;
    lineDiscountFils += discountFils;
    lineGrossFilsArr.push(fromFils(grossFils));

    const vatRate = line.vatRate ?? UAE_VAT_RATE;
    let lineNetFils: number;
    let lineVatFils: number;
    if (taxInclusive) {
      lineNetFils = Math.round(discountedGrossFils / (1 + vatRate));
      lineVatFils = discountedGrossFils - lineNetFils;
    } else {
      lineNetFils = discountedGrossFils;
      lineVatFils = vatOnFils(lineNetFils, vatRate);
    }
    lineNetFilsArr.push(lineNetFils);
    inputVatFils += lineVatFils;
  }

  const beforeDocFils = sumFils(lineNetFilsArr);
  const doc = normalizeDiscount(documentDiscount);
  const { netFils: subtotalFils, discountFils: docDiscountFils } =
    applyDiscountFils(beforeDocFils, doc.discountMode, doc.discountValue);

  if (docDiscountFils > 0 && beforeDocFils > 0) {
    const ratio = subtotalFils / beforeDocFils;
    inputVatFils = Math.round(inputVatFils * ratio);
  }

  const totalFils = subtotalFils + inputVatFils;

  return {
    lineGrossTotals: lineGrossFilsArr,
    lineTotals: lineNetFilsArr.map(fromFils),
    lineGrossTotal: fromFils(lineGrossFils),
    lineDiscountTotal: fromFils(lineDiscountFils),
    discount: fromFils(docDiscountFils),
    subtotal: fromFils(subtotalFils),
    vatAmount: fromFils(inputVatFils),
    inputVat: fromFils(inputVatFils),
    total: fromFils(totalFils),
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
