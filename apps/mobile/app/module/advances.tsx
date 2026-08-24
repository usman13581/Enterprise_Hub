import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';
import { apiPost } from '../../lib/api';
import { day, label, money } from '../../lib/format';
import {
  searchItems,
  useFlash,
  usePagination,
  usePolledList,
} from '../../lib/useCollection';
import { Pagination, SearchBox, Toast } from '../../components/ListControls';
import { ScreenScroll } from '../../components/ScreenScroll';
import {
  LinkAction,
  RecordRow,
  StatCard,
} from '../../components/Finance';
import { AdvanceForm } from '../../components/MoneyForms';
import type { AdvancePayment, Customer } from '../../lib/types';
import { colors, ui } from '../../lib/ui';

export default function AdvancesScreen() {
  const { items, loading, error, setError, reload } =
    usePolledList<AdvancePayment>('/advances');
  const { items: customers } = usePolledList<Customer>('/customers', 20000);
  const { flash, notify } = useFlash();
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => searchItems(items, query), [items, query]);
  const pager = usePagination(filtered);
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
        <Text style={ui.lede}>
          Money received before invoicing. Recording credits the customer
          immediately.
        </Text>
        {error ? <Text style={ui.error}>{error}</Text> : null}

        <View style={styles.stats}>
          <StatCard title="Received" value={money(totals.received)} />
          <StatCard title="Not yet applied" value={money(totals.spare)} />
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

            {filtered.length === 0 ? (
              <View style={ui.empty}>
                <Text style={ui.emptyText}>
                  {items.length === 0
                    ? 'No advances recorded yet.'
                    : 'No advances match your search.'}
                </Text>
              </View>
            ) : (
              pager.paged.map((advance) => (
                <RecordRow
                  key={advance.id}
                  title={advance.number}
                  pdfPath={`/documents/advances/${advance.id}.pdf`}
                  onPdfError={setError}
                  meta={[
                    advance.customer?.name,
                    money(advance.amount),
                    advance.cancelledAt ? 'cancelled' : `spare ${money(advance.unallocatedAmount)}`,
                    advance.job ? `Job ${advance.job.number}` : null,
                    label(advance.method),
                    day(advance.receivedAt),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                >
                  {advance.allocatedAmount === 0 && !advance.cancelledAt ? (
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
