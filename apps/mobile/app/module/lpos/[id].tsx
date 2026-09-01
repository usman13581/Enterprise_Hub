import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { Lpo } from '@marble/types';
import { FormField } from '../../../components/FormField';
import { RecordRow } from '../../../components/Finance';
import { ScreenScroll } from '../../../components/ScreenScroll';
import { apiFetch, apiPost } from '../../../lib/api';
import { colors, ui } from '../../../lib/ui';

type Detail = Lpo & {
  supplier: { name: string };
  receipts: Array<{ id: string; number: string; receiptDate: string }>;
};

export default function LpoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lpo, setLpo] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Record<string, string>>({});

  async function reload() {
    try {
      setLpo(await apiFetch<Detail>(`/lpos/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load LPO');
    }
  }

  useEffect(() => {
    if (id) void reload();
  }, [id]);

  async function action(name: 'approve' | 'send' | 'cancel') {
    try {
      await apiPost(`/lpos/${id}/${name}`, {});
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${name} LPO`);
    }
  }

  async function receive() {
    const lines = Object.entries(receipt)
      .filter(([, value]) => Number(value) > 0)
      .map(([lpoLineId, value]) => ({
        lpoLineId,
        receivedQty: Number(value),
      }));
    if (!lines.length) return;
    try {
      await apiPost(`/lpos/${id}/receipts`, {
        receiptDate: new Date().toISOString(),
        lines,
      });
      setReceipt({});
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record receipt');
    }
  }

  if (error) {
    return (
      <View style={ui.screen}>
        <Text style={ui.error}>{error}</Text>
      </View>
    );
  }

  if (!lpo) {
    return (
      <View style={[ui.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const canReceive = ['sent', 'partially_received'].includes(lpo.status);

  return (
    <View style={ui.screen}>
      <ScreenScroll>
        <Text style={ui.title}>{lpo.number}</Text>
        <Text style={ui.lede}>
          {lpo.supplier.name} · {lpo.status}
        </Text>
        <View style={ui.cardActions}>
          {lpo.status === 'draft' ? (
            <Pressable style={ui.button} onPress={() => void action('approve')}>
              <Text style={ui.buttonText}>Approve</Text>
            </Pressable>
          ) : null}
          {lpo.status === 'approved' ? (
            <Pressable style={ui.button} onPress={() => void action('send')}>
              <Text style={ui.buttonText}>Send</Text>
            </Pressable>
          ) : null}
          {['draft', 'approved', 'sent'].includes(lpo.status) ? (
            <Pressable style={ui.ghost} onPress={() => void action('cancel')}>
              <Text style={ui.ghostText}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>

        {lpo.lines.map((line) => (
          <View style={ui.card} key={line.id}>
            <RecordRow
              title={line.productName}
              meta={`${line.unit} · Ordered ${line.orderedQty} · Received ${line.receivedQty} · Invoiced ${line.invoicedQty}`}
            />
            {canReceive ? (
              <FormField
                first
                label="Receive now"
                keyboardType="decimal-pad"
                value={receipt[line.id] ?? ''}
                onChangeText={(value) =>
                  setReceipt({ ...receipt, [line.id]: value })
                }
                placeholder="0"
              />
            ) : null}
          </View>
        ))}

        {canReceive ? (
          <Pressable style={ui.button} onPress={() => void receive()}>
            <Text style={ui.buttonText}>Record receipt</Text>
          </Pressable>
        ) : null}

        <Text style={styles.section}>Receipts</Text>
        {lpo.receipts.length === 0 ? (
          <Text style={styles.muted}>No receipts recorded yet.</Text>
        ) : (
          lpo.receipts.map((item) => (
            <Text key={item.id} style={styles.muted}>
              {item.number} · {new Date(item.receiptDate).toLocaleDateString()}
            </Text>
          ))
        )}
      </ScreenScroll>
    </View>
  );
}

const styles = {
  section: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600' as const,
    marginTop: 18,
    marginBottom: 8,
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
    marginBottom: 5,
  },
};
