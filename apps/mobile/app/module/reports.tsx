import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  INVOICE_REPORT_VIEWS,
  REPORT_NAV,
  type InvoiceReportView,
  type ReportKey,
} from '@marble/types';
import { apiFetch } from '../../lib/api';
import { money } from '../../lib/format';
import { usePolledList } from '../../lib/useCollection';
import { ScreenScroll } from '../../components/ScreenScroll';
import { PdfButton, StatCard } from '../../components/Finance';
import type { Customer, JobListItem } from '../../lib/types';
import { colors, ui } from '../../lib/ui';

type ReportColumn = {
  key: string;
  label: string;
  align?: 'left' | 'right';
  money?: boolean;
};

type ReportStat = {
  label: string;
  value: string | number;
  money?: boolean;
};

type ReportResult = {
  key: string;
  title: string;
  params: Record<string, string | null>;
  summary: ReportStat[];
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null>>;
  footerNote?: string | null;
};

type Selection =
  | { kind: 'finance'; key: ReportKey }
  | { kind: 'invoice'; key: InvoiceReportView }
  | null;

function monthBounds() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date();
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    asOf: to.toISOString().slice(0, 10),
  };
}

function buildQuery(params: Record<string, string>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

function paramsFor(selection: NonNullable<Selection>) {
  if (selection.kind === 'invoice') {
    const needsAsOf =
      selection.key === 'outstanding' || selection.key === 'overdue';
    return {
      from: true,
      to: true,
      asOf: needsAsOf,
      customerId: true,
      jobId: true,
      customerRequired: false,
      jobRequired: false,
    };
  }
  switch (selection.key) {
    case 'customer-statement':
      return {
        from: true,
        to: true,
        asOf: false,
        customerId: true,
        jobId: true,
        customerRequired: true,
        jobRequired: false,
      };
    case 'customer-balances':
    case 'aged-receivables':
    case 'unallocated-advances':
      return {
        from: false,
        to: false,
        asOf: true,
        customerId: true,
        jobId: false,
        customerRequired: false,
        jobRequired: false,
      };
    case 'job-costing':
      return {
        from: false,
        to: false,
        asOf: false,
        customerId: false,
        jobId: true,
        customerRequired: false,
        jobRequired: true,
      };
    case 'customer-margin':
    case 'allocation-rec':
      return {
        from: true,
        to: true,
        asOf: false,
        customerId: true,
        jobId: false,
        customerRequired: false,
        jobRequired: false,
      };
    case 'monthly-pnl':
      return {
        from: true,
        to: true,
        asOf: false,
        customerId: false,
        jobId: false,
        customerRequired: false,
        jobRequired: false,
      };
    case 'advances-register':
    case 'unbilled':
      return {
        from: selection.key === 'advances-register',
        to: selection.key === 'advances-register',
        asOf: selection.key === 'unbilled',
        customerId: true,
        jobId: true,
        customerRequired: false,
        jobRequired: false,
      };
    default:
      return {
        from: true,
        to: true,
        asOf: false,
        customerId: false,
        jobId: false,
        customerRequired: false,
        jobRequired: false,
      };
  }
}

export default function ReportsScreen() {
  const defaults = useMemo(() => monthBounds(), []);
  const [selection, setSelection] = useState<Selection>(null);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [asOf, setAsOf] = useState(defaults.asOf);
  const [customerId, setCustomerId] = useState('');
  const [jobId, setJobId] = useState('');
  const [result, setResult] = useState<ReportResult | null>(null);
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { items: customers } = usePolledList<Customer>('/customers', 30_000);
  const { items: jobs } = usePolledList<JobListItem>('/jobs', 30_000);

  const config = selection ? paramsFor(selection) : null;

  const apiBase = selection
    ? selection.kind === 'finance'
      ? `/reports/${selection.key}`
      : `/reports/invoices/${selection.key}`
    : null;

  const queryParams = useMemo(() => {
    if (!config) return {};
    const params: Record<string, string> = {};
    if (config.from) params.from = from;
    if (config.to) params.to = to;
    if (config.asOf) params.asOf = asOf;
    if (config.customerId && customerId) params.customerId = customerId;
    if (config.jobId && jobId) params.jobId = jobId;
    return params;
  }, [config, from, to, asOf, customerId, jobId]);

  const run = useCallback(async () => {
    if (!apiBase || !config) return;
    if (config.customerRequired && !queryParams.customerId) {
      setError('Select a customer');
      return;
    }
    if (config.jobRequired && !queryParams.jobId) {
      setError('Select a job');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ReportResult>(
        `${apiBase}${buildQuery(queryParams)}`,
      );
      setResult(data);
      setApplied(queryParams);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [apiBase, config, queryParams]);

  useEffect(() => {
    setResult(null);
    setApplied({});
    setError(null);
    if (!selection || !config) return;
    if (config.customerRequired || config.jobRequired) return;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when selection changes
  }, [selection]);

  if (!selection) {
    return (
      <View style={ui.screen}>
        <ScreenScroll>
          <Text style={ui.title}>Reports</Text>
          <Text style={ui.lede}>
            Finance and invoice views with summary, table, and Print PDF.
          </Text>

          <Text style={styles.section}>Finance</Text>
          {REPORT_NAV.map((report) => (
            <Pressable
              key={report.key}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() =>
                setSelection({ kind: 'finance', key: report.key })
              }
            >
              <Text style={styles.cardTitle}>{report.label}</Text>
              <Text style={styles.cardBody}>{report.description}</Text>
            </Pressable>
          ))}

          <Text style={styles.section}>Invoices</Text>
          {INVOICE_REPORT_VIEWS.map((view) => (
            <Pressable
              key={view.key}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() =>
                setSelection({ kind: 'invoice', key: view.key })
              }
            >
              <Text style={styles.cardTitle}>{view.label}</Text>
              <Text style={styles.cardBody}>{view.description}</Text>
            </Pressable>
          ))}
        </ScreenScroll>
      </View>
    );
  }

  const title =
    selection.kind === 'finance'
      ? REPORT_NAV.find((r) => r.key === selection.key)?.label ?? selection.key
      : INVOICE_REPORT_VIEWS.find((v) => v.key === selection.key)?.label ??
        selection.key;

  const pdfPath = apiBase
    ? `${apiBase}/pdf${buildQuery(applied)}`
    : '';

  return (
    <View style={ui.screen}>
      <ScreenScroll>
        <Pressable onPress={() => setSelection(null)}>
          <Text style={styles.back}>← All reports</Text>
        </Pressable>
        <Text style={ui.title}>{result?.title ?? title}</Text>
        <Text style={ui.lede}>
          Set parameters, run, then print the same numbers as PDF.
        </Text>

        {config?.from ? (
          <Field
            label="From (YYYY-MM-DD)"
            value={from}
            onChange={setFrom}
          />
        ) : null}
        {config?.to ? (
          <Field label="To (YYYY-MM-DD)" value={to} onChange={setTo} />
        ) : null}
        {config?.asOf ? (
          <Field
            label="As of (YYYY-MM-DD)"
            value={asOf}
            onChange={setAsOf}
          />
        ) : null}

        {config?.customerId ? (
          <Picker
            label={`Customer${config.customerRequired ? ' *' : ''}`}
            value={customerId}
            options={[
              {
                id: '',
                label: config.customerRequired ? 'Select…' : 'All customers',
              },
              ...customers.map((c) => ({ id: c.id, label: c.name })),
            ]}
            onChange={setCustomerId}
          />
        ) : null}

        {config?.jobId ? (
          <Picker
            label={`Job${config.jobRequired ? ' *' : ''}`}
            value={jobId}
            options={[
              {
                id: '',
                label: config.jobRequired ? 'Select…' : 'All jobs',
              },
              ...jobs
                .filter((j) => !customerId || j.customerId === customerId)
                .map((j) => ({
                  id: j.id,
                  label: `${j.number}${j.customer?.name ? ` — ${j.customer.name}` : ''}`,
                })),
            ]}
            onChange={setJobId}
          />
        ) : null}

        <View style={styles.actions}>
          <Pressable
            style={[styles.runBtn, loading && styles.disabled]}
            disabled={loading}
            onPress={() => void run()}
          >
            <Text style={styles.runLabel}>
              {loading ? 'Loading…' : 'Run'}
            </Text>
          </Pressable>
          {result && pdfPath ? (
            <PdfButton path={pdfPath} onError={setError} label="Print PDF" />
          ) : null}
        </View>

        {error ? <Text style={ui.error}>{error}</Text> : null}

        {loading && !result ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
        ) : null}

        {result ? (
          <>
            <View style={styles.stats}>
              {result.summary.map((stat) => (
                <StatCard
                  key={stat.label}
                  title={stat.label}
                  value={
                    typeof stat.value === 'number' && stat.money
                      ? money(stat.value)
                      : String(stat.value)
                  }
                />
              ))}
            </View>

            {result.rows.length === 0 ? (
              <View style={ui.empty}>
                <Text style={ui.emptyText}>No rows for these parameters.</Text>
              </View>
            ) : (
              result.rows.map((row, index) => (
                <View key={index} style={styles.rowCard}>
                  {result.columns.map((col) => {
                    const raw = row[col.key];
                    const display =
                      col.money && typeof raw === 'number'
                        ? money(raw)
                        : raw == null || raw === ''
                          ? '—'
                          : String(raw);
                    return (
                      <View key={col.key} style={styles.rowLine}>
                        <Text style={styles.rowLabel}>{col.label}</Text>
                        <Text style={styles.rowValue}>{display}</Text>
                      </View>
                    );
                  })}
                </View>
              ))
            )}

            {result.footerNote ? (
              <Text style={styles.footer}>{result.footerNote}</Text>
            ) : null}
          </>
        ) : null}
      </ScreenScroll>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

function Picker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.slice(0, 12).map((option) => (
          <Pressable
            key={option.id || 'all'}
            style={[
              styles.chip,
              value === option.id && styles.chipActive,
            ]}
            onPress={() => onChange(option.id)}
          >
            <Text
              style={[
                styles.chipText,
                value === option.id && styles.chipTextActive,
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = {
  section: {
    marginTop: 18,
    marginBottom: 8,
    color: colors.soft,
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 8,
  },
  pressed: { opacity: 0.85 },
  cardTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  cardBody: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  back: {
    color: colors.accent,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  field: { marginTop: 12 },
  fieldLabel: {
    color: colors.soft,
    fontSize: 11,
    fontWeight: '600' as const,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  chipWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    maxWidth: '100%' as const,
  },
  chipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipText: { color: colors.muted, fontSize: 13, maxWidth: 220 },
  chipTextActive: { color: colors.accent, fontWeight: '600' as const },
  actions: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 14,
    alignItems: 'center' as const,
  },
  runBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  runLabel: { color: '#fff', fontWeight: '600' as const },
  disabled: { opacity: 0.55 },
  stats: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 8,
  },
  rowCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  rowLine: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    gap: 10,
    paddingVertical: 3,
  },
  rowLabel: { color: colors.soft, fontSize: 12, flex: 1 },
  rowValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '500' as const,
    flexShrink: 1,
    textAlign: 'right' as const,
  },
  footer: {
    marginTop: 12,
    marginBottom: 24,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
};
