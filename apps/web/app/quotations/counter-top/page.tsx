'use client';

import Link from 'next/link';
import { BackLink } from '@/components/Finance';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { computeCounterTopTotals } from '@marble/domain';
import { QUOTATION_KIND_LABELS } from '@marble/types';
import { apiFetch, apiPost, apiPut } from '@/lib/api';
import { money } from '@/lib/format';
import { usePolledList } from '@/lib/useCollection';
import { LookupAttachPicker } from '@/components/QuotationLookups';
import {
  SpecItemRow,
  SpecLabelQuickPick,
  sectionAmountFromItems,
  sumSpecItemAmounts,
  type SpecItemDraft,
} from '@/components/SpecItemEditor';
import type { Customer, Product, Quotation, QuotationLookup } from '@/lib/types';
import page from '../../page.module.css';
import styles from '@/components/crud.module.css';

type ItemDraft = SpecItemDraft;
type SectionDraft = {
  productId: string;
  productName: string;
  amount: string;
  items: ItemDraft[];
};

const EMPTY_ITEM: ItemDraft = { label: '', value: '', amount: '' };
const EMPTY_SECTION: SectionDraft = {
  productId: '',
  productName: '',
  amount: '0',
  items: [{ ...EMPTY_ITEM }],
};

export default function CounterTopQuotationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
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
  const [sections, setSections] = useState<SectionDraft[]>([
    { ...EMPTY_SECTION, items: [{ ...EMPTY_ITEM }] },
  ]);
  const [specLabels, setSpecLabels] = useState<QuotationLookup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editId));

  useEffect(() => {
    void apiFetch<QuotationLookup[]>('/quotation-lookups?category=spec')
      .then(setSpecLabels)
      .catch(() => setSpecLabels([]));
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
        setError(e instanceof Error ? e.message : 'Failed to load quotation'),
      )
      .finally(() => setLoadingEdit(false));
  }, [editId]);

  const totals = useMemo(() => {
    const amounts = sections.map((section) =>
      sectionAmountFromItems(section.items, Number(section.amount) || 0),
    );
    return computeCounterTopTotals(amounts, Number(discount) || 0);
  }, [sections, discount]);

  function patchSection(index: number, changes: Partial<SectionDraft>) {
    setSections((prev) =>
      prev.map((section, i) =>
        i === index ? { ...section, ...changes } : section,
      ),
    );
  }

  function pickProduct(index: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      patchSection(index, {
        productId: '',
        productName: sections[index].productName,
      });
      return;
    }
    patchSection(index, {
      productId,
      productName: product.name,
      items:
        sumSpecItemAmounts(sections[index].items) === 0 && product.sellPrice > 0
          ? sections[index].items.map((item, i) =>
              i === 0
                ? { ...item, amount: String(product.sellPrice) }
                : item,
            )
          : sections[index].items,
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving || !customerId) return;
    for (const section of sections) {
      if (!section.productName.trim()) {
        setError('Each section needs a product name');
        return;
      }
    }
    setSaving(true);
    setError(null);
    const payload = {
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
          amount: sectionAmountFromItems(
            section.items,
            Number(section.amount) || 0,
          ),
          items,
        };
      }),
    };
    try {
      if (editId) await apiPut(`/quotations/${editId}`, payload);
      else await apiPost('/quotations', payload);
      router.push('/quotations');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loadingEdit) {
    return (
      <section className={page.page}>
        <BackLink href="/quotations">← Back to quotations</BackLink>
        <header className={page.header}>
          <h1 className={page.title}>{QUOTATION_KIND_LABELS.counter_top}</h1>
          <p className={page.lede}>Loading Counter Top quotation…</p>
        </header>
      </section>
    );
  }

  return (
    <section className={page.page}>
      <BackLink href="/quotations">← Back to quotations</BackLink>
      <header className={page.header}>
        <h1 className={page.title}>
          {editId ? 'Edit ' : ''}
          {QUOTATION_KIND_LABELS.counter_top}
        </h1>
        <p className={page.lede}>
          Add sections with a product name, flexible spec rows, and a section
          amount. Totals follow the same VAT pattern as general quotations.
        </p>
      </header>
      {error ? <p className={styles.error}>{error}</p> : null}

      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label}>Customer *</label>
            <select
              className={styles.select}
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
            >
              <option value="">Select a customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Subject</label>
            <input
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Vanity counter tops…"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Valid until</label>
            <input
              className={styles.input}
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Attn / contact</label>
            <input
              className={styles.input}
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Contact phone</label>
            <input
              className={styles.input}
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Location</label>
            <input
              className={styles.input}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>

        {sections.map((section, sectionIndex) => (
          <div
            key={sectionIndex}
            className={styles.form}
            style={{ marginTop: '1rem', boxShadow: 'none' }}
          >
            <p className={styles.formTitle}>
              Section {sectionIndex + 1}
              {sections.length > 1 ? (
                <button
                  type="button"
                  className={`${styles.ghost} ${styles.danger}`}
                  style={{ float: 'right' }}
                  onClick={() =>
                    setSections((prev) =>
                      prev.filter((_, i) => i !== sectionIndex),
                    )
                  }
                >
                  Remove section
                </button>
              ) : null}
            </p>

            <div className={styles.grid}>
              <div className={styles.field}>
                <label className={styles.label}>Catalog product</label>
                <select
                  className={styles.select}
                  value={section.productId}
                  onChange={(e) => pickProduct(sectionIndex, e.target.value)}
                >
                  <option value="">Custom / type name below</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Product name *</label>
                <input
                  className={styles.input}
                  value={section.productName}
                  onChange={(e) =>
                    patchSection(sectionIndex, {
                      productName: e.target.value,
                      productId: '',
                    })
                  }
                  required
                />
              </div>
            </div>

            <p className={styles.label} style={{ marginTop: '0.9rem' }}>
              Spec items (add as many as needed)
            </p>
            <SpecLabelQuickPick
              specLabels={specLabels}
              onPick={(label, hint) => {
                const items = [...section.items];
                const emptyIndex = items.findIndex((row) => !row.label.trim());
                if (emptyIndex >= 0) {
                  items[emptyIndex] = {
                    label,
                    value: hint ?? items[emptyIndex].value,
                    amount: items[emptyIndex].amount,
                  };
                } else {
                  items.push({ label, value: hint ?? '', amount: '' });
                }
                patchSection(sectionIndex, { items });
              }}
            />
            {section.items.map((item, itemIndex) => (
              <SpecItemRow
                key={itemIndex}
                listId={`spec-labels-${sectionIndex}-${itemIndex}`}
                item={item}
                specLabels={specLabels}
                onLabelChange={(label) => {
                  const items = section.items.map((row, i) =>
                    i === itemIndex ? { ...row, label } : row,
                  );
                  patchSection(sectionIndex, { items });
                }}
                onValueChange={(value) => {
                  const items = section.items.map((row, i) =>
                    i === itemIndex ? { ...row, value } : row,
                  );
                  patchSection(sectionIndex, { items });
                }}
                onAmountChange={(amount) => {
                  const items = section.items.map((row, i) =>
                    i === itemIndex ? { ...row, amount } : row,
                  );
                  patchSection(sectionIndex, { items });
                }}
                onRemove={() => {
                  const items = section.items.filter((_, i) => i !== itemIndex);
                  patchSection(sectionIndex, {
                    items: items.length ? items : [{ ...EMPTY_ITEM }],
                  });
                }}
              />
            ))}
            <button
              type="button"
              className={styles.ghost}
              style={{ marginTop: 8 }}
              onClick={() =>
                patchSection(sectionIndex, {
                  items: [...section.items, { ...EMPTY_ITEM }],
                })
              }
            >
              + Add item
            </button>
            <p className={styles.count} style={{ marginTop: 10 }}>
              Section amount{' '}
              {money(
                sectionAmountFromItems(
                  section.items,
                  Number(section.amount) || 0,
                ),
              )}
            </p>
          </div>
        ))}

        <button
          type="button"
          className={styles.ghost}
          style={{ marginTop: '0.75rem' }}
          onClick={() =>
            setSections((prev) => [
              ...prev,
              { ...EMPTY_SECTION, items: [{ ...EMPTY_ITEM }] },
            ])
          }
        >
          + Add counter section
        </button>

        <div className={styles.grid} style={{ marginTop: '1rem' }}>
          <div className={styles.field}>
            <label className={styles.label}>Discount (AED)</label>
            <input
              className={styles.input}
              inputMode="decimal"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
        </div>

        <p className={styles.count} style={{ marginTop: '0.75rem' }}>
          Taxable {money(totals.subtotal)} · VAT {money(totals.vatAmount)} ·
          Grand total {money(totals.total)}
        </p>

        <div className={styles.field} style={{ marginTop: '1rem' }}>
          <label className={styles.label}>Extra notes</label>
          <textarea
            className={styles.textarea}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div style={{ marginTop: '1rem' }}>
          <p className={styles.formTitle}>Attach lookups</p>
          <LookupAttachPicker
            kind="counter_top"
            selectedIds={lookupIds}
            onChange={setLookupIds}
          />
        </div>

        <div className={styles.actions}>
          <button className={styles.button} type="submit" disabled={saving}>
            {saving
              ? 'Saving…'
              : editId
                ? 'Save changes'
                : 'Create Counter Top quotation'}
          </button>
          <Link href="/quotations" className={styles.ghost}>
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
