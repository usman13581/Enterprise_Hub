import { useState } from 'react';
import {
  ActivityIndicator,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { money } from '../../lib/format';
import {
  searchItems,
  usePagination,
  usePolledItem,
} from '../../lib/useCollection';
import { Pagination, SearchBox } from '../../components/ListControls';
import { ScreenScroll } from '../../components/ScreenScroll';
import {
  BalanceCard,
  FilterChips,
  RecordRow,
  StatCard,
} from '../../components/Finance';
import type { AccountsOverview } from '../../lib/types';
import { colors, ui } from '../../lib/ui';

type Tab = 'receivables' | 'payables' | 'profit';

export default function AccountsScreen() {
  const router = useRouter();
  const { item, error } =
    usePolledItem<AccountsOverview>('/accounts/overview');
  const [tab, setTab] = useState<Tab>('receivables');
  const [query, setQuery] = useState('');
  const filteredReceivables = searchItems(
    item?.receivableByCustomer ?? [],
    query,
  );
  const filteredPayables = searchItems(item?.payableBySupplier ?? [], query);
  const filteredProfit = searchItems(item?.profitByJob ?? [], query);
  const receivablesPager = usePagination(
    filteredReceivables,
    `receivables:${query}`,
  );
  const payablesPager = usePagination(filteredPayables, `payables:${query}`);
  const profitPager = usePagination(filteredProfit, `profit:${query}`);

  if (!item) {
    return (
      <View style={[ui.screen, { justifyContent: 'center' }]}>
        {error ? (
          <Text style={[ui.error, { padding: 20 }]}>{error}</Text>
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </View>
    );
  }

  return (
    <View style={ui.screen}>
      <ScreenScroll>
        <Text style={ui.title}>Accounts</Text>

        <View style={styles.stats}>
          <StatCard title="Billed" value={money(item.summary.billed)} />
          <StatCard
            title="Advances"
            value={money(item.summary.advancesReceived)}
          />
          <BalanceCard title="Receivable" amount={item.summary.balanceDue} />
          <BalanceCard title="Payable" amount={item.totalPayable} />
          <StatCard
            title="Unapplied advances"
            value={money(item.summary.unallocatedAdvances)}
          />
          <StatCard
            title="Credit notes"
            value={money(item.summary.credited)}
          />
          <StatCard
            title="Planned margin"
            value={money(item.totalProfit)}
            hint={`${item.openJobs} job${item.openJobs === 1 ? '' : 's'} still open`}
          />
        </View>

        <FilterChips
          active={tab}
          onChange={setTab}
          options={[
            {
              key: 'receivables',
              label: `Receivables (${item.receivableByCustomer.length})`,
            },
            {
              key: 'payables',
              label: `Payable by supplier (${item.payableBySupplier.length})`,
            },
            {
              key: 'profit',
              label: `Margin by job (${item.profitByJob.length})`,
            },
          ]}
        />
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder={
            tab === 'receivables'
              ? 'Search customers…'
              : tab === 'payables'
                ? 'Search suppliers…'
                : 'Search jobs or customers…'
          }
        />

        {tab === 'receivables'
          ? filteredReceivables.length === 0
            ? (
                <View style={ui.empty}>
                  <Text style={ui.emptyText}>No customer activity yet.</Text>
                </View>
              )
            : receivablesPager.paged.map((row) => (
                <RecordRow
                  key={row.customerId}
                  title={row.customerName}
                  onPress={() =>
                    router.push(
                      `/module/customers?open=${row.customerId}` as never,
                    )
                  }
                  meta={`Billed ${money(row.billed)} · received ${money(row.received)} · bal ${money(row.balance)}`}
                />
              ))
          : null}

        {tab === 'payables'
          ? filteredPayables.length === 0
            ? (
                <View style={ui.empty}>
                  <Text style={ui.emptyText}>No supplier payables yet.</Text>
                </View>
              )
            : payablesPager.paged.map((row) => (
                <RecordRow
                  key={row.supplierId}
                  title={row.supplierName}
                  onPress={() =>
                    router.push(
                      `/module/supplier/${row.supplierId}` as never,
                    )
                  }
                  meta={`Invoiced ${money(row.invoiced)} · paid ${money(row.paid)} · bal ${money(row.balance)}`}
                />
              ))
          : null}

        {tab === 'profit'
          ? filteredProfit.length === 0
            ? (
                <View style={ui.empty}>
                  <Text style={ui.emptyText}>No jobs yet.</Text>
                </View>
              )
            : profitPager.paged.map((row) => (
                <RecordRow
                  key={row.jobId}
                  title={row.jobNumber}
                  status={row.status}
                  onPress={() =>
                    router.push(`/module/jobs?open=${row.jobId}` as never)
                  }
                  meta={`${row.customerName} · value ${money(row.jobValue)} · cost ${money(row.purchaseTotal)} · margin ${money(row.profit)}`}
                />
              ))
          : null}
        {tab === 'receivables' && filteredReceivables.length > 0 ? (
          <Pagination
            page={receivablesPager.page}
            setPage={receivablesPager.setPage}
            pageSize={receivablesPager.pageSize}
            setPageSize={receivablesPager.setPageSize}
            pageCount={receivablesPager.pageCount}
            total={receivablesPager.total}
          />
        ) : null}
        {tab === 'payables' && filteredPayables.length > 0 ? (
          <Pagination
            page={payablesPager.page}
            setPage={payablesPager.setPage}
            pageSize={payablesPager.pageSize}
            setPageSize={payablesPager.setPageSize}
            pageCount={payablesPager.pageCount}
            total={payablesPager.total}
          />
        ) : null}
        {tab === 'profit' && filteredProfit.length > 0 ? (
          <Pagination
            page={profitPager.page}
            setPage={profitPager.setPage}
            pageSize={profitPager.pageSize}
            setPageSize={profitPager.setPageSize}
            pageCount={profitPager.pageCount}
            total={profitPager.total}
          />
        ) : null}
      </ScreenScroll>
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
