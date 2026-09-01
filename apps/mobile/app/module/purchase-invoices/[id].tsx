import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { computePurchasingTotals } from '@marble/domain';
import type { DiscountMode, Product, PurchaseInvoice } from '@marble/types';
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
import { Toast } from '../../../components/ListControls';
import { apiFetch, apiPost, apiPut } from '../../../lib/api';
import { dateInputValue } from '../../../lib/dates';
import { useFlash, usePolledList } from '../../../lib/useCollection';
import { money } from '../../../lib/format';
import { colors, ui } from '../../../lib/ui';

type Detail = PurchaseInvoice & {
  taxInclusive: boolean;
  supplier: { id: string; name: string };
  lines: Array<{
    id: string;
    productId: string | null;
    productName: string;
    unit: string;
    qty: number;
    unitCost: number;
    discountMode: DiscountMode;
    discountValue: number;
    lineTotal: number;
  }>;
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

function linesToDraft(lines: Detail['lines']): LineDraft[] {
  return lines.map((line) => ({
    productId: line.productId ?? '',
    productName: line.productName,
    unit: line.unit,
    qty: String(line.qty),
    unitCost: String(line.unitCost),
    discountMode: line.discountMode,
    discountValue: String(line.discountValue ?? 0),
  }));
}

export default function PurchaseInvoiceDetailScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const router = useRouter();
  const { flash, notify } = useFlash();
  const { items: products } = usePolledList<Product>('/products');
  const [invoice, setInvoice] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(edit === '1');
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>([{ ...EMPTY_LINE }]);
  const [documentDiscount, setDocumentDiscount] = useState<DiscountDraft>({
    ...EMPTY_DISCOUNT,
  });
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [taxInclusive, setTaxInclusive] = useState(false);

  async function reload() {
    try {
      setInvoice(await apiFetch<Detail>(`/purchase-invoices/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load purchase invoice');
    }
  }

  useEffect(() => {
    if (id) void reload();
  }, [id]);

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
        { taxInclusive },
      ),
    [lines, documentDiscount, taxInclusive],
  );

  const productOptions = products
    .filter((product) => product.supplierId === invoice?.supplierId)
    .map((item) => ({ id: item.id, label: item.name }));

  function startEdit() {
    if (!invoice) return;
    setLines(
      invoice.lines.length ? linesToDraft(invoice.lines) : [{ ...EMPTY_LINE }],
    );
    setDocumentDiscount(
      discountFromStored(invoice.discountMode, invoice.discountValue),
    );
    setSupplierInvoiceNumber(invoice.supplierInvoiceNumber ?? '');
    setIssueDate(dateInputValue(invoice.issueDate));
    setDueDate(dateInputValue(invoice.dueDate));
    setTaxInclusive(invoice.taxInclusive);
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

  async function saveDraft() {
    if (!invoice || saving) return;
    const payloadLines = lines
      .map((line) => ({
        productId: line.productId || null,
        productName: line.productName.trim(),
        unit: line.unit.trim() || 'unit',
        qty: num(line.qty),
        unitCost: num(line.unitCost),
        discountMode: line.discountMode,
        discountValue: num(line.discountValue),
      }))
      .filter((line) => line.productName && line.qty > 0);
    if (!payloadLines.length) return;
    setSaving(true);
    setError(null);
    try {
      await apiPut(`/purchase-invoices/${id}`, {
        lpoId: invoice.lpoId,
        supplierInvoiceNumber: supplierInvoiceNumber.trim() || null,
        issueDate: issueDate || invoice.issueDate,
        dueDate: dueDate || null,
        taxInclusive,
        ...discountPayload(documentDiscount),
        lines: payloadLines,
      });
      setEditing(false);
      await reload();
      notify('Purchase invoice saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save purchase invoice');
    } finally {
      setSaving(false);
    }
  }

  async function post() {
    try {
      await apiPost(`/purchase-invoices/${id}/post`, {});
      await reload();
      notify('Purchase invoice posted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post purchase invoice');
    }
  }

  if (error && !invoice) {
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

  if (editing && invoice.status === 'draft') {
    return (
      <View style={ui.screen}>
        <ScreenScroll>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Purchase invoices</Text>
          </Pressable>
          <Text style={ui.title}>Edit {invoice.number}</Text>
          <Text style={ui.lede}>{invoice.supplier.name}</Text>
          {error ? <Text style={ui.error}>{error}</Text> : null}
          <FormField
            label="Supplier invoice no."
            value={supplierInvoiceNumber}
            onChangeText={setSupplierInvoiceNumber}
          />
          <FormField
            label="Issue date (YYYY-MM-DD)"
            value={issueDate}
            onChangeText={setIssueDate}
          />
          <FormField
            label="Due date (YYYY-MM-DD)"
            value={dueDate}
            onChangeText={setDueDate}
          />
          <View style={styles.switchRow}>
            <Text style={ui.label}>Prices include input VAT</Text>
            <Switch value={taxInclusive} onValueChange={setTaxInclusive} />
          </View>

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
            Total {money(editTotals.total)} · Input VAT {money(editTotals.inputVat)}
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
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Purchase invoices</Text>
        </Pressable>
        <Text style={ui.title}>{invoice.number}</Text>
        <Text style={ui.lede}>
          {invoice.supplier.name} · {invoice.status}
        </Text>
        {error ? <Text style={ui.error}>{error}</Text> : null}
        {invoice.status === 'draft' ? (
          <View style={ui.cardActions}>
            <Pressable style={ui.ghost} onPress={startEdit}>
              <Text style={ui.ghostText}>Edit</Text>
            </Pressable>
            <Pressable style={ui.button} onPress={() => void post()}>
              <Text style={ui.buttonText}>Post invoice</Text>
            </Pressable>
          </View>
        ) : null}
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
  switchRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 8,
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
