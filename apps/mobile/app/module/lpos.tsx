import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';
import type { Lpo, Product, Supplier } from '@marble/types';
import { Pagination, SearchBox, Toast } from '../../components/ListControls';
import { RecordRow } from '../../components/Finance';
import { ScreenScroll } from '../../components/ScreenScroll';
import { FormField, FormPicker } from '../../components/FormField';
import { SearchablePicker } from '../../components/SearchablePicker';
import { apiPost } from '../../lib/api';
import {
  searchItems,
  useFlash,
  usePagination,
  usePolledList,
} from '../../lib/useCollection';
import { colors, ui } from '../../lib/ui';

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
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState(params.supplierId ?? '');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [unitCost, setUnitCost] = useState('0');
  const filtered = useMemo(() => searchItems(items, query), [items, query]);
  const pager = usePagination(filtered, query);
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

  async function create() {
    const product = products.find((item) => item.id === productId);
    if (!supplierId || !product || Number(qty) <= 0 || Number(unitCost) < 0) {
      return;
    }
    try {
      await apiPost('/lpos', {
        supplierId,
        lines: [
          {
            productId,
            productName: product.name,
            unit: product.unit,
            orderedQty: Number(qty),
            unitCost: Number(unitCost),
          },
        ],
      });
      setShowForm(false);
      setSupplierId(params.supplierId ?? '');
      setProductId('');
      await reload();
      notify('LPO created');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create LPO');
    }
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
        <Text style={ui.lede}>Supplier commitments and receipt tracking.</Text>
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
                  setProductId('');
                }}
              />
            </FormPicker>
            <FormPicker label="Product">
              <SearchablePicker
                value={productId}
                options={productOptions}
                searchPlaceholder="Search products…"
                emptyText={
                  supplierId
                    ? 'No products match your search.'
                    : 'Select a supplier first.'
                }
                onChange={(value) => {
                  const product = products.find((item) => item.id === value);
                  setProductId(value);
                  setUnitCost(String(product?.purchasePrice ?? 0));
                }}
              />
            </FormPicker>
            <FormField
              label="Quantity"
              keyboardType="decimal-pad"
              value={qty}
              onChangeText={setQty}
            />
            <FormField
              label="Unit cost"
              keyboardType="decimal-pad"
              value={unitCost}
              onChangeText={setUnitCost}
            />
            <View style={ui.cardActions}>
              <Pressable style={ui.button} onPress={() => void create()}>
                <Text style={ui.buttonText}>Create LPO</Text>
              </Pressable>
              <Pressable style={ui.ghost} onPress={() => setShowForm(false)}>
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
          >
            {item.status === 'draft' ? (
              <Pressable
                style={ui.ghost}
                onPress={() => void transition(item.id, 'approve')}
              >
                <Text style={ui.ghostText}>Approve</Text>
              </Pressable>
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
            <Text style={ui.emptyText}>No LPOs found.</Text>
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
