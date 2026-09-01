'use client';

import { computeInvoiceTotals, computeQuotationTotals } from '@marble/domain';
import { amount, moneyHeader } from '@/lib/format';
import { useCompanyCurrency } from '@/lib/company-currency';
import { TotalsBlock } from './Finance';
import {
  discountPayload,
  discountTotalsRows,
  DocumentDiscountFields,
  EMPTY_DISCOUNT,
  LineDiscountControl,
  type DiscountDraft,
} from './DiscountFields';
import styles from './finance.module.css';

export type QuotationLineDraft = {
  productId: string;
  description: string;
  unit: string;
  qty: string;
  purchasePrice: string;
  sellPrice: string;
  discountMode: DiscountDraft['discountMode'];
  discountValue: string;
};

export type InvoiceLineDraft = {
  description: string;
  unit: string;
  qty: string;
  unitPrice: string;
  purchasePrice: string;
  discountMode: DiscountDraft['discountMode'];
  discountValue: string;
};

export const EMPTY_QUOTATION_LINE: QuotationLineDraft = {
  productId: '',
  description: '',
  unit: 'sqm',
  qty: '1',
  purchasePrice: '0',
  sellPrice: '0',
  discountMode: 'none',
  discountValue: '0',
};

export const EMPTY_INVOICE_LINE: InvoiceLineDraft = {
  description: '',
  unit: 'sqm',
  qty: '1',
  unitPrice: '0',
  purchasePrice: '0',
  discountMode: 'none',
  discountValue: '0',
};

const num = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function quotationLinePayload(lines: QuotationLineDraft[]) {
  return lines.map((line) => ({
    productId: line.productId || null,
    description: line.description.trim(),
    unit: line.unit.trim() || 'sqm',
    qty: num(line.qty),
    purchasePrice: num(line.purchasePrice),
    sellPrice: num(line.sellPrice),
    discountMode: line.discountMode,
    discountValue: num(line.discountValue),
  }));
}

export function invoiceLinePayload(lines: InvoiceLineDraft[]) {
  return lines.map((line) => ({
    description: line.description.trim(),
    unit: line.unit.trim() || 'sqm',
    qty: num(line.qty),
    unitPrice: num(line.unitPrice),
    purchasePrice: num(line.purchasePrice),
    discountMode: line.discountMode,
    discountValue: num(line.discountValue),
  }));
}

/**
 * The running totals here come from @marble/domain, the same code the API uses
 * to persist them, so what an operator sees while typing is what gets stored.
 */
export function QuotationLineEditor({
  lines,
  onChange,
  products,
  currency,
  documentDiscount = EMPTY_DISCOUNT,
  onDocumentDiscountChange,
}: {
  lines: QuotationLineDraft[];
  onChange: (lines: QuotationLineDraft[]) => void;
  products: Array<{
    id: string;
    name: string;
    unit: string;
    purchasePrice: number;
    sellPrice: number;
  }>;
  currency?: string;
  documentDiscount?: DiscountDraft;
  onDocumentDiscountChange?: (next: DiscountDraft) => void;
}) {
  const companyCode = useCompanyCurrency();
  const totals = computeQuotationTotals(
    quotationLinePayload(lines),
    discountPayload(documentDiscount),
  );
  const code = companyCode || currency;

  function patch(index: number, changes: Partial<QuotationLineDraft>) {
    onChange(
      lines.map((line, i) => (i === index ? { ...line, ...changes } : line)),
    );
  }

  /** Picking a catalog product seeds the deal prices, which stay editable. */
  function pickProduct(index: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      patch(index, { productId: '' });
      return;
    }
    patch(index, {
      productId,
      description: lines[index].description || product.name,
      unit: product.unit,
      purchasePrice: String(product.purchasePrice),
      sellPrice: String(product.sellPrice),
    });
  }

  return (
    <div className={styles.lineEditor}>
      <div className={styles.lineHead}>
        <span>Description</span>
        <span>Unit</span>
        <span>Qty</span>
        <span>Purchase</span>
        <span>Sell</span>
        <span>Disc.</span>
        <span className={styles.numeric}>{moneyHeader('Amount', code)}</span>
        <span />
      </div>

      {lines.map((line, index) => (
        <div key={index} className={styles.lineRow}>
          <div>
            <input
              className={styles.lineInput}
              value={line.description}
              placeholder="What is being supplied"
              onChange={(e) => patch(index, { description: e.target.value })}
              required
            />
            {products.length > 0 ? (
              <select
                className={styles.lineInput}
                style={{ marginTop: '0.35rem' }}
                value={line.productId}
                onChange={(e) => pickProduct(index, e.target.value)}
              >
                <option value="">No catalog product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <input
            className={styles.lineInput}
            value={line.unit}
            onChange={(e) => patch(index, { unit: e.target.value })}
          />
          <input
            className={styles.lineInput}
            type="number"
            min="0"
            step="0.01"
            value={line.qty}
            onChange={(e) => patch(index, { qty: e.target.value })}
          />
          <input
            className={styles.lineInput}
            type="number"
            min="0"
            step="0.01"
            value={line.purchasePrice}
            onChange={(e) => patch(index, { purchasePrice: e.target.value })}
          />
          <input
            className={styles.lineInput}
            type="number"
            min="0"
            step="0.01"
            value={line.sellPrice}
            onChange={(e) => patch(index, { sellPrice: e.target.value })}
          />
          <LineDiscountControl
            compact
            value={{
              discountMode: line.discountMode,
              discountValue: line.discountValue,
            }}
            onChange={(discount) =>
              patch(index, {
                discountMode: discount.discountMode,
                discountValue: discount.discountValue,
              })
            }
          />
          <span className={styles.lineComputed}>
            {totals.lineTotals[index]?.toFixed(2) ?? '0.00'}
          </span>
          <button
            type="button"
            className={styles.lineRemove}
            disabled={lines.length === 1}
            title={
              lines.length === 1
                ? 'A quotation needs at least one line'
                : 'Remove line'
            }
            onClick={() => onChange(lines.filter((_, i) => i !== index))}
          >
            ×
          </button>
        </div>
      ))}

      <div className={styles.lineFooter}>
        <button
          type="button"
          className={styles.lineAddButton}
          onClick={() => onChange([...lines, { ...EMPTY_QUOTATION_LINE }])}
        >
          + Add line
        </button>
        <div>
          {onDocumentDiscountChange ? (
            <DocumentDiscountFields
              value={documentDiscount}
              onChange={onDocumentDiscountChange}
            />
          ) : null}
          <TotalsBlock
            rows={[
              ...discountTotalsRows(totals),
              ['Cost', totals.purchaseTotal],
            ]}
            grand={['Total', totals.total]}
            currency={currency}
          />
        </div>
      </div>
      <p className={styles.panelNote} style={{ padding: '0 0.7rem 0.7rem' }}>
        Margin on these prices: {amount(totals.profit)}. Job P&amp;L uses
        these line prices, not the live catalog price.
      </p>
    </div>
  );
}

export function InvoiceLineEditor({
  lines,
  onChange,
  advanceApplied,
  currency,
  documentDiscount = EMPTY_DISCOUNT,
  onDocumentDiscountChange,
}: {
  lines: InvoiceLineDraft[];
  onChange: (lines: InvoiceLineDraft[]) => void;
  advanceApplied: number;
  currency?: string;
  documentDiscount?: DiscountDraft;
  onDocumentDiscountChange?: (next: DiscountDraft) => void;
}) {
  const companyCode = useCompanyCurrency();
  const totals = computeInvoiceTotals(
    invoiceLinePayload(lines),
    advanceApplied,
    discountPayload(documentDiscount),
  );
  const code = companyCode || currency;

  function patch(index: number, changes: Partial<InvoiceLineDraft>) {
    onChange(
      lines.map((line, i) => (i === index ? { ...line, ...changes } : line)),
    );
  }

  const totalRows = [...discountTotalsRows(totals)];
  if (totals.advanceApplied > 0) {
    totalRows.push(['Total', totals.total]);
    totalRows.push(['Advance adjusted', totals.advanceApplied]);
  }

  return (
    <div className={styles.lineEditor}>
      <div className={styles.lineHead}>
        <span>Description</span>
        <span>Unit</span>
        <span>Qty</span>
        <span>Rate</span>
        <span>Cost</span>
        <span>Disc.</span>
        <span className={styles.numeric}>{moneyHeader('Amount', code)}</span>
        <span />
      </div>

      {lines.map((line, index) => (
        <div key={index} className={styles.lineRow}>
          <input
            className={styles.lineInput}
            value={line.description}
            placeholder="What is being billed"
            onChange={(e) => patch(index, { description: e.target.value })}
            required
          />
          <input
            className={styles.lineInput}
            value={line.unit}
            onChange={(e) => patch(index, { unit: e.target.value })}
          />
          <input
            className={styles.lineInput}
            type="number"
            min="0"
            step="0.01"
            value={line.qty}
            onChange={(e) => patch(index, { qty: e.target.value })}
          />
          <input
            className={styles.lineInput}
            type="number"
            min="0"
            step="0.01"
            value={line.unitPrice}
            onChange={(e) => patch(index, { unitPrice: e.target.value })}
          />
          <input
            className={styles.lineInput}
            type="number"
            min="0"
            step="0.01"
            value={line.purchasePrice}
            onChange={(e) => patch(index, { purchasePrice: e.target.value })}
          />
          <LineDiscountControl
            compact
            value={{
              discountMode: line.discountMode,
              discountValue: line.discountValue,
            }}
            onChange={(discount) =>
              patch(index, {
                discountMode: discount.discountMode,
                discountValue: discount.discountValue,
              })
            }
          />
          <span className={styles.lineComputed}>
            {totals.lineTotals[index]?.toFixed(2) ?? '0.00'}
          </span>
          <button
            type="button"
            className={styles.lineRemove}
            disabled={lines.length === 1}
            onClick={() => onChange(lines.filter((_, i) => i !== index))}
          >
            ×
          </button>
        </div>
      ))}

      <div className={styles.lineFooter}>
        <button
          type="button"
          className={styles.lineAddButton}
          onClick={() => onChange([...lines, { ...EMPTY_INVOICE_LINE }])}
        >
          + Add line
        </button>
        <div>
          {onDocumentDiscountChange ? (
            <DocumentDiscountFields
              value={documentDiscount}
              onChange={onDocumentDiscountChange}
            />
          ) : null}
          <TotalsBlock
            rows={totalRows}
            grand={['Net payable', totals.netPayable]}
            currency={currency}
          />
        </div>
      </div>
    </div>
  );
}
