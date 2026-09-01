import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { computePurchasingTotals } from '@marble/domain';
import type { Lpo, LpoLine, Product } from '@marble/types';
import {
  discountFromStored,
  discountPayload,
  DiscountInput,
  EMPTY_DISCOUNT,
  type DiscountDraft,
} from '../../../components/DiscountInput';
import { FormField, FormPicker } from '../../../components/FormField';
import { RecordRow } from '../../../components/Finance';
import { ScreenScroll } from '../../../components/ScreenScroll';
import { SearchablePicker } from '../../../components/SearchablePicker';
import { apiFetch, apiPost, apiPut } from '../../../lib/api';
import { dateInputValue, dueDateIso, todayIso } from '../../../lib/dates';
import { usePolledList } from '../../../lib/useCollection';
import { money } from '../../../lib/format';
import { colors, ui } from '../../../lib/ui';

type Detail = Lpo & {
  supplier: { name: string };
  receipts: Array<{ id: string; number: string; receiptDate: string }>;
};

type LineDraft = {
  productId: string;
  productName: string;
  unit: string;
  qty: string;
  unitCost: string;
  discountMode: DiscountDraft['discountMode'];
  discountValue: string;
};

const EMPTY_LINE: LineDraft = {
  productId: '',
  productName: '',
  unit: 'unit',
  qty: '1',
  unitCost: '0',
  discountMode: 'none',
  discountValue: '0',
};

const num = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function linesToDraft(lines: LpoLine[]): LineDraft[] {
  return lines.map((line) => ({
    productId: line.productId ?? '',
    productName: line.productName,
    unit: line.unit,
    qty: String(line.orderedQty),
    unitCost: String(line.unitCost),
    discountMode: line.discountMode,
    discountValue: String(line.discountValue ?? 0),
  }));
}

export default function LpoDetailScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const { items: products } = usePolledList<Product>('/products');
  const [lpo, setLpo] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(edit === '1');
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>([{ ...EMPTY_LINE }]);
  const [documentDiscount, setDocumentDiscount] = useState<DiscountDraft>({
    ...EMPTY_DISCOUNT,
  });
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');

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

  useEffect(() => {
    if (!lpo || lpo.status !== 'draft' || edit !== '1') return;
    setLines(lpo.lines.length ? linesToDraft(lpo.lines) : [{ ...EMPTY_LINE }]);
    setDocumentDiscount(
      discountFromStored(lpo.discountMode, lpo.discountValue),
    );
    setRequestedDeliveryDate(
      dateInputValue(lpo.requestedDeliveryDate) || dueDateIso(),
    );
  }, [lpo?.id, edit]);

  const editTotals = useMemo(
    () =>
      computePurchasingTotals(
        lines.map((line) => ({
          qty: num(line.qty),
          unitCost: num(line.unitCost),
          discountMode: line.discountMode,
          discountValue: num(line.discountValue),
        })),
        discountPayload(documentDiscount),
      ),
    [lines, documentDiscount],
  );

  const availableProducts = products.filter(
    (product) => product.supplierId === lpo?.supplierId,
  );
  const productOptions = availableProducts.map((item) => ({
    id: item.id,
    label: item.name,
  }));

  function startEdit() {
    if (!lpo) return;
    setLines(lpo.lines.length ? linesToDraft(lpo.lines) : [{ ...EMPTY_LINE }]);
    setDocumentDiscount(
      discountFromStored(lpo.discountMode, lpo.discountValue),
    );
    setRequestedDeliveryDate(
      dateInputValue(lpo.requestedDeliveryDate) || dueDateIso(),
    );
    setEditing(true);
  }

  function patchLine(index: number, changes: Partial<LineDraft>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...changes } : line)),
    );
  }

  function pickProduct(index: number, productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product) {
      patchLine(index, { productId: '', productName: lines[index].productName });
      return;
    }
    patchLine(index, {
      productId,
      productName: product.name,
      unit: product.unit,
      unitCost: String(product.purchasePrice),
    });
  }

  async function action(name: 'approve' | 'send' | 'cancel') {
    try {
      await apiPost(`/lpos/${id}/${name}`, {});
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${name} LPO`);
    }
  }

  async function saveDraft() {
    if (!lpo || saving) return;
    const payloadLines = lines
      .map((line) => ({
        productId: line.productId || null,
        productName: line.productName.trim(),
        unit: line.unit.trim() || 'unit',
        orderedQty: num(line.qty),
        unitCost: num(line.unitCost),
        discountMode: line.discountMode,
        discountValue: num(line.discountValue),
      }))
      .filter((line) => line.productName && line.orderedQty > 0);
    if (!payloadLines.length) return;
    setSaving(true);
    setError(null);
    try {
      await apiPut(`/lpos/${id}`, {
        requestedDeliveryDate: requestedDeliveryDate || null,
        ...discountPayload(documentDiscount),
        lines: payloadLines,
      });
      setEditing(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save LPO');
    } finally {
      setSaving(false);
    }
  }

  async function receive() {
    const receiptLines = Object.entries(receipt)
      .filter(([, value]) => Number(value) > 0)
      .map(([lpoLineId, value]) => ({
        lpoLineId,
        receivedQty: Number(value),
      }));
    if (!receiptLines.length) return;
    try {
      await apiPost(`/lpos/${id}/receipts`, {
        receiptDate: todayIso(),
        lines: receiptLines,
      });
      setReceipt({});
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record receipt');
    }
  }

  if (error && !lpo) {
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

  if (editing && lpo.status === 'draft') {
    return (
      <View style={ui.screen}>
        <ScreenScroll>
          <Text style={ui.title}>Edit {lpo.number}</Text>
          <Text style={ui.lede}>{lpo.supplier.name}</Text>
          {error ? <Text style={ui.error}>{error}</Text> : null}
          <FormField
            first
            label="Requested delivery (YYYY-MM-DD)"
            value={requestedDeliveryDate}
            onChangeText={setRequestedDeliveryDate}
          />

          {lines.map((line, index) => (
            <View key={index} style={styles.lineBox}>
              <Text style={ui.label}>Line {index + 1}</Text>
              <FormPicker label="Product">
                <SearchablePicker
                  value={line.productId}
                  options={productOptions}
                  searchPlaceholder="Search products…"
                  emptyText="No products match your search."
                  onChange={(value) => pickProduct(index, value)}
                />
              </FormPicker>
              {!line.productId ? (
                <FormField
                  label="Product name"
                  value={line.productName}
                  onChangeText={(productName) =>
                    patchLine(index, { productName })
                  }
                />
              ) : null}
              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={ui.label}>Quantity</Text>
                  <TextInput
                    style={ui.input}
                    keyboardType="decimal-pad"
                    value={line.qty}
                    onChangeText={(qty) => patchLine(index, { qty })}
                    placeholderTextColor={colors.soft}
                  />
                </View>
                <View style={styles.half}>
                  <Text style={ui.label}>Unit</Text>
                  <TextInput
                    style={ui.input}
                    value={line.unit}
                    onChangeText={(unit) => patchLine(index, { unit })}
                    placeholderTextColor={colors.soft}
                  />
                </View>
              </View>
              <FormField
                label="Unit cost"
                keyboardType="decimal-pad"
                value={line.unitCost}
                onChangeText={(unitCost) => patchLine(index, { unitCost })}
              />
              <DiscountInput
                label="Line discount"
                compact
                value={{
                  discountMode: line.discountMode,
                  discountValue: line.discountValue,
                }}
                onChange={(discount) =>
                  patchLine(index, {
                    discountMode: discount.discountMode,
                    discountValue: discount.discountValue,
                  })
                }
              />
              <Text style={ui.cardMeta}>
                Line total {money(editTotals.lineTotals[index] ?? 0)}
              </Text>
              {lines.length > 1 ? (
                <Pressable
                  onPress={() =>
                    setLines(lines.filter((_, i) => i !== index))
                  }
                >
                  <Text style={[ui.ghostText, ui.dangerText]}>
                    Remove line
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}

          <Pressable
            style={styles.addLineButton}
            onPress={() => setLines([...lines, { ...EMPTY_LINE }])}
          >
            <Text style={styles.addLineButtonText}>+ Add line</Text>
          </Pressable>

          <DiscountInput
            label="Document discount"
            value={documentDiscount}
            onChange={setDocumentDiscount}
          />
          <Text style={ui.cardMeta}>
            Total {money(editTotals.total)} · Input VAT{' '}
            {money(editTotals.inputVat)}
          </Text>
          <View style={ui.cardActions}>
            <Pressable
              style={ui.button}
              disabled={saving}
              onPress={() => void saveDraft()}
            >
              <Text style={ui.buttonText}>
                {saving ? 'Saving…' : 'Save changes'}
              </Text>
            </Pressable>
            <Pressable style={ui.ghost} onPress={() => setEditing(false)}>
              <Text style={ui.ghostText}>Cancel</Text>
            </Pressable>
          </View>
        </ScreenScroll>
      </View>
    );
  }

  return (
    <View style={ui.screen}>
      <ScreenScroll>
        <Text style={ui.title}>{lpo.number}</Text>
        <Text style={ui.lede}>
          {lpo.supplier.name} · {lpo.status}
          {lpo.requestedDeliveryDate
            ? ` · Delivery ${lpo.requestedDeliveryDate.slice(0, 10)}`
            : ''}
        </Text>
        {error ? <Text style={ui.error}>{error}</Text> : null}
        <View style={ui.cardActions}>
          {lpo.status === 'draft' ? (
            <>
              <Pressable style={ui.ghost} onPress={startEdit}>
                <Text style={ui.ghostText}>Edit</Text>
              </Pressable>
              <Pressable style={ui.button} onPress={() => void action('approve')}>
                <Text style={ui.buttonText}>Approve</Text>
              </Pressable>
            </>
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
              meta={`${line.unit} · Ordered ${line.orderedQty} · Received ${line.receivedQty} · Invoiced ${line.invoicedQty} · ${money(line.lineTotal)}`}
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
  lineBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  row: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  half: {
    flex: 1,
  },
  addLineButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 9,
    backgroundColor: colors.accentSoft,
    alignSelf: 'flex-start' as const,
  },
  addLineButtonText: {
    color: colors.accent,
    fontWeight: '600' as const,
    fontSize: 14,
  },
};
