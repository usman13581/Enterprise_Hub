import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { computeQuotationTotals } from '@marble/domain';
import {
  QUOTATION_KIND_LABELS,
  QUOTATION_LOOKUP_APPLIES_LABELS,
  QUOTATION_LOOKUP_APPLIES_TO,
  QUOTATION_LOOKUP_CATEGORY_LABELS,
  type QuotationKind,
  type QuotationLookup,
  type QuotationLookupAppliesTo,
  type QuotationLookupCategory,
} from '@marble/types';
import {
  discountFromStored,
  discountPayload,
  DiscountInput,
  EMPTY_DISCOUNT,
  type DiscountDraft,
} from '../../components/DiscountInput';
import { apiFetch, apiPost, apiPut } from '../../lib/api';
import { dueDateIso } from '../../lib/dates';
import { day, money } from '../../lib/format';
import {
  searchItems,
  useFlash,
  usePagination,
  usePolledList,
} from '../../lib/useCollection';
import { FormPicker } from '../../components/FormField';
import { SearchablePicker } from '../../components/SearchablePicker';
import { Pagination, SearchBox, Toast } from '../../components/ListControls';
import { ScreenScroll } from '../../components/ScreenScroll';
import { LookupAttachPicker } from '../../components/LookupAttachPicker';
import {
  ActionButton,
  FilterChips,
  LinkAction,
  RecordRow,
  RowActions,
  EditIconButton,
} from '../../components/Finance';
import type { Customer, Product, Quotation } from '../../lib/types';
import { colors, ui } from '../../lib/ui';

type Filter = 'all' | 'draft' | 'approved' | 'cancelled';
type CreateStep = 'list' | 'pick-kind' | 'general-form';
type PageTab = 'quotations' | QuotationLookupCategory;

type LineDraft = {
  description: string;
  unit: string;
  qty: string;
  purchasePrice: string;
  sellPrice: string;
  productId: string;
  discountMode: DiscountDraft['discountMode'];
  discountValue: string;
};

type Draft = {
  customerId: string;
  title: string;
  validUntil: string;
  notes: string;
  lines: LineDraft[];
  lookupIds: string[];
  documentDiscount: DiscountDraft;
};

const EMPTY_LINE: LineDraft = {
  description: '',
  unit: 'sqm',
  qty: '1',
  purchasePrice: '0',
  sellPrice: '0',
  productId: '',
  discountMode: 'none',
  discountValue: '0',
};

const EMPTY: Draft = {
  customerId: '',
  title: '',
  validUntil: dueDateIso(),
  notes: '',
  lines: [{ ...EMPTY_LINE }],
  lookupIds: [],
  documentDiscount: { ...EMPTY_DISCOUNT },
};

const num = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function QuotationsScreen() {
  const router = useRouter();
  const { items, loading, error, setError, reload } =
    usePolledList<Quotation>('/quotations');
  const { items: customers } = usePolledList<Customer>('/customers', 20000);
  const { items: products } = usePolledList<Product>('/products', 20000);
  const { flash, notify } = useFlash();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [step, setStep] = useState<CreateStep>('list');
  const [kind, setKind] = useState<QuotationKind>('general');
  const [pageTab, setPageTab] = useState<PageTab>('quotations');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [lookups, setLookups] = useState<QuotationLookup[]>([]);
  const [lookupDraft, setLookupDraft] = useState({
    title: '',
    body: '',
    appliesTo: 'both' as QuotationLookupAppliesTo,
    active: true,
  });
  const [lookupEditingId, setLookupEditingId] = useState<string | null>(null);
  const [attachable, setAttachable] = useState<QuotationLookup[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const canCounterTop = features.includes('quotation.counter_top');

  useEffect(() => {
    void apiFetch<{ features?: string[] }>('/auth/session').then((s) => {
      setFeatures(s.features ?? []);
    });
  }, []);

  function resetLookupDraft() {
    setLookupEditingId(null);
    setLookupDraft({
      title: '',
      body: pageTab === 'spec' ? '—' : '',
      appliesTo: pageTab === 'spec' ? 'counter_top' : 'both',
      active: true,
    });
  }

  async function saveLookup() {
    if (!lookupDraft.title.trim() || !lookupDraft.body.trim()) return;
    const payload = {
      category: pageTab,
      title: lookupDraft.title,
      body: lookupDraft.body,
      appliesTo:
        pageTab === 'spec' ? 'counter_top' : lookupDraft.appliesTo,
      active: lookupDraft.active,
      sortOrder: 0,
    };
    try {
      if (lookupEditingId) {
        await apiPut(`/quotation-lookups/${lookupEditingId}`, payload);
      } else {
        await apiPost('/quotation-lookups', payload);
      }
      const rows = await apiFetch<QuotationLookup[]>(
        `/quotation-lookups?category=${pageTab}`,
      );
      setLookups(rows);
      resetLookupDraft();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  useEffect(() => {
    if (pageTab === 'quotations') return;
    void apiFetch<QuotationLookup[]>(
      `/quotation-lookups?category=${pageTab}`,
    ).then(setLookups);
  }, [pageTab]);

  useEffect(() => {
    if (step !== 'general-form') return;
    void apiFetch<QuotationLookup[]>(
      '/quotation-lookups?appliesTo=general&activeOnly=1',
    ).then(setAttachable);
  }, [step]);

  const filtered = useMemo(() => {
    const byStatus =
      filter === 'all' ? items : items.filter((item) => item.status === filter);
    return searchItems(byStatus, query);
  }, [items, filter, query]);
  const pager = usePagination(filtered, `${filter}:${query}:${pageTab}`);

  const payloadLines = draft.lines.map((line) => ({
    productId: line.productId || null,
    description: line.description.trim(),
    unit: line.unit.trim() || 'sqm',
    qty: num(line.qty),
    purchasePrice: num(line.purchasePrice),
    sellPrice: num(line.sellPrice),
    discountMode: line.discountMode,
    discountValue: num(line.discountValue),
  }));
  const totals = computeQuotationTotals(
    payloadLines,
    discountPayload(draft.documentDiscount),
  );

  function startCreate() {
    setEditingId(null);
    setKind('general');
    if (!canCounterTop) {
      setDraft({
        ...EMPTY,
        validUntil: dueDateIso(),
        lines: [{ ...EMPTY_LINE }],
        lookupIds: [],
      });
      setStep('general-form');
      return;
    }
    setStep('pick-kind');
  }

  function continueWithKind() {
    if (kind === 'counter_top') {
      if (!canCounterTop) {
        setError('Counter Top quotations are not enabled for this company');
        return;
      }
      router.push('/module/quotations-counter-top' as never);
      return;
    }
    setDraft({
      ...EMPTY,
      validUntil: dueDateIso(),
      lines: [{ ...EMPTY_LINE }],
      lookupIds: [],
    });
    setStep('general-form');
  }

  function startEdit(quotation: Quotation) {
    if (quotation.kind === 'counter_top') {
      router.push(
        `/module/quotations-counter-top?edit=${quotation.id}` as never,
      );
      return;
    }
    setDraft({
      customerId: quotation.customerId,
      title: quotation.title ?? '',
      validUntil: quotation.validUntil ? quotation.validUntil.slice(0, 10) : '',
      notes: quotation.notes ?? '',
      lines: quotation.lines.map((line) => ({
        productId: line.productId ?? '',
        description: line.description,
        unit: line.unit,
        qty: String(line.qty),
        purchasePrice: String(line.purchasePrice),
        sellPrice: String(line.sellPrice),
        discountMode:
          (line.discountMode as DiscountDraft['discountMode']) ?? 'none',
        discountValue: String(line.discountValue ?? 0),
      })),
      lookupIds: (quotation.lookups ?? []).map((l) => l.id),
      documentDiscount: discountFromStored(
        quotation.discountMode,
        quotation.discountValue,
      ),
    });
    setEditingId(quotation.id);
    setStep('general-form');
  }

  async function save() {
    if (saving || !draft.customerId) return;
    setSaving(true);
    try {
      const body = {
        kind: 'general' as const,
        customerId: draft.customerId,
        title: draft.title,
        validUntil: draft.validUntil || null,
        notes: draft.notes,
        ...discountPayload(draft.documentDiscount),
        lookupIds: draft.lookupIds,
        lines: payloadLines,
        sections: [],
      };
      if (editingId) await apiPut(`/quotations/${editingId}`, body);
      else await apiPost('/quotations', body);
      setStep('list');
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
      <ScreenScroll>
        <Text style={ui.title}>Quotations</Text>
        {error ? <Text style={ui.error}>{error}</Text> : null}

        <FilterChips
          active={pageTab}
          onChange={(key) => {
            setPageTab(key);
            setStep('list');
          }}
          options={[
            { key: 'quotations', label: 'Quotations' },
            { key: 'terms', label: 'Terms' },
            { key: 'notes', label: 'Notes' },
            { key: 'bank', label: 'Bank' },
            { key: 'spec', label: 'Spec items' },
          ]}
        />

        {pageTab !== 'quotations' ? (
          <View style={ui.card}>
            <Text style={ui.cardTitle}>
              {QUOTATION_LOOKUP_CATEGORY_LABELS[pageTab]}
            </Text>
            <Text style={ui.label}>
              {pageTab === 'spec' ? 'Spec label' : 'Title'}
            </Text>
            <TextInput
              style={ui.input}
              value={lookupDraft.title}
              onChangeText={(title) =>
                setLookupDraft({ ...lookupDraft, title })
              }
            />
            <Text style={ui.label}>
              {pageTab === 'spec' ? 'Default value hint' : 'Body'}
            </Text>
            <TextInput
              style={ui.input}
              value={lookupDraft.body}
              onChangeText={(body) => setLookupDraft({ ...lookupDraft, body })}
              multiline
            />
            {pageTab !== 'spec' ? (
              <>
                <Text style={ui.label}>Applies to</Text>
                <View style={styles.picker}>
                  {QUOTATION_LOOKUP_APPLIES_TO.map((value) => (
                    <Pressable
                      key={value}
                      style={[
                        styles.option,
                        lookupDraft.appliesTo === value && styles.optionActive,
                      ]}
                      onPress={() =>
                        setLookupDraft({ ...lookupDraft, appliesTo: value })
                      }
                    >
                      <Text
                        style={[
                          styles.optionText,
                          lookupDraft.appliesTo === value &&
                            styles.optionTextActive,
                        ]}
                      >
                        {QUOTATION_LOOKUP_APPLIES_LABELS[value]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
            <Pressable
              style={[styles.option, { marginTop: 10, alignSelf: 'flex-start' }]}
              onPress={() =>
                setLookupDraft({ ...lookupDraft, active: !lookupDraft.active })
              }
            >
              <Text style={styles.optionText}>
                Active: {lookupDraft.active ? 'Yes' : 'No'}
              </Text>
            </Pressable>
            <RowActions variant="form">
              <ActionButton
                label={
                  lookupEditingId
                    ? 'Save lookup'
                    : pageTab === 'spec'
                      ? 'Add spec label'
                      : 'Add lookup'
                }
                tone="primary"
                onPress={() => void saveLookup()}
              />
              {lookupEditingId ? (
                <ActionButton label="Cancel edit" onPress={resetLookupDraft} />
              ) : null}
            </RowActions>
            {lookups.map((row) => (
              <View key={row.id} style={{ marginTop: 14, flexDirection: 'row', gap: 8 }}>
                <EditIconButton
                  onPress={() => {
                    setLookupEditingId(row.id);
                    setLookupDraft({
                      title: row.title,
                      body: row.body,
                      appliesTo: row.appliesTo,
                      active: row.active,
                    });
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={ui.cardTitle}>
                    {row.title}
                    {!row.active ? ' (inactive)' : ''}
                  </Text>
                  <Text style={ui.cardMeta}>
                    {QUOTATION_LOOKUP_APPLIES_LABELS[row.appliesTo]}
                  </Text>
                  <Text style={ui.cardMeta}>{row.body}</Text>
                  <View style={{ flexDirection: 'row', marginTop: 8 }}>
                    <LinkAction
                      label={row.active ? 'Deactivate' : 'Activate'}
                      onPress={() =>
                        void apiPut(`/quotation-lookups/${row.id}`, {
                          title: row.title,
                          body: row.body,
                          category: row.category,
                          appliesTo: row.appliesTo,
                          active: !row.active,
                        })
                          .then(() =>
                            apiFetch<QuotationLookup[]>(
                              `/quotation-lookups?category=${pageTab}`,
                            ),
                          )
                          .then(setLookups)
                      }
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {pageTab === 'quotations' && step === 'pick-kind' ? (
          <View style={ui.card}>
            <Text style={ui.cardTitle}>New quotation</Text>
            <Text style={ui.lede}>Choose the quotation type to continue.</Text>
            <Text style={ui.label}>Quotation type</Text>
            <View style={styles.picker}>
              {(
                [
                  ['general', QUOTATION_KIND_LABELS.general],
                  ...(canCounterTop
                    ? ([['counter_top', QUOTATION_KIND_LABELS.counter_top]] as const)
                    : []),
                ] as const
              ).map(([value, label]) => (
                <Pressable
                  key={value}
                  style={[
                    styles.option,
                    kind === value && styles.optionActive,
                  ]}
                  onPress={() => setKind(value)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      kind === value && styles.optionTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <RowActions>
              <ActionButton
                label="Continue"
                tone="primary"
                onPress={continueWithKind}
              />
              <ActionButton label="Cancel" onPress={() => setStep('list')} />
            </RowActions>
          </View>
        ) : null}

        {pageTab === 'quotations' && step === 'general-form' ? (
          <View style={ui.card}>
            <Text style={ui.cardTitle}>
              {editingId
                ? 'Edit quotation'
                : QUOTATION_KIND_LABELS.general}
            </Text>
            <FormPicker label="Customer *" first>
              <SearchablePicker
                value={draft.customerId}
                options={customers.map((customer) => ({
                  id: customer.id,
                  label: customer.name,
                }))}
                searchPlaceholder="Search customers…"
                emptyText="No customers match your search."
                onChange={(customerId) => setDraft({ ...draft, customerId })}
              />
            </FormPicker>
            <Text style={ui.label}>Subject</Text>
            <TextInput
              style={ui.input}
              value={draft.title}
              onChangeText={(title) => setDraft({ ...draft, title })}
              placeholder="Villa flooring…"
              placeholderTextColor={colors.soft}
            />
            <Text style={ui.label}>Valid until (YYYY-MM-DD)</Text>
            <TextInput
              style={ui.input}
              value={draft.validUntil}
              onChangeText={(validUntil) => setDraft({ ...draft, validUntil })}
              placeholder="Optional"
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
                    <Pressable
                      style={[
                        styles.option,
                        !line.productId && styles.optionActive,
                      ]}
                      onPress={() => pickProduct(index, '')}
                    >
                      <Text style={styles.optionText}>No catalog product</Text>
                    </Pressable>
                    {products.map((product) => (
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
              style={styles.addLineButton}
              onPress={() =>
                setDraft({
                  ...draft,
                  lines: [...draft.lines, { ...EMPTY_LINE }],
                })
              }
            >
              <Text style={styles.addLineButtonText}>+ Add line</Text>
            </Pressable>

            <DiscountInput
              label="Document discount"
              value={draft.documentDiscount}
              onChange={(documentDiscount) =>
                setDraft({ ...draft, documentDiscount })
              }
            />

            <Text style={[ui.cardMeta, { marginTop: 12 }]}>
              {totals.lineDiscountTotal > 0
                ? `Line disc. ${money(totals.lineDiscountTotal)} · `
                : ''}
              {totals.discount > 0 ? `Doc disc. ${money(totals.discount)} · ` : ''}
              Taxable {money(totals.subtotal)} · VAT {money(totals.vatAmount)} ·
              Total {money(totals.total)} · Margin {money(totals.profit)}
            </Text>

            <Text style={ui.label}>Notes</Text>
            <TextInput
              style={ui.input}
              value={draft.notes}
              onChangeText={(notes) => setDraft({ ...draft, notes })}
              multiline
            />

            <Text style={[ui.cardTitle, { marginTop: 14 }]}>Attach lookups</Text>
            <LookupAttachPicker
              items={attachable}
              selectedIds={draft.lookupIds}
              onChange={(lookupIds) => setDraft({ ...draft, lookupIds })}
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
                onPress={() => setStep(editingId ? 'list' : 'pick-kind')}
              />
            </RowActions>
          </View>
        ) : null}

        {pageTab === 'quotations' && step === 'list' ? (
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
                <RecordRow
                  key={quotation.id}
                  title={quotation.number}
                  pdfPath={`/documents/quotations/${quotation.id}.pdf`}
                  onPdfError={setError}
                  onEdit={
                    quotation.status === 'draft'
                      ? () => startEdit(quotation)
                      : undefined
                  }
                  meta={[
                    quotation.kind === 'counter_top'
                      ? QUOTATION_KIND_LABELS.counter_top
                      : QUOTATION_KIND_LABELS.general,
                    quotation.customer?.name,
                    quotation.title || 'No subject',
                    money(quotation.total),
                    `margin ${money(quotation.profit)}`,
                    day(quotation.createdAt),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                >
                  {quotation.job ? (
                    <LinkAction
                      label={`Open job ${quotation.job.number}`}
                      onPress={() =>
                        router.push(
                          `/module/jobs?open=${quotation.job!.id}` as never,
                        )
                      }
                    />
                  ) : null}
                  {quotation.status === 'draft' ? (
                    <>
                      <LinkAction
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
                      <LinkAction
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
                    </>
                  ) : null}
                </RecordRow>
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
        ) : null}
      </ScreenScroll>
      <Toast flash={flash} />
    </View>
  );
}

const styles = {
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
  addLineButton: {
    marginTop: 12,
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  addLineButtonText: {
    color: colors.accent,
    fontWeight: '700' as const,
    fontSize: 14,
  },
};
