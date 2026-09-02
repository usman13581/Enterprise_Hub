'use client';

import { computePurchasingTotals } from '@marble/domain';
import { moneyHeader } from '@/lib/format';
import { useCompanyCurrency } from '@/lib/company-currency';
import {
  discountPayload,
  discountTotalsRows,
  DocumentDiscountFields,
  EMPTY_DISCOUNT,
  LineDiscountControl,
  type DiscountDraft,
} from '@/components/DiscountFields';
import { TotalsBlock } from '@/components/Finance';
import { SearchableSelect } from '@/components/SearchableSelect';
import type { DiscountMode, LpoLine, Product } from '@marble/types';
import styles from './finance.module.css';

export type PurchaseLineDraft = {
  productId: string;
  productName: string;
  unit: string;
  qty: string;
  unitCost: string;
  discountMode: DiscountDraft['discountMode'];
  discountValue: string;
  lpoLineId?: string;
};

export const EMPTY_PURCHASE_LINE: PurchaseLineDraft = {
  productId: '',
  productName: '',
  unit: 'unit',
  qty: '1',
  unitCost: '0',
  discountMode: 'none',
  discountValue: '0',
};

const num = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function purchaseLinePayload(lines: PurchaseLineDraft[]) {
  return lines.map((line) => ({
    ...(line.lpoLineId ? { lpoLineId: line.lpoLineId } : {}),
    productId: line.productId || null,
    productName: line.productName.trim(),
    unit: line.unit.trim() || 'unit',
    qty: num(line.qty),
    unitCost: num(line.unitCost),
    discountMode: line.discountMode,
    discountValue: num(line.discountValue),
  }));
}

export function purchaseInvoiceLinesToDraft(
  lines: Array<{
    productId: string | null;
    productName: string;
    unit: string;
    qty: number;
    unitCost: number;
    discountMode: DiscountMode;
    discountValue: number;
  }>,
): PurchaseLineDraft[] {
  return lines.map((line) => ({
    productId: line.productId ?? '',
    productName: line.productName,
    unit: line.unit,
    qty: String(line.qty),
    unitCost: String(line.unitCost),
    discountMode: line.discountMode,
    discountValue: String(line.discountValue ?? 0),
  }));
}

export function lpoLinesToDraft(lines: LpoLine[]): PurchaseLineDraft[] {
  return lines.map((line) => ({
    productId: line.productId ?? '',
    productName: line.productName,
    unit: line.unit,
    qty: String(line.orderedQty),
    unitCost: String(line.unitCost),
    discountMode: line.discountMode,
    discountValue: String(line.discountValue ?? 0),
  }));
}

export function lpoLinesToInvoiceDraft(lines: LpoLine[]): PurchaseLineDraft[] {
  const draft: PurchaseLineDraft[] = [];
  for (const line of lines) {
    const remaining = line.orderedQty - line.invoicedQty;
    if (remaining <= 0) continue;
    draft.push({
      productId: line.productId ?? '',
      productName: line.productName,
      unit: line.unit,
      qty: String(remaining),
      unitCost: String(line.unitCost),
      discountMode: line.discountMode,
      discountValue: String(line.discountValue ?? 0),
      lpoLineId: line.id,
    });
  }
  return draft;
}

export function lpoLinePayload(lines: PurchaseLineDraft[]) {
  return purchaseLinePayload(lines).map((line) => ({
    productId: line.productId,
    productName: line.productName,
    unit: line.unit,
    orderedQty: line.qty,
    unitCost: line.unitCost,
    discountMode: line.discountMode,
    discountValue: line.discountValue,
  }));
}

export function PurchasingLineEditor({
  lines,
  onChange,
  products,
  supplierId,
  documentDiscount = EMPTY_DISCOUNT,
  onDocumentDiscountChange,
  taxInclusive = false,
  currency,
}: {
  lines: PurchaseLineDraft[];
  onChange: (lines: PurchaseLineDraft[]) => void;
  products: Product[];
  supplierId: string;
  documentDiscount?: DiscountDraft;
  onDocumentDiscountChange?: (next: DiscountDraft) => void;
  taxInclusive?: boolean;
  currency?: string;
}) {
  const companyCode = useCompanyCurrency();
  const payloadLines = purchaseLinePayload(lines);
  const totals = computePurchasingTotals(
    payloadLines.map((line) => ({
      qty: line.qty,
      unitCost: line.unitCost,
      discountMode: line.discountMode,
      discountValue: line.discountValue,
    })),
    discountPayload(documentDiscount),
    { taxInclusive },
  );
  const code = companyCode || currency;

  function patch(index: number, changes: Partial<PurchaseLineDraft>) {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...changes } : line)));
  }

  function pickProduct(index: number, productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product) {
      patch(index, { productId: '', productName: lines[index].productName });
      return;
    }
    patch(index, {
      productId,
      productName: product.name,
      unit: product.unit,
      unitCost: String(product.purchasePrice),
    });
  }

  const supplierProducts = products.filter(
    (product) => product.supplierId === supplierId,
  );

  return (
    <div className={`${styles.lineEditor} ${styles.purchasingLineEditor}`}>
      <div className={styles.lineHead}>
        <span>Description</span>
        <span>Unit</span>
        <span>Qty</span>
        <span>Unit cost</span>
        <span>Disc.</span>
        <span className={styles.numeric}>{moneyHeader('Amount', code)}</span>
        <span />
      </div>

      {lines.map((line, index) => (
        <div key={index} className={styles.lineRow}>
          <div>
            <input
              className={styles.lineInput}
              value={line.productName}
              placeholder="What is being purchased"
              required
              onChange={(event) =>
                patch(index, { productName: event.target.value })
              }
            />
            {supplierProducts.length > 0 ? (
              <SearchableSelect
                label=""
                value={line.productId}
                onChange={(value) => pickProduct(index, value)}
                disabled={!supplierId}
                placeholder="Optional catalog product…"
                allowEmpty
                emptyLabel="No catalog product"
                options={supplierProducts.map((product) => ({
                  id: product.id,
                  label: product.name,
                }))}
              />
            ) : null}
          </div>
          <input
            className={styles.lineInput}
            value={line.unit}
            onChange={(event) => patch(index, { unit: event.target.value })}
          />
          <input
            className={styles.lineInput}
            type="number"
            min="0.01"
            step="0.01"
            value={line.qty}
            onChange={(event) => patch(index, { qty: event.target.value })}
          />
          <input
            className={styles.lineInput}
            type="number"
            min="0"
            step="0.01"
            value={line.unitCost}
            onChange={(event) => patch(index, { unitCost: event.target.value })}
          />
          <LineDiscountControl
            compact
            showLabel={false}
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
                ? 'An LPO needs at least one line'
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
          onClick={() => onChange([...lines, { ...EMPTY_PURCHASE_LINE }])}
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
            rows={discountTotalsRows({
              ...totals,
              vatAmount: totals.inputVat,
            })}
            grand={['Total', totals.total]}
            currency={currency}
          />
        </div>
      </div>
    </div>
  );
}
