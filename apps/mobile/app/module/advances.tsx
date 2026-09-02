import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from 'react-native';
import { apiDelete, apiPost } from '../../lib/api';
import { useCompanyAdmin } from '../../lib/useCompanyAdmin';
import { amount, day, label, moneyHeader } from '../../lib/format';
import {
  searchItems,
  useFlash,
  usePagination,
  usePolledList,
} from '../../lib/useCollection';
import { Pagination, SearchBox, Toast } from '../../components/ListControls';
import { ScreenScroll } from '../../components/ScreenScroll';
import {
  FilterChips,
  LinkAction,
  RecordRow,
  StatCard,
} from '../../components/Finance';
import { AdvanceForm } from '../../components/MoneyForms';
import type { AdvancePayment, Customer } from '../../lib/types';
import { colors, ui } from '../../lib/ui';

type Filter = 'all' | 'draft' | 'posted' | 'cancelled';

export default function AdvancesScreen() {
  const { items, loading, error, setError, reload } =
    usePolledList<AdvancePayment>('/advances');
  const { items: customers } = usePolledList<Customer>('/customers', 20000);
  const { flash, notify } = useFlash();
  const isAdmin = useCompanyAdmin();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    const byStatus =
      filter === 'all'
        ? items
        : filter === 'cancelled'
          ? items.filter((item) => item.cancelledAt || item.status === 'cancelled')
          : items.filter((item) => item.status === filter);
    return searchItems(byStatus, query);
  }, [items, filter, query]);
  const pager = usePagination(filtered, `${filter}:${query}`);
  const totals = useMemo(
    () =>
      items.reduce(
        (acc, advance) => ({
          received: acc.received + advance.amount,
          spare: acc.spare + advance.unallocatedAmount,
        }),
        { received: 0, spare: 0 },
      ),
    [items],
  );

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
        <Text style={ui.title}>Advances</Text>
        {error ? <Text style={ui.error}>{error}</Text> : null}

        <View style={styles.stats}>
          <StatCard title={moneyHeader('Received')} value={amount(totals.received)} />
          <StatCard title={moneyHeader('Not yet applied')} value={amount(totals.spare)} />
        </View>

        {showForm ? (
          <AdvanceForm
            customers={customers}
            onSaved={async (message) => {
              setShowForm(false);
              await reload();
              notify(message);
            }}
            onError={setError}
            onCancel={() => setShowForm(false)}
          />
        ) : (
          <>
            <View style={ui.toolbar}>
              <Text style={ui.count}>{items.length} receipts</Text>
              <Pressable
                style={ui.button}
                onPress={() => setShowForm(true)}
                disabled={customers.length === 0}
              >
                <Text style={ui.buttonText}>Record</Text>
              </Pressable>
            </View>

            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder="Search advances…"
            />

            <FilterChips
              active={filter}
              onChange={setFilter}
              options={[
                { key: 'all', label: 'All' },
                { key: 'draft', label: 'Draft' },
                { key: 'posted', label: 'Posted' },
                { key: 'cancelled', label: 'Cancelled' },
              ]}
            />

            {filtered.length === 0 ? (
              <View style={ui.empty}>
                <Text style={ui.emptyText}>
                  {items.length === 0
                    ? 'No advances recorded yet.'
                    : 'No advances match this filter.'}
                </Text>
              </View>
            ) : (
              pager.paged.map((advance) => (
                <RecordRow
                  key={advance.id}
                  title={advance.number}
                  status={advance.status ?? (advance.cancelledAt ? 'cancelled' : 'posted')}
                  pdfPath={`/documents/advances/${advance.id}.pdf`}
                  onPdfError={setError}
                  meta={[
                    advance.customer?.name,
                    amount(advance.amount),
                    advance.cancelledAt ? 'cancelled' : `spare ${amount(advance.unallocatedAmount)}`,
                    advance.job ? `Job ${advance.job.number}` : null,
                    label(advance.method),
                    day(advance.receivedAt),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                >
                  {advance.status === 'draft' ? (
                    <LinkAction
                      label="Approve"
                      onPress={() =>
                        void apiPost(`/advances/${advance.id}/approve`, {})
                          .then(() => reload())
                          .then(() => notify('Advance approved'))
                          .catch((e) =>
                            setError(
                              e instanceof Error
                                ? e.message
                                : 'Approve failed',
                            ),
                          )
                      }
                    />
                  ) : null}
                  {advance.status === 'draft' && isAdmin ? (
                    <LinkAction
                      label="Delete"
                      tone="danger"
                      onPress={() =>
                        Alert.alert(
                          'Delete draft?',
                          'This permanently removes the advance. This cannot be undone.',
                          [
                            { text: 'Keep', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () =>
                                void apiDelete(`/advances/${advance.id}`)
                                  .then(() => reload())
                                  .then(() => notify('Advance deleted', 'danger'))
                                  .catch((e) =>
                                    setError(
                                      e instanceof Error
                                        ? e.message
                                        : 'Delete failed',
                                    ),
                                  ),
                            },
                          ],
                        )
                      }
                    />
                  ) : null}
                  {advance.allocatedAmount === 0 &&
                  !advance.cancelledAt &&
                  !(advance.status === 'draft' && isAdmin) ? (
                    <LinkAction
                      label="Cancel"
                      onPress={() =>
                        void apiPost(`/advances/${advance.id}/cancel`, {})
                          .then(() => reload())
                          .then(() => notify('Advance cancelled'))
                          .catch((e) =>
                            setError(
                              e instanceof Error
                                ? e.message
                                : 'Cancel failed',
                            ),
                          )
                      }
                    />
                  ) : null}
                </RecordRow>
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
          </>
        )}
      </ScreenScroll>
      <Toast flash={flash} />
    </View>
  );
}

const styles = {
  stats: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
};
