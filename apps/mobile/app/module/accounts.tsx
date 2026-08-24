import { useState } from 'react';
import {
  ActivityIndicator,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { money } from '../../lib/format';
import { usePolledItem } from '../../lib/useCollection';
import { ScreenScroll } from '../../components/ScreenScroll';
import {
  BalanceCard,
  FilterChips,
  RecordRow,
  StatCard,
} from '../../components/Finance';
import type { AccountsOverview } from '../../lib/types';
import { colors, ui } from '../../lib/ui';

type Tab = 'receivables' | 'profit';

export default function AccountsScreen() {
  const router = useRouter();
  const { item, error } =
    usePolledItem<AccountsOverview>('/accounts/overview');
  const [tab, setTab] = useState<Tab>('receivables');

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
        <Text style={ui.lede}>
          Company position across every customer and job. Balances come from the
          ledger, so they always agree with the individual statements.
        </Text>

        <View style={styles.stats}>
          <StatCard title="Billed" value={money(item.summary.billed)} />
          <StatCard
            title="Advances"
            value={money(item.summary.advancesReceived)}
          />
          <BalanceCard title="Receivable" amount={item.summary.balanceDue} />
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
              key: 'profit',
              label: `Margin by job (${item.profitByJob.length})`,
            },
          ]}
        />

        {tab === 'receivables'
          ? item.receivableByCustomer.length === 0
            ? (
                <View style={ui.empty}>
                  <Text style={ui.emptyText}>No customer activity yet.</Text>
                </View>
              )
            : item.receivableByCustomer.map((row) => (
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

        {tab === 'profit'
          ? item.profitByJob.length === 0
            ? (
                <View style={ui.empty}>
                  <Text style={ui.emptyText}>No jobs yet.</Text>
                </View>
              )
            : item.profitByJob.map((row) => (
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
