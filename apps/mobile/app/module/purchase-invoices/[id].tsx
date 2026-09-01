import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiFetch, apiPost } from '../../../lib/api';
import { useFlash } from '../../../lib/useCollection';
import { Toast } from '../../../components/ListControls';
import { ScreenScroll } from '../../../components/ScreenScroll';
import { RecordRow } from '../../../components/Finance';
import type { PurchaseInvoice } from '@marble/types';
import { colors, ui } from '../../../lib/ui';

type Detail = PurchaseInvoice & {
  lines: Array<{ id: string; productName: string; qty: number; unitCost: number; lineTotal: number }>;
  supplier: { name: string };
};

export default function PurchaseInvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { flash, notify } = useFlash();
  const [invoice, setInvoice] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void apiFetch<Detail>(`/purchase-invoices/${id}`)
      .then(setInvoice)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load purchase invoice'),
      );
  }, [id]);

  async function post() {
    if (!id) return;
    try {
      await apiPost(`/purchase-invoices/${id}/post`, {});
      setInvoice(await apiFetch<Detail>(`/purchase-invoices/${id}`));
      notify('Purchase invoice posted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post purchase invoice');
    }
  }

  if (error) {
    return (
      <View style={ui.screen}>
        <ScreenScroll>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Purchase invoices</Text>
          </Pressable>
          <Text style={ui.error}>{error}</Text>
        </ScreenScroll>
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={[ui.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={ui.screen}>
      <ScreenScroll>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Purchase invoices</Text>
        </Pressable>
        <Text style={ui.title}>{invoice.number}</Text>
        <Text style={ui.lede}>
          {invoice.supplier.name} · {invoice.status}
        </Text>
        {invoice.lines.map((line) => (
          <RecordRow
            key={line.id}
            title={line.productName}
            meta={`Qty ${line.qty} · Unit ${line.unitCost.toFixed(2)} · Line ${line.lineTotal.toFixed(2)}`}
          />
        ))}
        <Text style={ui.cardMeta}>
          Total {invoice.currency} {invoice.total.toFixed(2)} · Balance{' '}
          {invoice.balance.toFixed(2)}
        </Text>
        {invoice.status === 'draft' ? (
          <Pressable style={ui.button} onPress={() => void post()}>
            <Text style={ui.buttonText}>Post invoice</Text>
          </Pressable>
        ) : null}
      </ScreenScroll>
      <Toast flash={flash} />
    </View>
  );
}

const styles = {
  back: {
    color: colors.accent,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
};
