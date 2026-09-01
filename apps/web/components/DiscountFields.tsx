'use client';

import type { DiscountMode, TotalsBreakdown } from '@marble/domain';
import { UAE_VAT_RATE } from '@marble/domain';
import { useCompanyCurrency } from '@/lib/company-currency';
import finance from './finance.module.css';

export type DiscountDraft = {
  discountMode: DiscountMode;
  discountValue: string;
};

export const EMPTY_DISCOUNT: DiscountDraft = {
  discountMode: 'none',
  discountValue: '0',
};

const num = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function discountFromStored(
  mode?: string | null,
  value?: number | null,
): DiscountDraft {
  const discountMode = (mode as DiscountMode) ?? 'none';
  return {
    discountMode: discountMode === 'fixed' || discountMode === 'percent'
      ? discountMode
      : 'none',
    discountValue: String(value ?? 0),
  };
}

export function discountPayload(draft: DiscountDraft) {
  return {
    discountMode: draft.discountMode,
    discountValue: num(draft.discountValue),
  };
}

/** Reconstruct gross from stored denormalized totals for display/PDF. */
export function deriveLineGrossTotal(
  totals: Pick<TotalsBreakdown, 'subtotal' | 'lineDiscountTotal' | 'discount'>,
): number {
  return totals.subtotal + totals.lineDiscountTotal + totals.discount;
}

export function discountTotalsRows(
  totals: Pick<
    TotalsBreakdown,
    'lineGrossTotal' | 'lineDiscountTotal' | 'discount' | 'subtotal' | 'vatAmount'
  >,
  vatRate = UAE_VAT_RATE,
): Array<[string, number]> {
  const rows: Array<[string, number]> = [];
  const gross =
    totals.lineGrossTotal ??
    deriveLineGrossTotal({
      subtotal: totals.subtotal,
      lineDiscountTotal: totals.lineDiscountTotal,
      discount: totals.discount,
    });
  if (totals.lineDiscountTotal > 0) {
    rows.push(['Subtotal (before discounts)', gross]);
    rows.push(['Line discounts', totals.lineDiscountTotal]);
  }
  if (totals.discount > 0) {
    rows.push(['Document discount', totals.discount]);
  }
  rows.push(['Taxable amount', totals.subtotal]);
  rows.push([`VAT ${(vatRate * 100).toFixed(0)}%`, totals.vatAmount]);
  return rows;
}

export function LineDiscountControl({
  value,
  onChange,
  compact,
  showLabel = !compact,
}: {
  value: DiscountDraft;
  onChange: (next: DiscountDraft) => void;
  compact?: boolean;
  showLabel?: boolean;
}) {
  const currency = useCompanyCurrency();
  return (
    <div
      className={
        compact ? finance.lineDiscountRow : finance.lineDiscountRowBlock
      }
    >
      {showLabel ? <span className={finance.lineDiscountLabel}>Disc.</span> : null}
      <select
        className={finance.lineDiscountMode}
        value={value.discountMode}
        aria-label="Discount type"
        onChange={(event) =>
          onChange({
            ...value,
            discountMode: event.target.value as DiscountMode,
            discountValue:
              event.target.value === 'none' ? '0' : value.discountValue,
          })
        }
      >
        <option value="none">None</option>
        <option value="fixed">{currency}</option>
        <option value="percent">%</option>
      </select>
      {value.discountMode !== 'none' ? (
        <input
          className={finance.lineDiscountValue}
          type="number"
          min="0"
          step={value.discountMode === 'percent' ? '0.1' : '0.01'}
          max={value.discountMode === 'percent' ? '100' : undefined}
          value={value.discountValue}
          aria-label={
            value.discountMode === 'fixed' ? 'Discount amount' : 'Discount percent'
          }
          onChange={(event) =>
            onChange({ ...value, discountValue: event.target.value })
          }
        />
      ) : null}
    </div>
  );
}

export function DocumentDiscountFields({
  value,
  onChange,
  label = 'Document discount',
}: {
  value: DiscountDraft;
  onChange: (next: DiscountDraft) => void;
  label?: string;
}) {
  return (
    <div className={finance.documentDiscountRow}>
      <span className={finance.documentDiscountLabel}>{label}</span>
      <LineDiscountControl
        compact
        showLabel={false}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
