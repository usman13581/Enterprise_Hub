export function money(amount: number | null | undefined, currency = 'AED') {
  const value = Number(amount ?? 0);
  return `${currency} ${value.toLocaleString('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
};

export function label(value: string) {
  return (
    LABELS[value] ??
    value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
  );
}
