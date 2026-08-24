import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiPost } from '../../lib/api';
import { day, label, money } from '../../lib/format';
import {
  searchItems,
  useFlash,
  usePagination,
  usePolledItem,
  usePolledList,
} from '../../lib/useCollection';
import { Pagination, SearchBox, Toast } from '../../components/ListControls';
import { ScreenScroll } from '../../components/ScreenScroll';
import {
  ActionButton,
  BackLink,
  BalanceCard,
  FilterChips,
  LinkAction,
  RecordRow,
  RowActions,
  StatCard,
  StatusPill,
} from '../../components/Finance';
import { AdvanceForm, JobInvoiceForm } from '../../components/MoneyForms';
import type { JobHub, JobListItem } from '../../lib/types';
import { colors, ui } from '../../lib/ui';

type Filter = 'all' | 'open' | 'completed' | 'closed';
type Panel = 'progressive' | 'custom' | 'final' | 'advance' | null;
type Tab = 'invoices' | 'advances' | 'ledger' | 'quotation';

export default function JobsScreen() {
  const { items, loading, error } = usePolledList<JobListItem>('/jobs');
  const params = useLocalSearchParams<{ open?: string }>();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(
    typeof params.open === 'string' && params.open ? params.open : null,
  );

  useEffect(() => {
    if (typeof params.open === 'string' && params.open) {
      setSelectedId(params.open);
    }
  }, [params.open]);

  const filtered = useMemo(() => {
    const byStatus =
      filter === 'all' ? items : items.filter((item) => item.status === filter);
    return searchItems(byStatus, query);
  }, [items, filter, query]);
  const pager = usePagination(filtered);

  if (selectedId) {
    return (
      <JobHubScreen
        jobId={selectedId}
        onBack={() => {
          setSelectedId(null);
          if (params.open) router.setParams({ open: '' });
        }}
      />
    );
  }

  if (loading && items.length === 0) {
    return (
      <View style={[ui.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={ui.screen}>
      <ScreenScroll>
        <Text style={ui.title}>Jobs</Text>
        <Text style={ui.lede}>
          Open a job to invoice it, record advances, and see its ledger.
        </Text>
        {error ? <Text style={ui.error}>{error}</Text> : null}

        <FilterChips
          active={filter}
          onChange={setFilter}
          options={[
            { key: 'all', label: 'All' },
            { key: 'open', label: 'Open' },
            { key: 'completed', label: 'Completed' },
            { key: 'closed', label: 'Closed' },
          ]}
        />

        <SearchBox value={query} onChange={setQuery} placeholder="Search jobs…" />

        {filtered.length === 0 ? (
          <View style={ui.empty}>
            <Text style={ui.emptyText}>
              {items.length === 0
                ? 'No jobs yet. Approve a quotation to open one.'
                : 'No jobs match this filter.'}
            </Text>
          </View>
        ) : (
          pager.paged.map((job) => (
            <RecordRow
              key={job.id}
              title={job.number}
              status={job.status}
              onPress={() => setSelectedId(job.id)}
              meta={[
                job.customer?.name,
                job.quotation?.number,
                money(job.jobValue),
                `margin ${money(job.jobNet - job.purchaseTotal)}`,
                `${job._count?.invoices ?? 0} inv · ${job._count?.advances ?? 0} adv`,
                day(job.createdAt),
              ]
                .filter(Boolean)
                .join(' · ')}
            />
          ))
        )}

        <Pagination
          page={pager.page}
          setPage={pager.setPage}
          pageSize={pager.pageSize}
          setPageSize={pager.setPageSize}
          pageCount={pager.pageCount}
          total={pager.total}
        />
      </ScreenScroll>
    </View>
  );
}

function JobHubScreen({
  jobId,
  onBack,
}: {
  jobId: string;
  onBack: () => void;
}) {
  const { item, error, setError, reload } = usePolledItem<JobHub>(
    `/jobs/${jobId}/hub`,
  );
  const { flash, notify } = useFlash();
  const [tab, setTab] = useState<Tab>('invoices');
  const [panel, setPanel] = useState<Panel>(null);

  if (!item) {
    return (
      <View style={ui.screen}>
        <ScreenScroll>
          <BackLink label="← Jobs" onPress={onBack} />
          {error ? (
            <Text style={ui.error}>{error}</Text>
          ) : (
            <ActivityIndicator color={colors.accent} />
          )}
        </ScreenScroll>
      </View>
    );
  }

  const { job, financials, invoices, advances, ledger } = item;
  const canInvoice = job.status !== 'closed';
  const quoteLines = job.quotation?.lines ?? [];

  async function transition(action: 'complete' | 'close', message: string) {
    try {
      await apiPost(`/jobs/${job.id}/${action}`, {});
      await reload();
      notify(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    }
  }

  async function cancelInvoice(id: string) {
    try {
      await apiPost(`/invoices/${id}/cancel`, {});
      await reload();
      notify('Invoice cancelled', 'danger');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel');
    }
  }

  return (
    <View style={ui.screen}>
      <ScreenScroll>
        <BackLink label="← Jobs" onPress={onBack} />
        <View style={styles.head}>
          <Text style={ui.title}>Job {job.number}</Text>
          <StatusPill status={job.status} />
        </View>
        <Text style={ui.lede}>
          {job.customer?.name} · {job.title || 'No subject'}
        </Text>
        {error ? <Text style={ui.error}>{error}</Text> : null}

        <View style={styles.stats}>
          <StatCard title="Job value" value={money(financials.jobValue)} />
          <StatCard
            title="Invoiced"
            value={money(financials.invoicedToDate)}
          />
          <BalanceCard
            title="Left to invoice"
            amount={financials.balanceRemaining}
          />
          <StatCard
            title="Advances applied"
            value={money(financials.advancesApplied)}
          />
          <StatCard
            title="Planned margin"
            value={money(financials.profit)}
            hint={`Cost ${money(financials.purchaseTotal)}`}
          />
        </View>

        <RowActions>
          <ActionButton
            label="Progressive invoice"
            tone="primary"
            disabled={!canInvoice}
            onPress={() => setPanel('progressive')}
          />
          <ActionButton
            label="Custom invoice"
            disabled={!canInvoice}
            onPress={() => setPanel('custom')}
          />
          <ActionButton
            label="Final invoice"
            disabled={!canInvoice || financials.balanceRemaining <= 0}
            onPress={() => setPanel('final')}
          />
          <ActionButton
            label="Record advance"
            disabled={!canInvoice}
            onPress={() => setPanel('advance')}
          />
          {job.status === 'open' ? (
            <ActionButton
              label="Mark complete"
              onPress={() => void transition('complete', 'Job completed')}
            />
          ) : null}
          {job.status !== 'closed' ? (
            <ActionButton
              label="Close job"
              tone="danger"
              onPress={() => void transition('close', 'Job closed')}
            />
          ) : null}
        </RowActions>

        {panel && panel !== 'advance' ? (
          <JobInvoiceForm
            jobId={job.id}
            customerId={job.customerId}
            kind={panel}
            jobValue={financials.jobValue}
            balanceRemaining={financials.balanceRemaining}
            onSaved={async (message) => {
              setPanel(null);
              await reload();
              notify(message);
            }}
            onError={setError}
            onCancel={() => setPanel(null)}
          />
        ) : null}

        {panel === 'advance' ? (
          <AdvanceForm
            customerId={job.customerId}
            jobId={job.id}
            onSaved={async (message) => {
              setPanel(null);
              await reload();
              notify(message);
            }}
            onError={setError}
            onCancel={() => setPanel(null)}
          />
        ) : null}

        {!canInvoice ? (
          <Text style={[ui.cardMeta, { marginTop: 10 }]}>
            This job is closed. No further invoices or advances can be recorded.
          </Text>
        ) : null}

        <FilterChips
          active={tab}
          onChange={setTab}
          options={[
            { key: 'invoices', label: `Invoices (${invoices.length})` },
            { key: 'advances', label: `Advances (${advances.length})` },
            { key: 'ledger', label: `Ledger (${ledger.length})` },
            { key: 'quotation', label: `Quotation lines (${quoteLines.length})` },
          ]}
        />

        {tab === 'invoices'
          ? invoices.map((invoice) => (
              <RecordRow
                key={invoice.id}
                title={invoice.number}
                status={invoice.status}
                pdfPath={`/documents/invoices/${invoice.id}.pdf`}
                onPdfError={setError}
                meta={[
                  label(invoice.kind),
                  money(invoice.netPayable),
                  day(invoice.issueDate),
                ].join(' · ')}
              >
                {invoice.status === 'issued' &&
                invoice.kind !== 'credit_note' ? (
                  <LinkAction
                    label="Cancel"
                    tone="danger"
                    onPress={() => void cancelInvoice(invoice.id)}
                  />
                ) : null}
              </RecordRow>
            ))
          : null}

        {tab === 'advances'
          ? advances.map((advance) => (
              <RecordRow
                key={advance.id}
                title={advance.number}
                pdfPath={`/documents/advances/${advance.id}.pdf`}
                onPdfError={setError}
                meta={[
                  label(advance.method),
                  money(advance.amount),
                  `applied ${money(advance.allocatedAmount)}`,
                  `spare ${money(advance.unallocatedAmount)}`,
                  day(advance.receivedAt),
                ].join(' · ')}
              />
            ))
          : null}

        {tab === 'ledger'
          ? ledger.map((row) => (
              <RecordRow
                key={row.id}
                title={label(row.entryType)}
                meta={[
                  day(row.occurredAt),
                  `${row.direction} ${money(row.amount)}`,
                  `bal ${money(row.runningBalance)}`,
                  row.memo,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ))
          : null}

        {tab === 'quotation'
          ? quoteLines.length === 0
            ? (
                <View style={ui.empty}>
                  <Text style={ui.emptyText}>No quotation lines on this job.</Text>
                </View>
              )
            : quoteLines.map((line) => (
                <RecordRow
                  key={line.id}
                  title={line.description}
                  meta={[
                    `${line.qty} ${line.unit}`,
                    `buy ${money(line.purchasePrice)}`,
                    `sell ${money(line.sellPrice)}`,
                    money(line.lineTotal),
                  ].join(' · ')}
                />
              ))
          : null}
      </ScreenScroll>
      <Toast flash={flash} />
    </View>
  );
}

const styles = {
  head: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  back: { color: colors.muted, marginBottom: 8, fontSize: 14 },
  stats: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
};
