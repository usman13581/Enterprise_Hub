import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
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
import {
  ActionButton,
  BalanceCard,
  FilterChips,
  RecordRow,
  RowActions,
  StatCard,
  StatusPill,
} from '../../components/Finance';
import type { JobHub, JobListItem } from '../../lib/types';
import { colors, ui } from '../../lib/ui';

type Filter = 'all' | 'open' | 'completed' | 'closed';

export default function JobsScreen() {
  const { items, loading, error } = usePolledList<JobListItem>('/jobs');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
        onBack={() => setSelectedId(null)}
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
      <ScrollView contentContainerStyle={ui.content}>
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
                `${job._count?.invoices ?? 0} inv`,
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
      </ScrollView>
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
  const [tab, setTab] = useState<'invoices' | 'advances' | 'ledger'>('invoices');
  const [panel, setPanel] = useState<'progressive' | 'advance' | null>(null);
  const [percentage, setPercentage] = useState('30');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [saving, setSaving] = useState(false);

  if (!item) {
    return (
      <View style={ui.screen}>
        <ScrollView contentContainerStyle={ui.content}>
          <Pressable onPress={onBack}>
            <Text style={styles.back}>← Jobs</Text>
          </Pressable>
          {error ? <Text style={ui.error}>{error}</Text> : <ActivityIndicator color={colors.accent} />}
        </ScrollView>
      </View>
    );
  }

  const { job, financials, invoices, advances, ledger } = item;
  const canInvoice = job.status !== 'closed';

  async function transition(action: 'complete' | 'close', message: string) {
    try {
      await apiPost(`/jobs/${job.id}/${action}`, {});
      await reload();
      notify(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    }
  }

  async function issueProgressive() {
    if (saving) return;
    setSaving(true);
    try {
      await apiPost(`/invoices/jobs/${job.id}/progressive`, {
        percentage: Number(percentage),
      });
      setPanel(null);
      await reload();
      notify('Invoice issued');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not issue');
    } finally {
      setSaving(false);
    }
  }

  async function recordAdvance() {
    if (saving) return;
    setSaving(true);
    try {
      await apiPost('/advances', {
        customerId: job.customerId,
        jobId: job.id,
        amount: Number(advanceAmount),
        method: 'cash',
      });
      setPanel(null);
      setAdvanceAmount('');
      await reload();
      notify('Advance recorded');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function issueFinal() {
    try {
      await apiPost(`/invoices/jobs/${job.id}/final`, {});
      await reload();
      notify('Final invoice issued');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not issue');
    }
  }

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← Jobs</Text>
        </Pressable>
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
          <StatCard title="Margin" value={money(financials.profit)} />
        </View>

        <RowActions>
          <ActionButton
            label="Progressive invoice"
            tone="primary"
            disabled={!canInvoice}
            onPress={() => setPanel('progressive')}
          />
          <ActionButton
            label="Final invoice"
            disabled={!canInvoice || financials.balanceRemaining <= 0}
            onPress={() => void issueFinal()}
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

        {panel === 'progressive' ? (
          <View style={ui.card}>
            <Text style={ui.cardTitle}>Progressive invoice</Text>
            <Text style={ui.label}>Percentage of job value</Text>
            <TextInput
              style={ui.input}
              value={percentage}
              onChangeText={setPercentage}
              keyboardType="decimal-pad"
            />
            <RowActions>
              <ActionButton
                label={saving ? 'Issuing…' : 'Issue'}
                tone="primary"
                disabled={saving}
                onPress={() => void issueProgressive()}
              />
              <ActionButton label="Cancel" onPress={() => setPanel(null)} />
            </RowActions>
          </View>
        ) : null}

        {panel === 'advance' ? (
          <View style={ui.card}>
            <Text style={ui.cardTitle}>Record advance</Text>
            <Text style={ui.label}>Amount *</Text>
            <TextInput
              style={ui.input}
              value={advanceAmount}
              onChangeText={setAdvanceAmount}
              keyboardType="decimal-pad"
            />
            <RowActions>
              <ActionButton
                label={saving ? 'Saving…' : 'Record'}
                tone="primary"
                disabled={saving}
                onPress={() => void recordAdvance()}
              />
              <ActionButton label="Cancel" onPress={() => setPanel(null)} />
            </RowActions>
          </View>
        ) : null}

        <FilterChips
          active={tab}
          onChange={setTab}
          options={[
            { key: 'invoices', label: `Invoices (${invoices.length})` },
            { key: 'advances', label: `Advances (${advances.length})` },
            { key: 'ledger', label: `Ledger (${ledger.length})` },
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
              />
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
                  money(advance.amount),
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
                meta={`${day(row.occurredAt)} · ${row.direction} ${money(row.amount)} · bal ${money(row.runningBalance)}`}
              />
            ))
          : null}
      </ScrollView>
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
