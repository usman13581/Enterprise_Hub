import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { computeInvoiceTotals } from '@marble/domain';
import { PAYMENT_METHODS } from '@marble/types';
import { apiFetch, apiPost } from '../lib/api';
import { day, label, money } from '../lib/format';
import type { AvailableAdvance, Invoice } from '../lib/types';
import { colors, ui } from '../lib/ui';
import { FormPicker } from './FormField';
import { SearchablePicker } from './SearchablePicker';
import { ActionButton, FilterChips, RowActions } from './Finance';

const num = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export type InvoiceLineDraft = {
  description: string;
  unit: string;
  qty: string;
  unitPrice: string;
  purchasePrice: string;
};

export const EMPTY_INVOICE_LINE: InvoiceLineDraft = {
  description: '',
  unit: 'sqm',
  qty: '1',
  unitPrice: '0',
  purchasePrice: '0',
};

export function invoiceLinePayload(lines: InvoiceLineDraft[]) {
  return lines.map((line) => ({
    description: line.description.trim(),
    unit: line.unit.trim() || 'sqm',
    qty: num(line.qty),
    unitPrice: num(line.unitPrice),
    purchasePrice: num(line.purchasePrice),
  }));
}

export function allocationPayload(value: Record<string, string>) {
  return Object.entries(value)
    .map(([advanceId, raw]) => ({ advanceId, amount: num(raw) }))
    .filter((entry) => entry.amount > 0);
}

export function ChipSelect<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.picker}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            style={[styles.option, selected && styles.optionActive]}
            onPress={() => onChange(option.key)}
          >
            <Text
              style={[styles.optionText, selected && styles.optionTextActive]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Marks which received advances settle this invoice. Allocation moves no cash. */
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
    if (!customerId) {
      setAdvances([]);
      return;
    }
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

  if (!customerId) return null;
  if (advances.length === 0) {
    return (
      <Text style={ui.cardMeta}>
        No advances with a spare balance for this customer.
      </Text>
    );
  }

  return (
    <View>
      <Text style={ui.label}>Adjust advances</Text>
      {advances.map((advance) => (
        <View key={advance.id} style={styles.allocRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.allocTitle}>{advance.number}</Text>
            <Text style={ui.cardMeta}>
              {day(advance.receivedAt)}
              {advance.job ? ` · job ${advance.job.number}` : ''}
              {' · '}
              {money(advance.unallocatedAmount)} available
            </Text>
          </View>
          <TextInput
            style={[ui.input, styles.allocInput]}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.soft}
            value={value[advance.id] ?? ''}
            onChangeText={(raw) => onChange({ ...value, [advance.id]: raw })}
          />
        </View>
      ))}
      <Text style={ui.cardMeta}>
        Applying {money(applied)} against {money(invoiceTotal)}.
      </Text>
    </View>
  );
}

export function InvoiceLineEditor({
  lines,
  onChange,
}: {
  lines: InvoiceLineDraft[];
  onChange: (lines: InvoiceLineDraft[]) => void;
}) {
  const totals = computeInvoiceTotals(invoiceLinePayload(lines));

  function patch(index: number, changes: Partial<InvoiceLineDraft>) {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...changes } : line)));
  }

  return (
    <View>
      {lines.map((line, index) => (
        <View key={index} style={styles.lineBox}>
          <Text style={ui.label}>Line {index + 1}</Text>
          <TextInput
            style={ui.input}
            value={line.description}
            onChangeText={(description) => patch(index, { description })}
            placeholder="Description"
            placeholderTextColor={colors.soft}
          />
          <View style={styles.row}>
            <TextInput
              style={[ui.input, styles.half]}
              value={line.qty}
              onChangeText={(qty) => patch(index, { qty })}
              keyboardType="decimal-pad"
              placeholder="Qty"
              placeholderTextColor={colors.soft}
            />
            <TextInput
              style={[ui.input, styles.half]}
              value={line.unit}
              onChangeText={(unit) => patch(index, { unit })}
              placeholder="Unit"
              placeholderTextColor={colors.soft}
            />
          </View>
          <View style={styles.row}>
            <TextInput
              style={[ui.input, styles.half]}
              value={line.unitPrice}
              onChangeText={(unitPrice) => patch(index, { unitPrice })}
              keyboardType="decimal-pad"
              placeholder="Sell (ex VAT)"
              placeholderTextColor={colors.soft}
            />
            <TextInput
              style={[ui.input, styles.half]}
              value={line.purchasePrice}
              onChangeText={(purchasePrice) => patch(index, { purchasePrice })}
              keyboardType="decimal-pad"
              placeholder="Purchase"
              placeholderTextColor={colors.soft}
            />
          </View>
          <Text style={ui.cardMeta}>
            Line total {money(totals.lineTotals[index] ?? 0)}
          </Text>
          {lines.length > 1 ? (
            <Pressable
              onPress={() => onChange(lines.filter((_, i) => i !== index))}
            >
              <Text style={[ui.ghostText, ui.dangerText]}>Remove line</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      <Pressable
        style={[ui.ghost, { marginTop: 12, alignSelf: 'flex-start' }]}
        onPress={() => onChange([...lines, { ...EMPTY_INVOICE_LINE }])}
      >
        <Text style={ui.ghostText}>+ Add line</Text>
      </Pressable>
      <Text style={[ui.cardMeta, { marginTop: 12 }]}>
        Subtotal {money(totals.subtotal)} · VAT {money(totals.vatAmount)} ·
        Total {money(totals.total)}
      </Text>
    </View>
  );
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

  async function submit() {
    if (saving || !draft.customerId) return;
    setSaving(true);
    try {
      await apiPost('/advances', {
        customerId: draft.customerId,
        jobId: jobId ?? null,
        amount: num(draft.amount),
        method: draft.method,
        reference: draft.reference || null,
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
    <View style={ui.card}>
      <Text style={ui.cardTitle}>Record an advance</Text>
      {customers ? (
        <FormPicker label="Customer *">
          <SearchablePicker
            value={draft.customerId}
            options={customers.map((customer) => ({
              id: customer.id,
              label: customer.name,
            }))}
            searchPlaceholder="Search customers…"
            emptyText="No customers match your search."
            onChange={(id) => setDraft({ ...draft, customerId: id })}
          />
        </FormPicker>
      ) : null}
      <Text style={ui.label}>Amount received *</Text>
      <TextInput
        style={ui.input}
        value={draft.amount}
        onChangeText={(amount) => setDraft({ ...draft, amount })}
        keyboardType="decimal-pad"
      />
      <Text style={ui.label}>Method</Text>
      <ChipSelect
        value={draft.method}
        onChange={(method) => setDraft({ ...draft, method })}
        options={PAYMENT_METHODS.map((method) => ({
          key: method,
          label: label(method),
        }))}
      />
      <Text style={ui.label}>Received on (YYYY-MM-DD)</Text>
      <TextInput
        style={ui.input}
        value={draft.receivedAt}
        onChangeText={(receivedAt) => setDraft({ ...draft, receivedAt })}
        placeholder="2026-08-18"
        placeholderTextColor={colors.soft}
      />
      <Text style={ui.label}>Reference</Text>
      <TextInput
        style={ui.input}
        value={draft.reference}
        onChangeText={(reference) => setDraft({ ...draft, reference })}
        placeholder="Cheque or transfer reference"
        placeholderTextColor={colors.soft}
      />
      <Text style={ui.label}>Notes</Text>
      <TextInput
        style={ui.input}
        value={draft.notes}
        onChangeText={(notes) => setDraft({ ...draft, notes })}
        multiline
      />
      <RowActions>
        <ActionButton
          label={saving ? 'Saving…' : 'Record advance'}
          tone="primary"
          disabled={saving}
          onPress={() => void submit()}
        />
        <ActionButton label="Cancel" onPress={onCancel} />
      </RowActions>
    </View>
  );
}

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

  async function submit() {
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
      onSaved(kind === 'final' ? 'Final invoice issued' : 'Invoice issued');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not issue');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={ui.card}>
      <Text style={ui.cardTitle}>
        {kind === 'final'
          ? 'Final invoice for the remaining balance'
          : kind === 'custom'
            ? 'Custom invoice against this job'
            : 'Progressive invoice'}
      </Text>
      {kind === 'final' ? (
        <Text style={ui.cardMeta}>
          This bills the {money(balanceRemaining)} still un-invoiced on the job.
        </Text>
      ) : (
        <>
          <FilterChips
            active={mode}
            onChange={setMode}
            options={[
              { key: 'percentage', label: 'Share of job value' },
              { key: 'amount', label: 'Exact amount' },
            ]}
          />
          {mode === 'percentage' ? (
            <>
              <Text style={ui.label}>Percentage of job value</Text>
              <TextInput
                style={ui.input}
                value={percentage}
                onChangeText={setPercentage}
                keyboardType="decimal-pad"
              />
            </>
          ) : (
            <>
              <Text style={ui.label}>Amount the customer pays (incl. VAT)</Text>
              <TextInput
                style={ui.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
            </>
          )}
          <Text style={ui.label}>Line description</Text>
          <TextInput
            style={ui.input}
            value={description}
            onChangeText={setDescription}
            placeholder="Auto-generated if left blank"
            placeholderTextColor={colors.soft}
          />
          <Text style={ui.label}>Due date (YYYY-MM-DD)</Text>
          <TextInput
            style={ui.input}
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="Optional"
            placeholderTextColor={colors.soft}
          />
        </>
      )}

      <AllocationPicker
        customerId={customerId}
        jobId={jobId}
        invoiceTotal={gross}
        value={allocations}
        onChange={setAllocations}
      />
      <Text style={[ui.cardMeta, { marginTop: 8 }]}>
        Taxable {money(net)} · VAT {money(vat)} · Total {money(gross)} · Net
        payable {money(Math.max(0, gross - applied))}
      </Text>
      <Text style={ui.label}>Notes on the invoice</Text>
      <TextInput
        style={ui.input}
        value={notes}
        onChangeText={setNotes}
        multiline
      />
      <RowActions>
        <ActionButton
          label={saving ? 'Issuing…' : 'Issue invoice'}
          tone="primary"
          disabled={saving}
          onPress={() => void submit()}
        />
        <ActionButton label="Cancel" onPress={onCancel} />
      </RowActions>
    </View>
  );
}

export function CreditNoteForm({
  invoice,
  onSaved,
  onError,
  onCancel,
}: {
  invoice: Invoice;
  onSaved: () => void | Promise<void>;
  onError: (message: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<InvoiceLineDraft[]>(
    invoice.lines.length
      ? invoice.lines.map((line) => ({
          description: line.description,
          unit: line.unit,
          qty: String(line.qty),
          unitPrice: String(line.unitPrice),
          purchasePrice: String(line.purchasePrice),
        }))
      : [{ ...EMPTY_INVOICE_LINE }],
  );
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (saving || !reason.trim()) return;
    setSaving(true);
    try {
      await apiPost('/invoices/credit-notes', {
        invoiceId: invoice.id,
        reason,
        lines: invoiceLinePayload(lines),
      });
      await onSaved();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not credit');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={ui.card}>
      <Text style={ui.cardTitle}>Credit note against {invoice.number}</Text>
      <Text style={ui.cardMeta}>
        The original invoice stays on the ledger. This cannot exceed the{' '}
        {money(invoice.total)} originally billed.
      </Text>
      <Text style={ui.label}>Reason *</Text>
      <TextInput
        style={ui.input}
        value={reason}
        onChangeText={setReason}
        placeholder="Material returned, rework agreed…"
        placeholderTextColor={colors.soft}
      />
      <InvoiceLineEditor lines={lines} onChange={setLines} />
      <RowActions>
        <ActionButton
          label={saving ? 'Issuing…' : 'Issue credit note'}
          tone="primary"
          disabled={saving}
          onPress={() => void submit()}
        />
        <ActionButton label="Cancel" onPress={onCancel} />
      </RowActions>
    </View>
  );
}

const styles = {
  picker: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 6,
  },
  option: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(20,32,43,0.14)',
    backgroundColor: colors.surface,
  },
  optionActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  optionText: { color: colors.muted, fontSize: 13 },
  optionTextActive: { color: colors.accent, fontWeight: '700' as const },
  allocRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginTop: 8,
  },
  allocTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' as const },
  allocInput: { width: 90, marginTop: 0 },
  lineBox: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  row: { flexDirection: 'row' as const, gap: 8, marginTop: 8 },
  half: { flex: 1 },
};
