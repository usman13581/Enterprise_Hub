import { DEFAULT_CURRENCY } from '@marble/types';

let displayCurrency = DEFAULT_CURRENCY;

export function setDisplayCurrency(code: string | null | undefined) {
  const next = code?.trim().toUpperCase();
  displayCurrency = next && next.length === 3 ? next : DEFAULT_CURRENCY;
}

export function getDisplayCurrency() {
  return displayCurrency;
}

export function amount(value: number | null | undefined) {
  const parsed = Number(value ?? 0);
  return parsed.toLocaleString('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function moneyHeader(label: string, currency = getDisplayCurrency()) {
  return `${label} (${currency})`;
}

export function money(value: number | null | undefined, currency = getDisplayCurrency()) {
  return `${currency} ${amount(value)}`;
}

export function qty(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function day(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
}

const LABELS: Record<string, string> = {
  progressive: 'Progressive',
  custom: 'Custom',
  final: 'Final',
  credit_note: 'Credit note',
  bank_transfer: 'Bank transfer',
  invoice_issued: 'Invoice issued',
  invoice_cancelled: 'Invoice cancelled',
  advance_received: 'Advance received',
  advance_refunded: 'Advance refunded',
  credit_note_entry: 'Credit note',
};

export function label(value: string) {
  return (
    LABELS[value] ??
    value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
  );
}

/** Balances read as "owed to us" when positive and "held for them" when negative. */
export function balanceTone(balance: number): 'due' | 'credit' | 'clear' {
  if (balance > 0.004) return 'due';
  if (balance < -0.004) return 'credit';
  return 'clear';
}
