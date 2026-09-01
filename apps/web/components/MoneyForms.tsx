'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { PAYMENT_METHODS } from '@marble/types';
import { apiFetch, apiPost } from '@/lib/api';
import { day, label, money } from '@/lib/format';
import type { AvailableAdvance } from '@/lib/types';
import { SearchableSelect } from './SearchableSelect';
import { TotalsBlock } from './Finance';
import styles from './crud.module.css';
import finance from './finance.module.css';

const num = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Lets an operator mark which received advances settle this invoice. Allocation
 * moves no money — the cash was credited when the advance was recorded — so the
 * only limits are the advance's spare balance and the invoice total.
 */
export function AllocationPicker({
  customerId,
  jobId,
  invoiceTotal,
  value,
  onChange,
}: {
  customerId: string;
  jobId?: string | null;
  invoiceTotal: number;
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}) {
  const [advances, setAdvances] = useState<AvailableAdvance[]>([]);

  useEffect(() => {
    if (!customerId) return;
    const query = new URLSearchParams({ customerId });
    if (jobId) query.set('jobId', jobId);
    apiFetch<AvailableAdvance[]>(`/invoices/available-advances?${query}`)
      .then(setAdvances)
      .catch(() => setAdvances([]));
  }, [customerId, jobId]);

  const applied = useMemo(
    () => Object.values(value).reduce((total, raw) => total + num(raw), 0),
    [value],
  );

  if (advances.length === 0) {
    return (
      <p className={finance.panelNote}>
        No advances with a spare balance for this customer.
      </p>
    );
  }

  return (
    <div>
      {advances.map((advance) => (
        <div key={advance.id} className={finance.allocRow}>
          <span>
            <strong>{advance.number}</strong> · {day(advance.receivedAt)}
            {advance.job ? ` · job ${advance.job.number}` : ''}
          </span>
          <span className={styles.count}>
            {money(advance.unallocatedAmount)} available
          </span>
          <input
            className={`${styles.input} ${finance.allocAmount}`}
            type="number"
            min="0"
            max={advance.unallocatedAmount}
            step="0.01"
            placeholder="0.00"
            value={value[advance.id] ?? ''}
            onChange={(e) =>
              onChange({ ...value, [advance.id]: e.target.value })
            }
          />
        </div>
      ))}
      <p className={finance.panelNote}>
        Applying {money(applied)} against an invoice total of{' '}
        {money(invoiceTotal)}.
        {applied > invoiceTotal
          ? ' That is more than the invoice — the API will reject it.'
          : ''}
      </p>
    </div>
  );
}

export function allocationPayload(value: Record<string, string>) {
  return Object.entries(value)
    .map(([advanceId, raw]) => ({ advanceId, amount: num(raw) }))
    .filter((entry) => entry.amount > 0);
}

export function AdvanceForm({
  customerId,
  jobId,
  customers,
  onSaved,
  onError,
  onCancel,
}: {
  customerId?: string;
  jobId?: string | null;
  customers?: Array<{ id: string; name: string }>;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState({
    customerId: customerId ?? '',
    amount: '',
    method: 'cash',
    reference: '',
    receivedAt: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await apiPost('/advances', {
        customerId: draft.customerId,
        jobId: jobId ?? null,
        amount: num(draft.amount),
        method: draft.method,
        reference: draft.reference,
        receivedAt: draft.receivedAt || null,
        notes: draft.notes,
      });
      onSaved('Advance recorded');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <p className={styles.formTitle}>Record an advance</p>
      <div className={styles.grid}>
        {customers ? (
          <SearchableSelect
            label="Customer *"
            value={draft.customerId}
            onChange={(customerId) => setDraft({ ...draft, customerId })}
            required
            placeholder="Search customers…"
            options={customers.map((customer) => ({
              id: customer.id,
              label: customer.name,
            }))}
          />
        ) : null}
        <div className={styles.field}>
          <label className={styles.label}>Amount received *</label>
          <input
            className={styles.input}
            type="number"
            min="0.01"
            step="0.01"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Method</label>
          <select
            className={styles.select}
            value={draft.method}
            onChange={(e) => setDraft({ ...draft, method: e.target.value })}
          >
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {label(method)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Received on</label>
          <input
            className={styles.input}
            type="date"
            value={draft.receivedAt}
            onChange={(e) => setDraft({ ...draft, receivedAt: e.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Reference</label>
          <input
            className={styles.input}
            value={draft.reference}
            placeholder="Cheque or transfer reference"
            onChange={(e) => setDraft({ ...draft, reference: e.target.value })}
          />
        </div>
      </div>
      <div className={styles.field} style={{ marginTop: '0.9rem' }}>
        <label className={styles.label}>Notes</label>
        <textarea
          className={styles.textarea}
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </div>
      <div className={styles.actions}>
        <button className={styles.button} type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Record advance'}
        </button>
        <button className={styles.ghost} type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Raises a progressive, custom, or final invoice against a job. The operator
 * states a gross amount or a share of the job value; the API stores the line
 * net of VAT so the printed total matches what was asked for.
 */
export function JobInvoiceForm({
  jobId,
  customerId,
  kind,
  jobValue,
  balanceRemaining,
  onSaved,
  onError,
  onCancel,
}: {
  jobId: string;
  customerId: string;
  kind: 'progressive' | 'custom' | 'final';
  jobValue: number;
  balanceRemaining: number;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<'percentage' | 'amount'>('percentage');
  const [percentage, setPercentage] = useState('30');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const gross =
    kind === 'final'
      ? balanceRemaining
      : mode === 'percentage'
        ? (jobValue * num(percentage)) / 100
        : num(amount);

  const net = Math.round((gross / 1.05) * 100) / 100;
  const vat = Math.round((gross - net) * 100) / 100;
  const applied = allocationPayload(allocations).reduce(
    (total, entry) => total + entry.amount,
    0,
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);

    const path =
      kind === 'final'
        ? `/invoices/jobs/${jobId}/final`
        : `/invoices/jobs/${jobId}/${kind}`;

    try {
      await apiPost(path, {
        ...(kind === 'final'
          ? {}
          : mode === 'percentage'
            ? { percentage: num(percentage) }
            : { amount: num(amount) }),
        description: description || null,
        dueDate: dueDate || null,
        notes: notes || null,
        allocations: allocationPayload(allocations),
      });
      onSaved(
        kind === 'final' ? 'Final invoice issued' : 'Invoice issued',
      );
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not issue');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <p className={styles.formTitle}>
        {kind === 'final'
          ? 'Final invoice for the remaining balance'
          : kind === 'custom'
            ? 'Custom invoice against this job'
            : 'Progressive invoice'}
      </p>

      {kind === 'final' ? (
        <p className={finance.panelNote}>
          This bills the {money(balanceRemaining)} still un-invoiced on the job.
        </p>
      ) : (
        <>
          <div className={finance.filterBar}>
            <button
              type="button"
              className={
                mode === 'percentage' ? finance.tabActive : finance.tab
              }
              onClick={() => setMode('percentage')}
            >
              Share of job value
            </button>
            <button
              type="button"
              className={mode === 'amount' ? finance.tabActive : finance.tab}
              onClick={() => setMode('amount')}
            >
              Exact amount
            </button>
          </div>

          <div className={styles.grid} style={{ marginTop: '0.9rem' }}>
            {mode === 'percentage' ? (
              <div className={styles.field}>
                <label className={styles.label}>Percentage of job value</label>
                <input
                  className={styles.input}
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className={styles.field}>
                <label className={styles.label}>
                  Amount the customer pays (incl. VAT)
                </label>
                <input
                  className={styles.input}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
            )}
            <div className={styles.field}>
              <label className={styles.label}>Line description</label>
              <input
                className={styles.input}
                value={description}
                placeholder="Auto-generated if left blank"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Due date</label>
              <input
                className={styles.input}
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      <p className={finance.sectionTitle}>Adjust advances</p>
      <AllocationPicker
        customerId={customerId}
        jobId={jobId}
        invoiceTotal={gross}
        value={allocations}
        onChange={setAllocations}
      />

      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
        <TotalsBlock
          rows={[
            ['Taxable amount', net],
            ['VAT 5%', vat],
            ['Total', gross],
            ['Advance adjusted', -Math.min(applied, gross)],
          ]}
          grand={['Net payable', Math.max(0, gross - applied)]}
        />
      </div>

      <div className={styles.field} style={{ marginTop: '0.9rem' }}>
        <label className={styles.label}>Notes on the invoice</label>
        <textarea
          className={styles.textarea}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className={styles.actions}>
        <button className={styles.button} type="submit" disabled={saving}>
          {saving ? 'Issuing…' : 'Issue invoice'}
        </button>
        <button className={styles.ghost} type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
