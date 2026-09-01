import { useMemo, useState } from 'react';
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
import type { Product, PurchaseInvoice, Supplier } from '@marble/types';
import {
  discountPayload,
  DiscountInput,
  EMPTY_DISCOUNT,
  type DiscountDraft,
} from '../../components/DiscountInput';
import { FormField, FormPicker } from '../../components/FormField';
import { FilterChips, RecordRow } from '../../components/Finance';
import { Pagination, SearchBox, Toast } from '../../components/ListControls';
import { ScreenScroll } from '../../components/ScreenScroll';
import { SearchablePicker } from '../../components/SearchablePicker';
import { apiPost } from '../../lib/api';
import { dueDateIso, todayIso } from '../../lib/dates';
import {
  searchItems,
  useFlash,
  usePagination,
  usePolledList,
} from '../../lib/useCollection';
import { colors, ui } from '../../lib/ui';
import { money } from '../../lib/format';

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

type Filter =
  | 'all'
  | 'draft'
  | 'posted'
  | 'partially_paid'
  | 'paid'
  | 'cancelled';

const num = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function PurchaseInvoicesScreen() {
  const params = useLocalSearchParams<{ supplierId?: string }>();
  const router = useRouter();
  const listPath = params.supplierId
    ? `/purchase-invoices?supplierId=${params.supplierId}`
    : '/purchase-invoices';
  const { items, loading, error, setError, reload } =
    usePolledList<PurchaseInvoice>(listPath);
  const { items: suppliers } = usePolledList<Supplier>('/suppliers');
  const { items: products } = usePolledList<Product>('/products');
  const { flash, notify } = useFlash();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState(params.supplierId ?? '');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(dueDateIso());
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>([{ ...EMPTY_LINE }]);
  const [documentDiscount, setDocumentDiscount] = useState<DiscountDraft>({
    ...EMPTY_DISCOUNT,
  });
  const totals = useMemo(
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
  const filtered = useMemo(() => {
    const byStatus =
      filter === 'all' ? items : items.filter((item) => item.status === filter);
    return searchItems(byStatus, query);
  }, [items, filter, query]);
  const pager = usePagination(filtered, `${filter}:${query}`);
  const activeSuppliers = useMemo(
    () =>
      suppliers
        .filter((item) => item.active)
        .map((item) => ({ id: item.id, label: item.name })),
    [suppliers],
  );
  const supplierProducts = products.filter(
    (product) => product.supplierId === supplierId,
  );
  const productOptions = supplierProducts.map((item) => ({
    id: item.id,
    label: item.name,
  }));

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

  function resetForm() {
    setShowForm(false);
    setSupplierId(params.supplierId ?? '');
    setSupplierInvoiceNumber('');
    setIssueDate(todayIso());
    setDueDate(dueDateIso());
    setTaxInclusive(false);
    setLines([{ ...EMPTY_LINE }]);
    setDocumentDiscount({ ...EMPTY_DISCOUNT });
  }

  async function create() {
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
    if (!supplierId || !payloadLines.length) return;
    try {
      await apiPost('/purchase-invoices', {
        supplierId,
        issueDate,
        dueDate: dueDate || null,
        supplierInvoiceNumber: supplierInvoiceNumber.trim() || null,
        taxInclusive,
        ...discountPayload(documentDiscount),
        lines: payloadLines,
      });
      resetForm();
      await reload();
      notify('Purchase invoice saved');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save purchase invoice',
      );
    }
  }

  async function post(id: string) {
    try {
      await apiPost(`/purchase-invoices/${id}/post`, {});
      await reload();
      notify('Purchase invoice posted');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not post purchase invoice',
      );
    }
  }

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
        <Text style={ui.title}>Purchase invoices</Text>
        {error ? <Text style={ui.error}>{error}</Text> : null}

        {showForm ? (
          <View style={ui.card}>
            <Text style={ui.cardTitle}>New purchase invoice</Text>
            <FormPicker label="Supplier" first>
              <SearchablePicker
                value={supplierId}
                options={activeSuppliers}
                searchPlaceholder="Search suppliers…"
                emptyText="No suppliers match your search."
                onChange={(value) => {
                  setSupplierId(value);
                  setLines([{ ...EMPTY_LINE }]);
                }}
              />
            </FormPicker>
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
                    emptyText={
                      supplierId
                        ? 'No products match your search.'
                        : 'Select a supplier first.'
                    }
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
                  Line total {money(totals.lineTotals[index] ?? 0)}
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
              Total {money(totals.total)} · Input VAT {money(totals.inputVat)}
            </Text>
            <View style={ui.cardActions}>
              <Pressable style={ui.button} onPress={() => void create()}>
                <Text style={ui.buttonText}>Save draft</Text>
              </Pressable>
              <Pressable style={ui.ghost} onPress={resetForm}>
                <Text style={ui.ghostText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={ui.toolbar}>
              <Text style={ui.count}>{items.length} purchase invoices</Text>
              <Pressable style={ui.button} onPress={() => setShowForm(true)}>
                <Text style={ui.buttonText}>New</Text>
              </Pressable>
            </View>
            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder="Search purchase invoices…"
            />
            <FilterChips
              active={filter}
              onChange={setFilter}
              scrollable
              options={[
                { key: 'all', label: 'All' },
                { key: 'draft', label: 'Draft' },
                { key: 'posted', label: 'Posted' },
                { key: 'partially_paid', label: 'Partially paid' },
                { key: 'paid', label: 'Paid' },
                { key: 'cancelled', label: 'Cancelled' },
              ]}
            />
          </>
        )}

        {pager.paged.map((item) => (
          <RecordRow
            key={item.id}
            title={item.number}
            meta={`${item.supplier?.name || item.supplierId} · ${item.status} · Balance ${item.currency} ${item.balance.toFixed(2)}`}
            onPress={() =>
              router.push(`/module/purchase-invoices/${item.id}` as never)
            }
            onEdit={
              item.status === 'draft'
                ? () =>
                    router.push(
                      `/module/purchase-invoices/${item.id}?edit=1` as never,
                    )
                : undefined
            }
          >
            {item.status === 'draft' ? (
              <Pressable style={ui.ghost} onPress={() => void post(item.id)}>
                <Text style={ui.ghostText}>Post</Text>
              </Pressable>
            ) : null}
          </RecordRow>
        ))}
        {pager.paged.length === 0 ? (
          <View style={ui.empty}>
            <Text style={ui.emptyText}>
              {items.length === 0
                ? 'No purchase invoices found.'
                : 'No purchase invoices match this filter.'}
            </Text>
          </View>
        ) : null}
        <Pagination
          page={pager.page}
          setPage={pager.setPage}
          pageSize={pager.pageSize}
          setPageSize={pager.setPageSize}
          pageCount={pager.pageCount}
          total={pager.total}
        />
      </ScreenScroll>
      <Toast flash={flash} />
    </View>
  );
}

const styles = {
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
