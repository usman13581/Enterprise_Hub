import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { computePurchasingTotals } from '@marble/domain';
import type { Lpo, Product, Supplier } from '@marble/types';
import {
  discountPayload,
  DiscountInput,
  EMPTY_DISCOUNT,
  type DiscountDraft,
} from '../../components/DiscountInput';
import { Pagination, SearchBox, Toast } from '../../components/ListControls';
import { FilterChips, RecordRow } from '../../components/Finance';
import { ScreenScroll } from '../../components/ScreenScroll';
import { FormField, FormPicker } from '../../components/FormField';
import { SearchablePicker } from '../../components/SearchablePicker';
import { apiDelete, apiPost } from '../../lib/api';
import { useCompanyAdmin } from '../../lib/useCompanyAdmin';
import {
  searchItems,
  useFlash,
  usePagination,
  usePolledList,
} from '../../lib/useCollection';
import { dueDateIso } from '../../lib/dates';
import { money } from '../../lib/format';
import { colors, ui } from '../../lib/ui';

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
  | 'approved'
  | 'sent'
  | 'partially_received'
  | 'closed'
  | 'cancelled';

const num = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function LposScreen() {
  const params = useLocalSearchParams<{ supplierId?: string }>();
  const router = useRouter();
  const listPath = params.supplierId
    ? `/lpos?supplierId=${params.supplierId}`
    : '/lpos';
  const { items, loading, error, setError, reload } =
    usePolledList<Lpo>(listPath);
  const { items: suppliers } = usePolledList<Supplier>('/suppliers');
  const { items: products } = usePolledList<Product>('/products');
  const { flash, notify } = useFlash();
  const isAdmin = useCompanyAdmin();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState(params.supplierId ?? '');
  const [requestedDeliveryDate, setRequestedDeliveryDate] =
    useState(dueDateIso());
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
      ),
    [lines, documentDiscount],
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
  const availableProducts = products.filter(
    (product) => product.supplierId === supplierId,
  );
  const productOptions = availableProducts.map((item) => ({
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
    setRequestedDeliveryDate(dueDateIso());
    setLines([{ ...EMPTY_LINE }]);
    setDocumentDiscount({ ...EMPTY_DISCOUNT });
  }

  async function create() {
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
    if (!supplierId || payloadLines.length === 0) {
      return;
    }
    try {
      await apiPost('/lpos', {
        supplierId,
        requestedDeliveryDate: requestedDeliveryDate || null,
        ...discountPayload(documentDiscount),
        lines: payloadLines,
      });
      resetForm();
      await reload();
      notify('LPO created');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create LPO');
    }
  }

  async function deleteDraft(id: string) {
    try {
      await apiDelete(`/lpos/${id}`);
      await reload();
      notify('LPO deleted', 'danger');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete LPO');
    }
  }

  function confirmDeleteDraft(id: string) {
    Alert.alert(
      'Delete draft?',
      'This permanently removes the LPO. This cannot be undone.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void deleteDraft(id),
        },
      ],
    );
  }

  async function transition(
    id: string,
    action: 'approve' | 'send' | 'cancel',
  ) {
    try {
      await apiPost(`/lpos/${id}/${action}`, {});
      await reload();
      notify(`LPO ${action}d`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${action} LPO`);
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
        <Text style={ui.title}>Purchase Orders</Text>
        {error ? <Text style={ui.error}>{error}</Text> : null}

        {showForm ? (
          <View style={ui.card}>
            <Text style={ui.cardTitle}>New LPO</Text>
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
              label="Requested delivery (YYYY-MM-DD)"
              value={requestedDeliveryDate}
              onChangeText={setRequestedDeliveryDate}
              placeholder={dueDateIso()}
            />

            {lines.map((line, index) => (
              <View key={index} style={styles.lineBox}>
                <Text style={ui.label}>Line {index + 1}</Text>
                <FormPicker label="Product (optional)">
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
                <FormField
                  label="Description"
                  value={line.productName}
                  onChangeText={(productName) =>
                    patchLine(index, { productName })
                  }
                />
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
                <Text style={ui.buttonText}>Create LPO</Text>
              </Pressable>
              <Pressable style={ui.ghost} onPress={resetForm}>
                <Text style={ui.ghostText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={ui.toolbar}>
              <Text style={ui.count}>{items.length} LPOs</Text>
              <Pressable style={ui.button} onPress={() => setShowForm(true)}>
                <Text style={ui.buttonText}>New LPO</Text>
              </Pressable>
            </View>
            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder="Search LPOs…"
            />
            <FilterChips
              active={filter}
              onChange={setFilter}
              scrollable
              options={[
                { key: 'all', label: 'All' },
                { key: 'draft', label: 'Draft' },
                { key: 'approved', label: 'Approved' },
                { key: 'sent', label: 'Sent' },
                { key: 'partially_received', label: 'Partially received' },
                { key: 'closed', label: 'Closed' },
                { key: 'cancelled', label: 'Cancelled' },
              ]}
            />
          </>
        )}

        {pager.paged.map((item) => (
          <RecordRow
            key={item.id}
            title={item.number}
            meta={`${item.supplier?.name || item.supplierId} · ${item.status} · ${item.currency} ${item.total.toFixed(2)}`}
            onPress={() =>
              router.push(`/module/purchase-orders/${item.id}` as never)
            }
            onEdit={
              item.status === 'draft'
                ? () =>
                    router.push(
                      `/module/purchase-orders/${item.id}?edit=1` as never,
                    )
                : undefined
            }
          >
            {item.status === 'draft' ? (
              <>
                <Pressable
                  style={ui.ghost}
                  onPress={() => void transition(item.id, 'approve')}
                >
                  <Text style={ui.ghostText}>Approve</Text>
                </Pressable>
                {isAdmin ? (
                  <Pressable
                    style={ui.ghost}
                    onPress={() => confirmDeleteDraft(item.id)}
                  >
                    <Text style={[ui.ghostText, ui.dangerText]}>Delete</Text>
                  </Pressable>
                ) : null}
              </>
            ) : item.status === 'approved' ? (
              <Pressable
                style={ui.ghost}
                onPress={() => void transition(item.id, 'send')}
              >
                <Text style={ui.ghostText}>Send</Text>
              </Pressable>
            ) : item.status === 'sent' ? (
              <Pressable
                style={ui.ghost}
                onPress={() => void transition(item.id, 'cancel')}
              >
                <Text style={ui.ghostText}>Cancel</Text>
              </Pressable>
            ) : null}
          </RecordRow>
        ))}
        {pager.paged.length === 0 ? (
          <View style={ui.empty}>
            <Text style={ui.emptyText}>
              {items.length === 0
                ? 'No LPOs found.'
                : 'No LPOs match this filter.'}
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
