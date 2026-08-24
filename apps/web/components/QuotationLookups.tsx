'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  QUOTATION_LOOKUP_APPLIES_LABELS,
  QUOTATION_LOOKUP_APPLIES_TO,
  QUOTATION_LOOKUP_CATEGORY_LABELS,
  type QuotationLookup,
  type QuotationLookupAppliesTo,
  type QuotationLookupCategory,
} from '@marble/types';
import { apiPost, apiPut, apiFetch } from '@/lib/api';
import { EditIconButton } from '@/components/Finance';
import styles from '@/components/crud.module.css';

export function QuotationLookupsPanel({
  category,
}: {
  category: QuotationLookupCategory;
}) {
  const [items, setItems] = useState<QuotationLookup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    title: '',
    body: '',
    appliesTo: 'both' as QuotationLookupAppliesTo,
    active: true,
  });
  const [saving, setSaving] = useState(false);

  const isSpec = category === 'spec';
  const defaultAppliesTo: QuotationLookupAppliesTo = isSpec
    ? 'counter_top'
    : 'both';

  async function reload() {
    const rows = await apiFetch<QuotationLookup[]>(
      `/quotation-lookups?category=${category}`,
    );
    setItems(rows);
  }

  useEffect(() => {
    void reload().catch((e) =>
      setError(e instanceof Error ? e.message : 'Failed to load lookups'),
    );
  }, [category]);

  function startCreate() {
    setEditingId(null);
    setDraft({
      title: '',
      body: isSpec ? '—' : '',
      appliesTo: defaultAppliesTo,
      active: true,
    });
  }

  function startEdit(row: QuotationLookup) {
    setEditingId(row.id);
    setDraft({
      title: row.title,
      body: row.body,
      appliesTo: row.appliesTo,
      active: row.active,
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving || !draft.title.trim() || !draft.body.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      category,
      title: draft.title,
      body: draft.body,
      appliesTo: draft.appliesTo,
      active: draft.active,
      sortOrder: 0,
    };
    try {
      if (editingId) await apiPut(`/quotation-lookups/${editingId}`, payload);
      else await apiPost('/quotation-lookups', payload);
      setEditingId(null);
      setDraft({
        title: '',
        body: isSpec ? '—' : '',
        appliesTo: defaultAppliesTo,
        active: true,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className={styles.count} style={{ marginBottom: '0.75rem' }}>
        {isSpec
          ? 'Counter Top spec row labels (Material, Fascia, …). Pick them on the Counter Top form, or type new labels — new labels are saved when you save a quotation.'
          : `Manage reusable ${QUOTATION_LOOKUP_CATEGORY_LABELS[category].toLowerCase()} and tag them for General, Counter Top, or both. Attach them when creating a quotation.`}
      </p>
      {error ? <p className={styles.error}>{error}</p> : null}

      <form className={styles.form} onSubmit={onSubmit}>
        <p className={styles.formTitle}>
          {editingId ? 'Edit lookup' : 'Add lookup'}
        </p>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label}>
              {isSpec ? 'Spec label *' : 'Title *'}
            </label>
            <input
              className={styles.input}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Applies to</label>
            <select
              className={styles.select}
              value={draft.appliesTo}
              disabled={isSpec}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  appliesTo: e.target.value as QuotationLookupAppliesTo,
                })
              }
            >
              {QUOTATION_LOOKUP_APPLIES_TO.map((value) => (
                <option key={value} value={value}>
                  {QUOTATION_LOOKUP_APPLIES_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.field} style={{ marginTop: '0.75rem' }}>
          <label className={styles.label}>
            {isSpec ? 'Default value hint' : 'Body *'}
          </label>
          <textarea
            className={styles.textarea}
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            rows={5}
            required
          />
        </div>
        <label className={styles.label} style={{ display: 'flex', gap: 8 }}>
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
          />
          Active
        </label>
        <div className={styles.actions}>
          <button className={styles.button} type="submit" disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Save' : 'Add'}
          </button>
          {editingId ? (
            <button
              className={styles.ghost}
              type="button"
              onClick={startCreate}
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
        {items.length === 0 ? (
          <p className={styles.count}>No lookups yet.</p>
        ) : (
          items.map((row) => (
            <div
              key={row.id}
              className={styles.form}
              style={{ marginTop: 0, display: 'flex', gap: '0.65rem' }}
            >
              <EditIconButton onClick={() => startEdit(row)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className={styles.formTitle} style={{ marginBottom: 4 }}>
                  {row.title}
                  {!row.active ? ' (inactive)' : ''}
                </p>
                <p className={styles.count} style={{ marginBottom: 8 }}>
                  {QUOTATION_LOOKUP_APPLIES_LABELS[row.appliesTo]}
                </p>
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    margin: '0 0 0.75rem',
                    fontFamily: 'inherit',
                    color: 'var(--muted)',
                    fontSize: '0.9rem',
                  }}
                >
                  {row.body}
                </pre>
                <div className={styles.cardActions}>
                  <button
                    className={styles.ghost}
                    type="button"
                    onClick={() =>
                      void apiPut(`/quotation-lookups/${row.id}`, {
                        title: row.title,
                        body: row.body,
                        category: row.category,
                        appliesTo: row.appliesTo,
                        active: !row.active,
                      })
                        .then(reload)
                        .catch((e) =>
                          setError(
                            e instanceof Error ? e.message : 'Update failed',
                          ),
                        )
                    }
                  >
                    {row.active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function LookupAttachPicker({
  kind,
  selectedIds,
  onChange,
}: {
  kind: 'general' | 'counter_top';
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [items, setItems] = useState<QuotationLookup[]>([]);

  useEffect(() => {
    void apiFetch<QuotationLookup[]>(
      `/quotation-lookups?appliesTo=${kind}&activeOnly=1`,
    ).then(setItems);
  }, [kind]);

  if (items.length === 0) {
    return (
      <p className={styles.count}>
        No lookup items for this type yet. Add them in the Terms / Notes / Bank
        tabs.
      </p>
    );
  }

  const attachCategories = ['terms', 'notes', 'bank'] as const;
  type AttachCategory = (typeof attachCategories)[number];

  const byCategory: Record<AttachCategory, QuotationLookup[]> = {
    terms: items.filter((i) => i.category === 'terms'),
    notes: items.filter((i) => i.category === 'notes'),
    bank: items.filter((i) => i.category === 'bank'),
  };

  return (
    <div style={{ display: 'grid', gap: '0.85rem' }}>
      {attachCategories.map((category) => {
          const rows = byCategory[category];
          if (rows.length === 0) return null;
          return (
            <div key={category}>
              <p className={styles.label}>
                {QUOTATION_LOOKUP_CATEGORY_LABELS[category]}
              </p>
              <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                {rows.map((row) => {
                  const checked = selectedIds.includes(row.id);
                  return (
                    <label
                      key={row.id}
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'flex-start',
                        fontSize: '0.9rem',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          onChange(
                            checked
                              ? selectedIds.filter((id) => id !== row.id)
                              : [...selectedIds, row.id],
                          );
                        }}
                      />
                      <span>
                        <strong>{row.title}</strong>
                        <br />
                        <span style={{ color: 'var(--muted)' }}>
                          {row.body.slice(0, 120)}
                          {row.body.length > 120 ? '…' : ''}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
    </div>
  );
}
