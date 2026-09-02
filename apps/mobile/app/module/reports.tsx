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
  countVisibleReports,
  groupCustomerLedgerReports,
  groupInvoiceReports,
  groupJobsReports,
  groupOtherFinanceReports,
  groupSupplierLedgerReports,
  type InvoiceReportView,
  type ReportKey,
} from '@marble/types';
import { apiFetch } from '../../lib/api';
import { isoDate, todayIso } from '../../lib/dates';
import { money } from '../../lib/format';
import {
  searchItems,
  usePagination,
  usePolledList,
} from '../../lib/useCollection';
import { ScreenScroll } from '../../components/ScreenScroll';
import { Pagination, SearchBox } from '../../components/ListControls';
import { FormPicker } from '../../components/FormField';
import { PdfButton, StatCard } from '../../components/Finance';
import { SearchablePicker } from '../../components/SearchablePicker';
import type { Customer, JobListItem, Supplier } from '../../lib/types';
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

type Scope =
  | 'all'
  | 'customer-ledgers'
  | 'supplier-ledgers'
  | 'jobs'
  | 'invoices';

function monthBounds() {
  const now = new Date();
  return {
    from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: todayIso(),
    asOf: todayIso(),
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
      supplierId: true,
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
    case 'supplier-product-register':
    case 'supplier-cost-summary':
      return { from: false, to: false, asOf: false, customerId: false, jobId: false, supplierId: true, customerRequired: false, jobRequired: false };
    case 'supplier-quotation-usage':
    case 'supplier-job-costing':
    case 'supplier-statement':
    case 'purchase-invoice-register':
    case 'supplier-payment-register':
    case 'lpo-register':
    case 'supplier-spend':
    case 'supplier-price-history':
    case 'input-vat-summary':
      return { from: true, to: true, asOf: false, customerId: false, jobId: false, supplierId: true, customerRequired: false, jobRequired: false };
    case 'aged-payables':
      return { from: false, to: false, asOf: true, customerId: false, jobId: false, supplierId: true, customerRequired: false, jobRequired: false };
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
  const [supplierId, setSupplierId] = useState('');
  const [result, setResult] = useState<ReportResult | null>(null);
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rowQuery, setRowQuery] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');

  const customerGroups = useMemo(
    () => groupCustomerLedgerReports(catalogQuery),
    [catalogQuery],
  );
  const supplierGroups = useMemo(
    () => groupSupplierLedgerReports(catalogQuery),
    [catalogQuery],
  );
  const jobsGroups = useMemo(
    () => groupJobsReports(catalogQuery),
    [catalogQuery],
  );
  const otherGroups = useMemo(
    () => groupOtherFinanceReports(catalogQuery),
    [catalogQuery],
  );
  const invoiceGroups = useMemo(
    () => groupInvoiceReports(catalogQuery),
    [catalogQuery],
  );
  const catalogCounts = useMemo(
    () => countVisibleReports(catalogQuery),
    [catalogQuery],
  );
  const { items: customers } = usePolledList<Customer>('/customers', 30_000);
  const { items: jobs } = usePolledList<JobListItem>('/jobs', 30_000);
  const { items: suppliers } = usePolledList<Supplier>('/suppliers', 30_000);
  const reportRows = result?.rows ?? [];
  const filteredRows = searchItems(reportRows, rowQuery);
  const rowPager = usePagination(filteredRows, rowQuery);

  const config = selection ? paramsFor(selection) : null;
  const showCustomer =
    scope === 'all' || scope === 'customer-ledgers';
  const showSupplier =
    scope === 'all' || scope === 'supplier-ledgers';
  const showJobs = scope === 'all' || scope === 'jobs';
  const showOther = scope === 'all';
  const showInvoices = scope === 'all' || scope === 'invoices';
  const catalogEmpty =
    (showCustomer ? customerGroups.length : 0) +
      (showSupplier ? supplierGroups.length : 0) +
      (showJobs ? jobsGroups.length : 0) +
      (showOther ? otherGroups.length : 0) +
      (showInvoices ? invoiceGroups.length : 0) ===
    0;

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
    if (config.supplierId && supplierId) params.supplierId = supplierId;
    return params;
  }, [config, from, to, asOf, customerId, jobId, supplierId]);

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
      setRowQuery('');
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

          <SearchBox
            value={catalogQuery}
            onChange={setCatalogQuery}
            placeholder="Search reports…"
          />
          <Text style={styles.meta}>
            {catalogCounts.total} reports · {catalogCounts.finance} finance ·{' '}
            {catalogCounts.invoices} invoice views
          </Text>

          <View style={styles.scopeRow}>
            {(
              [
                ['all', 'All'],
                ['customer-ledgers', 'Customer ledgers'],
                ['supplier-ledgers', 'Supplier ledgers'],
                ['jobs', 'Jobs'],
                ['invoices', 'Invoices'],
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                style={[
                  styles.scopeChip,
                  scope === key && styles.scopeChipActive,
                ]}
                onPress={() => setScope(key)}
              >
                <Text
                  style={[
                    styles.scopeChipText,
                    scope === key && styles.scopeChipTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {catalogEmpty ? (
            <View style={ui.empty}>
              <Text style={ui.emptyText}>No reports match your search.</Text>
            </View>
          ) : null}

          {showCustomer && customerGroups.length > 0 ? (
            <>
              <Text style={styles.pillar}>Customer ledgers</Text>
              {customerGroups.map((group) => (
                <View key={group.key} style={styles.groupPanel}>
                  <View style={styles.groupHead}>
                    <Text style={styles.groupTitle}>{group.label}</Text>
                    <Text style={styles.groupHint}>{group.hint}</Text>
                    <Text style={styles.groupCount}>
                      {group.reports.length} report
                      {group.reports.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  {group.reports.map((report) => (
                    <Pressable
                      key={report.key}
                      style={({ pressed }) => [
                        styles.reportRow,
                        pressed && styles.pressed,
                      ]}
                      onPress={() =>
                        setSelection({ kind: 'finance', key: report.key })
                      }
                    >
                      <View style={styles.reportText}>
                        <Text style={styles.reportTitle}>{report.label}</Text>
                        <Text style={styles.reportBody} numberOfLines={2}>
                          {report.description}
                        </Text>
                      </View>
                      <Text style={styles.reportArrow}>→</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </>
          ) : null}

          {showSupplier && supplierGroups.length > 0 ? (
            <>
              <Text style={styles.pillar}>Supplier ledgers</Text>
              {supplierGroups.map((group) => (
                <View key={group.key} style={styles.groupPanel}>
                  <View style={styles.groupHead}>
                    <Text style={styles.groupTitle}>{group.label}</Text>
                    <Text style={styles.groupHint}>{group.hint}</Text>
                    <Text style={styles.groupCount}>
                      {group.reports.length} report
                      {group.reports.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  {group.reports.map((report) => (
                    <Pressable
                      key={report.key}
                      style={({ pressed }) => [
                        styles.reportRow,
                        pressed && styles.pressed,
                      ]}
                      onPress={() =>
                        setSelection({ kind: 'finance', key: report.key })
                      }
                    >
                      <View style={styles.reportText}>
                        <Text style={styles.reportTitle}>{report.label}</Text>
                        <Text style={styles.reportBody} numberOfLines={2}>
                          {report.description}
                        </Text>
                      </View>
                      <Text style={styles.reportArrow}>→</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </>
          ) : null}

          {showJobs && jobsGroups.length > 0 ? (
            <>
              <Text style={styles.pillar}>Jobs & billing</Text>
              {jobsGroups.map((group) => (
                <View key={group.key} style={styles.groupPanel}>
                  <View style={styles.groupHead}>
                    <Text style={styles.groupTitle}>{group.label}</Text>
                    <Text style={styles.groupHint}>{group.hint}</Text>
                    <Text style={styles.groupCount}>
                      {group.reports.length} report
                      {group.reports.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  {group.reports.map((report) => (
                    <Pressable
                      key={report.key}
                      style={({ pressed }) => [
                        styles.reportRow,
                        pressed && styles.pressed,
                      ]}
                      onPress={() =>
                        setSelection({ kind: 'finance', key: report.key })
                      }
                    >
                      <View style={styles.reportText}>
                        <Text style={styles.reportTitle}>{report.label}</Text>
                        <Text style={styles.reportBody} numberOfLines={2}>
                          {report.description}
                        </Text>
                      </View>
                      <Text style={styles.reportArrow}>→</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </>
          ) : null}

          {showOther && otherGroups.length > 0 ? (
            <>
              <Text style={styles.pillar}>Catalog & tax</Text>
              {otherGroups.map((group) => (
                <View key={group.key} style={styles.groupPanel}>
                  <View style={styles.groupHead}>
                    <Text style={styles.groupTitle}>{group.label}</Text>
                    <Text style={styles.groupHint}>{group.hint}</Text>
                    <Text style={styles.groupCount}>
                      {group.reports.length} report
                      {group.reports.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  {group.reports.map((report) => (
                    <Pressable
                      key={report.key}
                      style={({ pressed }) => [
                        styles.reportRow,
                        pressed && styles.pressed,
                      ]}
                      onPress={() =>
                        setSelection({ kind: 'finance', key: report.key })
                      }
                    >
                      <View style={styles.reportText}>
                        <Text style={styles.reportTitle}>{report.label}</Text>
                        <Text style={styles.reportBody} numberOfLines={2}>
                          {report.description}
                        </Text>
                      </View>
                      <Text style={styles.reportArrow}>→</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </>
          ) : null}

          {showInvoices && invoiceGroups.length > 0 ? (
            <>
              <Text style={styles.pillar}>Invoices</Text>
              {invoiceGroups.map((group) => (
                <View key={group.key} style={styles.groupPanel}>
                  <View style={styles.groupHead}>
                    <Text style={styles.groupTitle}>{group.label}</Text>
                    <Text style={styles.groupHint}>{group.hint}</Text>
                    <Text style={styles.groupCount}>
                      {group.reports.length} view
                      {group.reports.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  {group.reports.map((view) => (
                    <Pressable
                      key={view.key}
                      style={({ pressed }) => [
                        styles.reportRow,
                        pressed && styles.pressed,
                      ]}
                      onPress={() =>
                        setSelection({ kind: 'invoice', key: view.key })
                      }
                    >
                      <View style={styles.reportText}>
                        <Text style={styles.reportTitle}>{view.label}</Text>
                        <Text style={styles.reportBody} numberOfLines={2}>
                          {view.description}
                        </Text>
                      </View>
                      <Text style={styles.reportArrow}>→</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </>
          ) : null}
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
          <FormPicker
            label={`Customer${config.customerRequired ? ' *' : ''}`}
            first={!config?.from && !config?.to && !config?.asOf}
          >
            <SearchablePicker
              value={customerId}
              allowEmpty={!config.customerRequired}
              emptyLabel={
                config.customerRequired ? 'Select customer…' : 'All customers'
              }
              options={customers.map((c) => ({ id: c.id, label: c.name }))}
              searchPlaceholder="Search customers…"
              emptyText="No customers match your search."
              onChange={setCustomerId}
            />
          </FormPicker>
        ) : null}

        {config?.jobId ? (
          <FormPicker label={`Job${config.jobRequired ? ' *' : ''}`}>
            <SearchablePicker
              value={jobId}
              allowEmpty={!config.jobRequired}
              emptyLabel={config.jobRequired ? 'Select job…' : 'All jobs'}
              options={jobs
                .filter((j) => !customerId || j.customerId === customerId)
                .map((j) => ({
                  id: j.id,
                  label: `${j.number}${j.customer?.name ? ` — ${j.customer.name}` : ''}`,
                }))}
              searchPlaceholder="Search jobs…"
              emptyText="No jobs match your search."
              onChange={setJobId}
            />
          </FormPicker>
        ) : null}

        {config?.supplierId ? (
          <FormPicker label="Supplier">
            <SearchablePicker
              value={supplierId}
              allowEmpty
              emptyLabel="All suppliers"
              options={suppliers.map((supplier) => ({
                id: supplier.id,
                label: supplier.name,
              }))}
              searchPlaceholder="Search suppliers…"
              emptyText="No suppliers match your search."
              onChange={setSupplierId}
            />
          </FormPicker>
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

            {result.rows.length > 0 ? (
              <SearchBox
                value={rowQuery}
                onChange={setRowQuery}
                placeholder="Search report rows…"
              />
            ) : null}

            {result.rows.length === 0 ? (
              <View style={ui.empty}>
                <Text style={ui.emptyText}>No rows for these parameters.</Text>
              </View>
            ) : filteredRows.length === 0 ? (
              <View style={ui.empty}>
                <Text style={ui.emptyText}>
                  No report rows match your search.
                </Text>
              </View>
            ) : (
              rowPager.paged.map((row, index) => (
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

            {result.rows.length > 0 && filteredRows.length > 0 ? (
              <Pagination
                page={rowPager.page}
                setPage={rowPager.setPage}
                pageSize={rowPager.pageSize}
                setPageSize={rowPager.setPageSize}
                pageCount={rowPager.pageCount}
                total={rowPager.total}
              />
            ) : null}

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

const styles = {
  meta: {
    marginTop: 8,
    marginBottom: 10,
    color: colors.soft,
    fontSize: 12,
  },
  scopeRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 12,
  },
  scopeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  scopeChipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  scopeChipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  scopeChipTextActive: {
    color: colors.accent,
  },
  pillar: {
    marginTop: 18,
    marginBottom: 8,
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700' as const,
  },
  groupPanel: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 10,
    overflow: 'hidden' as const,
  },
  groupHead: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.bg,
  },
  groupTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  groupHint: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  groupCount: {
    marginTop: 4,
    color: colors.accent,
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  reportRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  reportText: {
    flex: 1,
  },
  reportTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  reportBody: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  reportArrow: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600' as const,
  },
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
