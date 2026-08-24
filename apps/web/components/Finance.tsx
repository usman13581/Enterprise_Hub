'use client';

import Link from 'next/link';
import { useState } from 'react';
import { openPdf } from '@/lib/api';
import { balanceTone, day, label, money } from '@/lib/format';
import type { LedgerEntry } from '@/lib/types';
import page from '../app/page.module.css';
import crud from './crud.module.css';
import styles from './finance.module.css';

export function Stat({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: 'due' | 'credit' | 'clear';
}) {
  return (
    <div className={styles.stat}>
      <p className={styles.statLabel}>{title}</p>
      <p className={`${styles.statValue} ${tone ? styles[tone] : ''}`}>
        {value}
      </p>
      {hint ? <p className={styles.statHint}>{hint}</p> : null}
    </div>
  );
}

/** Colours a receivable by whether we are owed money or holding theirs. */
export function BalanceStat({
  title,
  amount,
  currency,
}: {
  title: string;
  amount: number;
  currency?: string;
}) {
  const tone = balanceTone(amount);
  const hint =
    tone === 'due'
      ? 'Owed to us'
      : tone === 'credit'
        ? 'Held on account for the customer'
        : 'Account is settled';

  return (
    <Stat
      title={title}
      value={money(Math.abs(amount), currency)}
      hint={hint}
      tone={tone}
    />
  );
}

const BADGE_CLASS: Record<string, string> = {
  draft: styles.badgeDraft,
  open: styles.badgeOpen,
  approved: styles.badgeDone,
  completed: styles.badgeDone,
  issued: styles.badgeDone,
  closed: styles.badgeDraft,
  cancelled: styles.badgeDanger,
  credit_note: styles.badgeDanger,
  progressive: styles.badgeOpen,
  custom: styles.badgeOpen,
  final: styles.badgeDone,
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={BADGE_CLASS[status] ?? styles.badge}>{label(status)}</span>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ key: T; label: string; count?: number }>;
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className={styles.tabs}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={tab.key === active ? styles.tabActive : styles.tab}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className={styles.tabCount}>{tab.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function FilterBar<T extends string>({
  options,
  active,
  onChange,
}: {
  options: Array<{ key: T; label: string }>;
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className={styles.filterBar}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          className={option.key === active ? styles.tabActive : styles.tab}
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function TotalsBlock({
  rows,
  grand,
  currency,
}: {
  rows: Array<[string, number]>;
  grand: [string, number];
  currency?: string;
}) {
  return (
    <div className={styles.totalsStack}>
      {rows.map(([rowLabel, value]) => (
        <div key={rowLabel} className={styles.totalsRow}>
          <span>{rowLabel}</span>
          <span className={styles.numericValue}>{money(value, currency)}</span>
        </div>
      ))}
      <div className={styles.totalsRowStrong}>
        <span>{grand[0]}</span>
        <span className={styles.numericValue}>{money(grand[1], currency)}</span>
      </div>
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className={styles.empty}>{children}</div>;
}

/** Keeps report tables aligned and scrollable on tablet / narrow viewports. */
export function TableScroll({ children }: { children: React.ReactNode }) {
  return <div className={styles.tableWrap}>{children}</div>;
}

/** Chronological statement with the running balance the ledger API computes. */
export function LedgerTable({ rows }: { rows: LedgerEntry[] }) {
  if (rows.length === 0) {
    return <EmptyState>Nothing has moved on this ledger yet.</EmptyState>;
  }

  return (
    <TableScroll>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Entry</th>
            <th>Memo</th>
            <th className={styles.numeric}>Debit</th>
            <th className={styles.numeric}>Credit</th>
            <th className={styles.numeric}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{day(row.occurredAt)}</td>
              <td>{label(row.entryType)}</td>
              <td>{row.memo ?? '—'}</td>
              <td className={styles.numeric}>
                {row.direction === 'debit' ? money(row.amount) : '—'}
              </td>
              <td className={styles.numeric}>
                {row.direction === 'credit' ? money(row.amount) : '—'}
              </td>
              <td className={styles.numeric}>{money(row.runningBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

export function BackLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${page.backNav} ${styles.backLink}`}>
      {children}
    </Link>
  );
}

export function PdfButton({
  path,
  onError,
  children = 'PDF',
}: {
  path: string;
  onError: (message: string) => void;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className={crud.ghost}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await openPdf(path);
        } catch (error) {
          onError(
            error instanceof Error ? error.message : 'Could not open the PDF',
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? '…' : children}
    </button>
  );
}

export function EditIconButton({
  onClick,
  label = 'Edit',
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={styles.editIcon}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </button>
  );
}

export function RowActionsBar({ children }: { children: React.ReactNode }) {
  return <div className={styles.rowActions}>{children}</div>;
}
