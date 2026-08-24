'use client';

import type { QuotationLookup } from '@marble/types';
import styles from '@/components/crud.module.css';

export type SpecItemDraft = { label: string; value: string; amount: string };

export function sumSpecItemAmounts(items: SpecItemDraft[]): number {
  return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

/** Item amounts drive the section total; fall back to stored section amount for legacy rows. */
export function sectionAmountFromItems(
  items: SpecItemDraft[],
  storedSectionAmount = 0,
): number {
  const itemSum = sumSpecItemAmounts(items);
  return itemSum > 0 ? itemSum : storedSectionAmount;
}

export function findSpecHint(
  specLabels: QuotationLookup[],
  label: string,
): string | null {
  const key = label.trim().toLowerCase();
  if (!key) return null;
  const row = specLabels.find((item) => item.title.trim().toLowerCase() === key);
  if (!row?.body || row.body === '—') return null;
  return row.body;
}

export function SpecItemRow({
  listId,
  item,
  specLabels,
  onLabelChange,
  onValueChange,
  onAmountChange,
  onRemove,
}: {
  listId: string;
  item: SpecItemDraft;
  specLabels: QuotationLookup[];
  onLabelChange: (label: string) => void;
  onValueChange: (value: string) => void;
  onAmountChange: (amount: string) => void;
  onRemove: () => void;
}) {
  function applyLabel(label: string) {
    onLabelChange(label);
    const hint = findSpecHint(specLabels, label);
    if (hint && !item.value.trim()) onValueChange(hint);
  }

  return (
    <div className={styles.grid} style={{ marginTop: 8 }}>
      <div className={styles.field}>
        <input
          className={styles.input}
          list={listId}
          placeholder="Type — pick from list or type new"
          value={item.label}
          onChange={(e) => onLabelChange(e.target.value)}
          onBlur={(e) => applyLabel(e.target.value)}
        />
        <datalist id={listId}>
          {specLabels.map((row) => (
            <option key={row.id} value={row.title}>
              {row.body !== '—' ? row.body : undefined}
            </option>
          ))}
        </datalist>
      </div>
      <div className={styles.field}>
        <input
          className={styles.input}
          placeholder="Value (e.g. 25 CM, Included)"
          value={item.value}
          onChange={(e) => onValueChange(e.target.value)}
        />
      </div>
      <div className={styles.field}>
        <input
          className={styles.input}
          inputMode="decimal"
          placeholder="Amount (AED)"
          value={item.amount}
          onChange={(e) => onAmountChange(e.target.value)}
        />
      </div>
      <div className={styles.field}>
        <button type="button" className={styles.ghost} onClick={onRemove}>
          Remove row
        </button>
      </div>
    </div>
  );
}

export function SpecLabelQuickPick({
  specLabels,
  onPick,
}: {
  specLabels: QuotationLookup[];
  onPick: (label: string, hint: string | null) => void;
}) {
  if (specLabels.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
      {specLabels.map((row) => (
        <button
          key={row.id}
          type="button"
          className={styles.ghost}
          style={{ fontSize: '0.82rem', padding: '0.35rem 0.65rem' }}
          onClick={() =>
            onPick(row.title, row.body !== '—' ? row.body : null)
          }
        >
          {row.title}
        </button>
      ))}
    </div>
  );
}
