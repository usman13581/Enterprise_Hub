import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { computeCounterTopTotals, resolveCounterTopSectionAmount } from '@marble/domain';
import { QUOTATION_KIND_LABELS, type QuotationLookup } from '@marble/types';
import { apiFetch, apiPost, apiPut } from '../../lib/api';
import { money } from '../../lib/format';
import { usePolledList } from '../../lib/useCollection';
import { ScreenScroll } from '../../components/ScreenScroll';
import { LookupAttachPicker } from '../../components/LookupAttachPicker';
import { ActionButton, BackLink, RowActions } from '../../components/Finance';
import type { Customer, Product, Quotation } from '../../lib/types';
import { colors, ui } from '../../lib/ui';

type ItemDraft = { label: string; value: string; amount: string };
type SectionDraft = {
  productId: string;
  productName: string;
  amount: string;
  items: ItemDraft[];
};

const EMPTY_ITEM: ItemDraft = { label: '', value: '', amount: '' };

function sumSpecItemAmounts(items: ItemDraft[]): number {
  return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

function sectionAmountFromItems(
  items: ItemDraft[],
  storedSectionAmount = 0,
): number {
  const itemSum = sumSpecItemAmounts(items);
  return itemSum > 0 ? itemSum : storedSectionAmount;
}

export default function CounterTopQuotationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ edit?: string }>();
  const editId = typeof params.edit === 'string' ? params.edit : undefined;
  const { items: customers } = usePolledList<Customer>('/customers', 20000);
  const { items: products } = usePolledList<Product>('/products', 20000);
  const [customerId, setCustomerId] = useState('');
  const [title, setTitle] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [location, setLocation] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');
  const [lookupIds, setLookupIds] = useState<string[]>([]);
  const [lookups, setLookups] = useState<QuotationLookup[]>([]);
  const [specLabels, setSpecLabels] = useState<QuotationLookup[]>([]);
  const [sections, setSections] = useState<SectionDraft[]>([
    {
      productId: '',
      productName: '',
      amount: '0',
      items: [{ ...EMPTY_ITEM }],
    },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(editId));

  useEffect(() => {
    void apiFetch<QuotationLookup[]>('/quotation-lookups?category=spec')
      .then(setSpecLabels)
      .catch(() => setSpecLabels([]));
  }, []);

  useEffect(() => {
    void apiFetch<QuotationLookup[]>(
      '/quotation-lookups?appliesTo=counter_top&activeOnly=1',
    ).then(setLookups);
  }, []);

  useEffect(() => {
    if (!editId) return;
    void apiFetch<Quotation>(`/quotations/${editId}`)
      .then((quotation) => {
        if (quotation.kind !== 'counter_top') {
          setError('This quotation is not a Counter Top quote');
          return;
        }
        setCustomerId(quotation.customerId);
        setTitle(quotation.title ?? '');
        setContactName(quotation.contactName ?? '');
        setContactPhone(quotation.contactPhone ?? '');
        setLocation(quotation.location ?? '');
        setValidUntil(quotation.validUntil?.slice(0, 10) ?? '');
        setDiscount(String(quotation.discount ?? 0));
        setNotes(quotation.notes ?? '');
        setLookupIds((quotation.lookups ?? []).map((l) => l.id));
        setSections(
          (quotation.sections ?? []).map((section) => ({
            productId: section.productId ?? '',
            productName: section.productName,
            amount: String(section.amount),
            items: section.items.length
              ? section.items.map((item) => ({
                  label: item.label,
                  value: item.value,
                  amount: String(item.amount ?? 0),
                }))
              : [{ ...EMPTY_ITEM }],
          })),
        );
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load'),
      )
      .finally(() => setLoading(false));
  }, [editId]);

  const totals = useMemo(
    () =>
      computeCounterTopTotals(
        sections.map((section) =>
          sectionAmountFromItems(section.items, Number(section.amount) || 0),
        ),
        Number(discount) || 0,
      ),
    [sections, discount],
  );

  function patchSection(index: number, changes: Partial<SectionDraft>) {
    setSections((prev) =>
      prev.map((section, i) =>
        i === index ? { ...section, ...changes } : section,
      ),
    );
  }

  async function save() {
    if (saving || !customerId) return;
    if (sections.some((s) => !s.productName.trim())) {
      setError('Each section needs a product name');
      return;
    }
    setSaving(true);
    setError(null);
    const body = {
      kind: 'counter_top' as const,
      customerId,
      title,
      notes,
      contactName,
      contactPhone,
      location,
      validUntil: validUntil || null,
      discount: Number(discount) || 0,
      lookupIds,
      lines: [],
      sections: sections.map((section) => {
        const items = section.items
          .filter((item) => item.label.trim())
          .map((item) => ({
            label: item.label.trim(),
            value: item.value.trim(),
            amount: Number(item.amount) || 0,
          }));
        return {
          productId: section.productId || null,
          productName: section.productName.trim(),
          amount: resolveCounterTopSectionAmount(
            items,
            Number(section.amount) || 0,
          ),
          items,
        };
      }),
    };
    try {
      if (editId) await apiPut(`/quotations/${editId}`, body);
      else await apiPost('/quotations', body);
      router.replace('/module/quotations' as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <ScreenScroll>
        <BackLink
          label="← Back to quotations"
          onPress={() => router.push('/module/quotations' as never)}
        />
        <Text style={ui.title}>
          {editId ? 'Edit ' : ''}
          {QUOTATION_KIND_LABELS.counter_top}
        </Text>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll>
      <BackLink
        label="← Back to quotations"
        onPress={() => router.push('/module/quotations' as never)}
      />
      <Text style={ui.title}>
        {editId ? 'Edit ' : ''}
        {QUOTATION_KIND_LABELS.counter_top}
      </Text>
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <View style={ui.card}>
        <Text style={ui.label}>Customer *</Text>
        <View style={styles.picker}>
          {customers.map((customer) => (
            <Pressable
              key={customer.id}
              style={[
                styles.option,
                customerId === customer.id && styles.optionActive,
              ]}
              onPress={() => setCustomerId(customer.id)}
            >
              <Text
                style={[
                  styles.optionText,
                  customerId === customer.id && styles.optionTextActive,
                ]}
              >
                {customer.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={ui.label}>Subject</Text>
        <TextInput style={ui.input} value={title} onChangeText={setTitle} />
        <Text style={ui.label}>Attn</Text>
        <TextInput
          style={ui.input}
          value={contactName}
          onChangeText={setContactName}
        />
        <Text style={ui.label}>Phone</Text>
        <TextInput
          style={ui.input}
          value={contactPhone}
          onChangeText={setContactPhone}
        />
        <Text style={ui.label}>Location</Text>
        <TextInput
          style={ui.input}
          value={location}
          onChangeText={setLocation}
        />
        <Text style={ui.label}>Valid until (YYYY-MM-DD)</Text>
        <TextInput
          style={ui.input}
          value={validUntil}
          onChangeText={setValidUntil}
        />
      </View>

      {sections.map((section, sectionIndex) => (
        <View key={sectionIndex} style={ui.card}>
          <Text style={ui.cardTitle}>Section {sectionIndex + 1}</Text>
          <Text style={ui.label}>Catalog product</Text>
          <View style={styles.picker}>
            <Pressable
              style={[styles.option, !section.productId && styles.optionActive]}
              onPress={() =>
                patchSection(sectionIndex, { productId: '', productName: section.productName })
              }
            >
              <Text style={styles.optionText}>Custom</Text>
            </Pressable>
            {products.map((product) => (
              <Pressable
                key={product.id}
                style={[
                  styles.option,
                  section.productId === product.id && styles.optionActive,
                ]}
                onPress={() => {
                  const section = sections[sectionIndex];
                  const productItem = products.find((p) => p.id === product.id);
                  const items =
                    productItem &&
                    sumSpecItemAmounts(section.items) === 0 &&
                    productItem.sellPrice > 0
                      ? section.items.map((item, i) =>
                          i === 0
                            ? {
                                ...item,
                                amount: String(productItem.sellPrice),
                              }
                            : item,
                        )
                      : section.items;
                  patchSection(sectionIndex, {
                    productId: product.id,
                    productName: product.name,
                    items,
                  });
                }}
              >
                <Text style={styles.optionText}>{product.name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={ui.label}>Product name *</Text>
          <TextInput
            style={ui.input}
            value={section.productName}
            onChangeText={(productName) =>
              patchSection(sectionIndex, { productName, productId: '' })
            }
          />
          <Text style={[ui.label, { marginTop: 12 }]}>Spec items</Text>
          <View style={styles.picker}>
            {specLabels.map((row) => (
              <Pressable
                key={row.id}
                style={styles.option}
                onPress={() => {
                  const items = [...section.items];
                  const emptyIndex = items.findIndex((r) => !r.label.trim());
                  const hint = row.body !== '—' ? row.body : '';
                  if (emptyIndex >= 0) {
                    items[emptyIndex] = {
                      label: row.title,
                      value: hint || items[emptyIndex].value,
                      amount: items[emptyIndex].amount,
                    };
                  } else {
                    items.push({ label: row.title, value: hint, amount: '' });
                  }
                  patchSection(sectionIndex, { items });
                }}
              >
                <Text style={styles.optionText}>{row.title}</Text>
              </Pressable>
            ))}
          </View>
          {section.items.map((item, itemIndex) => (
            <View key={itemIndex} style={{ marginTop: 8 }}>
              <TextInput
                style={ui.input}
                placeholder="Type — pick above or type new"
                placeholderTextColor={colors.soft}
                value={item.label}
                onChangeText={(label) => {
                  const items = section.items.map((row, i) =>
                    i === itemIndex ? { ...row, label } : row,
                  );
                  patchSection(sectionIndex, { items });
                }}
                onBlur={() => {
                  const key = item.label.trim().toLowerCase();
                  const match = specLabels.find(
                    (row) => row.title.trim().toLowerCase() === key,
                  );
                  if (match && match.body !== '—' && !item.value.trim()) {
                    const items = section.items.map((row, i) =>
                      i === itemIndex ? { ...row, value: match.body } : row,
                    );
                    patchSection(sectionIndex, { items });
                  }
                }}
              />
              <TextInput
                style={[ui.input, { marginTop: 6 }]}
                placeholder="Value (e.g. 25 CM, Included)"
                placeholderTextColor={colors.soft}
                value={item.value}
                onChangeText={(value) => {
                  const items = section.items.map((row, i) =>
                    i === itemIndex ? { ...row, value } : row,
                  );
                  patchSection(sectionIndex, { items });
                }}
              />
              <TextInput
                style={[ui.input, { marginTop: 6 }]}
                placeholder="Amount (AED)"
                placeholderTextColor={colors.soft}
                keyboardType="decimal-pad"
                value={item.amount}
                onChangeText={(amount) => {
                  const items = section.items.map((row, i) =>
                    i === itemIndex ? { ...row, amount } : row,
                  );
                  patchSection(sectionIndex, { items });
                }}
              />
              {section.items.length > 1 ? (
                <Pressable
                  style={{ marginTop: 6, alignSelf: 'flex-start' }}
                  onPress={() => {
                    const items = section.items.filter((_, i) => i !== itemIndex);
                    patchSection(sectionIndex, { items });
                  }}
                >
                  <Text style={ui.dangerText}>Remove row</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          <Pressable
            style={[ui.ghost, { marginTop: 10, alignSelf: 'flex-start' }]}
            onPress={() =>
              patchSection(sectionIndex, {
                items: [...section.items, { ...EMPTY_ITEM }],
              })
            }
          >
            <Text style={ui.ghostText}>+ Add item</Text>
          </Pressable>
          <Text style={[ui.cardMeta, { marginTop: 8 }]}>
            Section amount{' '}
            {money(
              sectionAmountFromItems(
                section.items,
                Number(section.amount) || 0,
              ),
            )}
          </Text>
          {sections.length > 1 ? (
            <Pressable
              style={{ marginTop: 8 }}
              onPress={() =>
                setSections((prev) =>
                  prev.filter((_, i) => i !== sectionIndex),
                )
              }
            >
              <Text style={ui.dangerText}>Remove section</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      <Pressable
        style={[ui.ghost, { alignSelf: 'flex-start', marginBottom: 12 }]}
        onPress={() =>
          setSections((prev) => [
            ...prev,
            {
              productId: '',
              productName: '',
              amount: '0',
              items: [{ ...EMPTY_ITEM }],
            },
          ])
        }
      >
        <Text style={ui.ghostText}>+ Add counter section</Text>
      </Pressable>

      <View style={ui.card}>
        <Text style={ui.label}>Discount</Text>
        <TextInput
          style={ui.input}
          keyboardType="decimal-pad"
          value={discount}
          onChangeText={setDiscount}
        />
        <Text style={[ui.cardMeta, { marginTop: 10 }]}>
          Taxable {money(totals.subtotal)} · VAT {money(totals.vatAmount)} ·
          Total {money(totals.total)}
        </Text>
        <Text style={ui.label}>Extra notes</Text>
        <TextInput
          style={ui.input}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </View>

      <View style={ui.card}>
        <Text style={ui.cardTitle}>Attach lookups</Text>
        <LookupAttachPicker
          items={lookups}
          selectedIds={lookupIds}
          onChange={setLookupIds}
          emptyMessage="No lookups yet — add them on the Quotations tabs."
        />
      </View>

      <RowActions>
        <ActionButton
          label={saving ? 'Saving…' : editId ? 'Save' : 'Create'}
          tone="primary"
          disabled={saving}
          onPress={() => void save()}
        />
        <ActionButton
          label="Cancel"
          onPress={() => router.back()}
        />
      </RowActions>
    </ScreenScroll>
  );
}

const styles = {
  picker: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
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
};
