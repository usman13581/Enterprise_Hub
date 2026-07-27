import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { computeQuotationTotals } from '@marble/domain';
import { apiDelete, apiPost, apiPut } from '../../lib/api';
import { day, money } from '../../lib/format';
import {
  searchItems,
  useFlash,
  usePagination,
  usePolledList,
} from '../../lib/useCollection';
import { Pagination, SearchBox, Toast } from '../../components/ListControls';
import {
  ActionButton,
  FilterChips,
  RowActions,
  StatusPill,
} from '../../components/Finance';
import type { Customer, Product, Quotation } from '../../lib/types';
import { colors, ui } from '../../lib/ui';

type Filter = 'all' | 'draft' | 'approved' | 'cancelled';

type LineDraft = {
  description: string;
  unit: string;
  qty: string;
  purchasePrice: string;
  sellPrice: string;
  productId: string;
};

type Draft = {
  customerId: string;
  title: string;
  notes: string;
  lines: LineDraft[];
};

const EMPTY_LINE: LineDraft = {
  description: '',
  unit: 'sqm',
  qty: '1',
  purchasePrice: '0',
  sellPrice: '0',
  productId: '',
};

const EMPTY: Draft = {
  customerId: '',
  title: '',
  notes: '',
  lines: [{ ...EMPTY_LINE }],
};

const num = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function QuotationsScreen() {
  const { items, loading, error, setError, reload } =
    usePolledList<Quotation>('/quotations');
  const { items: customers } = usePolledList<Customer>('/customers', 20000);
  const { items: products } = usePolledList<Product>('/products', 20000);
  const { flash, notify } = useFlash();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const byStatus =
      filter === 'all' ? items : items.filter((item) => item.status === filter);
    return searchItems(byStatus, query);
  }, [items, filter, query]);
  const pager = usePagination(filtered);

  const payloadLines = draft.lines.map((line) => ({
    productId: line.productId || null,
    description: line.description.trim(),
    unit: line.unit.trim() || 'sqm',
    qty: num(line.qty),
    purchasePrice: num(line.purchasePrice),
    sellPrice: num(line.sellPrice),
  }));
  const totals = computeQuotationTotals(payloadLines);

  function startCreate() {
    setDraft({ ...EMPTY, lines: [{ ...EMPTY_LINE }] });
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(quotation: Quotation) {
    setDraft({
      customerId: quotation.customerId,
      title: quotation.title ?? '',
      notes: quotation.notes ?? '',
      lines: quotation.lines.map((line) => ({
        productId: line.productId ?? '',
        description: line.description,
        unit: line.unit,
        qty: String(line.qty),
        purchasePrice: String(line.purchasePrice),
        sellPrice: String(line.sellPrice),
      })),
    });
    setEditingId(quotation.id);
    setShowForm(true);
  }

  async function save() {
    if (saving || !draft.customerId) return;
    setSaving(true);
    try {
      const body = {
        customerId: draft.customerId,
        title: draft.title,
        notes: draft.notes,
        lines: payloadLines,
      };
      if (editingId) await apiPut(`/quotations/${editingId}`, body);
      else await apiPost('/quotations', body);
      setShowForm(false);
      await reload();
      notify(editingId ? 'Quotation saved' : 'Quotation created');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function act(id: string, action: 'approve' | 'cancel', text: string) {
    try {
      await apiPost(`/quotations/${id}/${action}`, {});
      await reload();
      notify(text, action === 'cancel' ? 'danger' : 'success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    }
  }

  function patchLine(index: number, changes: Partial<LineDraft>) {
    setDraft({
      ...draft,
      lines: draft.lines.map((line, i) =>
        i === index ? { ...line, ...changes } : line,
      ),
    });
  }

  function pickProduct(index: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      patchLine(index, { productId: '' });
      return;
    }
    patchLine(index, {
      productId,
      description: draft.lines[index].description || product.name,
      unit: product.unit,
      purchasePrice: String(product.purchasePrice),
      sellPrice: String(product.sellPrice),
    });
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
      <ScrollView contentContainerStyle={ui.content}>
        <Text style={ui.title}>Quotations</Text>
        <Text style={ui.lede}>
          Adjust line purchase and sell. Approve opens a job.
        </Text>
        {error ? <Text style={ui.error}>{error}</Text> : null}

        {showForm ? (
          <View style={ui.card}>
            <Text style={ui.cardTitle}>
              {editingId ? 'Edit quotation' : 'New quotation'}
            </Text>
            <Text style={ui.label}>Customer *</Text>
            <View style={styles.picker}>
              {customers.map((customer) => (
                <Pressable
                  key={customer.id}
                  style={[
                    styles.option,
                    draft.customerId === customer.id && styles.optionActive,
                  ]}
                  onPress={() =>
                    setDraft({ ...draft, customerId: customer.id })
                  }
                >
                  <Text
                    style={[
                      styles.optionText,
                      draft.customerId === customer.id &&
                        styles.optionTextActive,
                    ]}
                  >
                    {customer.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={ui.label}>Subject</Text>
            <TextInput
              style={ui.input}
              value={draft.title}
              onChangeText={(title) => setDraft({ ...draft, title })}
              placeholder="Villa flooring…"
              placeholderTextColor={colors.soft}
            />

            {draft.lines.map((line, index) => (
              <View key={index} style={styles.lineBox}>
                <Text style={ui.label}>Line {index + 1}</Text>
                <TextInput
                  style={ui.input}
                  value={line.description}
                  onChangeText={(description) =>
                    patchLine(index, { description })
                  }
                  placeholder="Description"
                  placeholderTextColor={colors.soft}
                />
                {products.length > 0 ? (
                  <View style={styles.picker}>
                    {products.slice(0, 8).map((product) => (
                      <Pressable
                        key={product.id}
                        style={[
                          styles.option,
                          line.productId === product.id && styles.optionActive,
                        ]}
                        onPress={() => pickProduct(index, product.id)}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            line.productId === product.id &&
                              styles.optionTextActive,
                          ]}
                        >
                          {product.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <View style={styles.row}>
                  <TextInput
                    style={[ui.input, styles.half]}
                    value={line.qty}
                    onChangeText={(qty) => patchLine(index, { qty })}
                    keyboardType="decimal-pad"
                    placeholder="Qty"
                    placeholderTextColor={colors.soft}
                  />
                  <TextInput
                    style={[ui.input, styles.half]}
                    value={line.unit}
                    onChangeText={(unit) => patchLine(index, { unit })}
                    placeholder="Unit"
                    placeholderTextColor={colors.soft}
                  />
                </View>
                <View style={styles.row}>
                  <TextInput
                    style={[ui.input, styles.half]}
                    value={line.purchasePrice}
                    onChangeText={(purchasePrice) =>
                      patchLine(index, { purchasePrice })
                    }
                    keyboardType="decimal-pad"
                    placeholder="Purchase"
                    placeholderTextColor={colors.soft}
                  />
                  <TextInput
                    style={[ui.input, styles.half]}
                    value={line.sellPrice}
                    onChangeText={(sellPrice) =>
                      patchLine(index, { sellPrice })
                    }
                    keyboardType="decimal-pad"
                    placeholder="Sell"
                    placeholderTextColor={colors.soft}
                  />
                </View>
                <Text style={ui.cardMeta}>
                  Line total {money(totals.lineTotals[index] ?? 0)}
                </Text>
                {draft.lines.length > 1 ? (
                  <Pressable
                    onPress={() =>
                      setDraft({
                        ...draft,
                        lines: draft.lines.filter((_, i) => i !== index),
                      })
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
              style={[ui.ghost, { marginTop: 12, alignSelf: 'flex-start' }]}
              onPress={() =>
                setDraft({
                  ...draft,
                  lines: [...draft.lines, { ...EMPTY_LINE }],
                })
              }
            >
              <Text style={ui.ghostText}>+ Add line</Text>
            </Pressable>

            <Text style={[ui.cardMeta, { marginTop: 12 }]}>
              Subtotal {money(totals.subtotal)} · VAT {money(totals.vatAmount)}{' '}
              · Total {money(totals.total)} · Margin {money(totals.profit)}
            </Text>

            <Text style={ui.label}>Notes</Text>
            <TextInput
              style={ui.input}
              value={draft.notes}
              onChangeText={(notes) => setDraft({ ...draft, notes })}
              multiline
            />

            <RowActions>
              <ActionButton
                label={saving ? 'Saving…' : editingId ? 'Save' : 'Create'}
                tone="primary"
                disabled={saving}
                onPress={() => void save()}
              />
              <ActionButton
                label="Cancel"
                onPress={() => setShowForm(false)}
              />
            </RowActions>
          </View>
        ) : (
          <>
            <View style={ui.toolbar}>
              <Text style={ui.count}>{items.length} quotations</Text>
              <Pressable
                style={ui.button}
                onPress={startCreate}
                disabled={customers.length === 0}
              >
                <Text style={ui.buttonText}>New</Text>
              </Pressable>
            </View>

            <FilterChips
              active={filter}
              onChange={setFilter}
              options={[
                { key: 'all', label: 'All' },
                { key: 'draft', label: 'Draft' },
                { key: 'approved', label: 'Approved' },
                { key: 'cancelled', label: 'Cancelled' },
              ]}
            />

            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder="Search quotations…"
            />

            {filtered.length === 0 ? (
              <View style={ui.empty}>
                <Text style={ui.emptyText}>
                  {items.length === 0
                    ? 'No quotations yet.'
                    : 'No quotations match this filter.'}
                </Text>
              </View>
            ) : (
              pager.paged.map((quotation) => (
                <View key={quotation.id} style={ui.card}>
                  <View style={styles.cardHead}>
                    <Text style={ui.cardTitle}>{quotation.number}</Text>
                    <StatusPill status={quotation.status} />
                  </View>
                  <Text style={ui.cardMeta}>
                    {quotation.customer?.name ?? '—'} ·{' '}
                    {quotation.title || 'No subject'}
                  </Text>
                  <Text style={ui.cardMeta}>
                    {money(quotation.total)} · margin {money(quotation.profit)}{' '}
                    · {day(quotation.createdAt)}
                  </Text>
                  {quotation.job ? (
                    <Text style={ui.tag}>Job {quotation.job.number}</Text>
                  ) : null}
                  {quotation.status === 'draft' ? (
                    <RowActions>
                      <ActionButton
                        label="Edit"
                        onPress={() => startEdit(quotation)}
                      />
                      <ActionButton
                        label="Approve"
                        tone="primary"
                        onPress={() =>
                          void act(
                            quotation.id,
                            'approve',
                            'Approved — job created',
                          )
                        }
                      />
                      <ActionButton
                        label="Cancel"
                        tone="danger"
                        onPress={() =>
                          void act(
                            quotation.id,
                            'cancel',
                            'Quotation cancelled',
                          )
                        }
                      />
                      <ActionButton
                        label="Delete"
                        tone="danger"
                        onPress={() =>
                          void apiDelete(`/quotations/${quotation.id}`)
                            .then(() => reload())
                            .then(() => notify('Deleted', 'danger'))
                            .catch((e) =>
                              setError(
                                e instanceof Error
                                  ? e.message
                                  : 'Delete failed',
                              ),
                            )
                        }
                      />
                    </RowActions>
                  ) : null}
                </View>
              ))
            )}

            <Pagination
              page={pager.page}
              setPage={pager.setPage}
              pageSize={pager.pageSize}
              setPageSize={pager.setPageSize}
              pageCount={pager.pageCount}
              total={pager.total}
            />
          </>
        )}
      </ScrollView>
      <Toast flash={flash} />
    </View>
  );
}

const styles = {
  cardHead: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  picker: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 6,
  },
  option: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(20,32,43,0.14)',
    backgroundColor: colors.surface,
  },
  optionActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  optionText: { color: colors.muted, fontSize: 13 },
  optionTextActive: { color: colors.accent, fontWeight: '700' as const },
  lineBox: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  row: { flexDirection: 'row' as const, gap: 8, marginTop: 8 },
  half: { flex: 1 },
};
