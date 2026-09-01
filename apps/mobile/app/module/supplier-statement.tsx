import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiFetch } from '../../lib/api';
import { ScreenScroll } from '../../components/ScreenScroll';
import { RecordRow } from '../../components/Finance';
import { colors, ui } from '../../lib/ui';

type Statement = { supplier: { name: string }; closing: number; rows: Array<{ id: string; occurredAt: string; description: string; direction: string; amount: number; balance: number }> };

export default function SupplierStatementScreen() {
  const { supplierId } = useLocalSearchParams<{ supplierId?: string }>();
  const [statement, setStatement] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (supplierId) void apiFetch<Statement>(`/suppliers/${supplierId}/statement`).then(setStatement).catch((err) => setError(err instanceof Error ? err.message : 'Could not load statement')); }, [supplierId]);
  if (error) return <View style={ui.screen}><Text style={ui.error}>{error}</Text></View>;
  if (!statement) return <View style={[ui.screen, { justifyContent: 'center' }]}><ActivityIndicator color={colors.accent} /></View>;
  return <View style={ui.screen}><ScreenScroll><Text style={ui.title}>{statement.supplier.name} statement</Text><Text style={ui.lede}>Closing payable AED {statement.closing.toFixed(2)}</Text>{statement.rows.map((row) => <RecordRow key={row.id} title={row.description} meta={`${new Date(row.occurredAt).toLocaleDateString()} · ${row.direction} AED ${row.amount.toFixed(2)} · Balance AED ${row.balance.toFixed(2)}`} />)}</ScreenScroll></View>;
}
