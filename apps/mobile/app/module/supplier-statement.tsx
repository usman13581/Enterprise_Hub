import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiFetch } from '../../lib/api';
import { amount, moneyHeader } from '../../lib/format';
import { searchItems, usePagination } from '../../lib/useCollection';
import { Pagination, SearchBox } from '../../components/ListControls';
import { ScreenScroll } from '../../components/ScreenScroll';
import { RecordRow } from '../../components/Finance';
import { colors, ui } from '../../lib/ui';

type Statement = {
  supplier: { name: string };
  closing: number;
  rows: Array<{
    id: string;
    occurredAt: string;
    description: string;
    direction: string;
    amount: number;
    balance: number;
  }>;
};

export default function SupplierStatementScreen() {
  const { supplierId } = useLocalSearchParams<{ supplierId?: string }>();
  const [statement, setStatement] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!supplierId) return;
    void apiFetch<Statement>(`/suppliers/${supplierId}/statement`)
      .then(setStatement)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load statement'),
      );
  }, [supplierId]);

  const filteredRows = useMemo(
    () => searchItems(statement?.rows ?? [], query),
    [statement?.rows, query],
  );
  const pager = usePagination(filteredRows, query);

  if (error) {
    return (
      <View style={ui.screen}>
        <Text style={ui.error}>{error}</Text>
      </View>
    );
  }

  if (!statement) {
    return (
      <View style={[ui.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={ui.screen}>
      <ScreenScroll>
        <Text style={ui.title}>{statement.supplier.name} statement</Text>
        <Text style={ui.lede}>
          {moneyHeader('Closing payable')} {amount(statement.closing)}
        </Text>
        {statement.rows.length > 0 ? (
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search statement rows…"
          />
        ) : null}
        {statement.rows.length === 0 ? (
          <Text style={ui.emptyText}>No ledger entries yet.</Text>
        ) : filteredRows.length === 0 ? (
          <Text style={ui.emptyText}>No rows match your search.</Text>
        ) : (
          pager.paged.map((row) => (
            <RecordRow
              key={row.id}
              title={row.description}
              meta={`${new Date(row.occurredAt).toLocaleDateString()} · ${row.direction} ${amount(row.amount)} · Balance ${amount(row.balance)}`}
            />
          ))
        )}
        {filteredRows.length > 0 ? (
          <Pagination
            page={pager.page}
            setPage={pager.setPage}
            pageSize={pager.pageSize}
            setPageSize={pager.setPageSize}
            pageCount={pager.pageCount}
            total={pager.total}
          />
        ) : null}
      </ScreenScroll>
    </View>
  );
}
