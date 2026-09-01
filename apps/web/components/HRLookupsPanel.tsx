'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch, apiPatch, apiPost } from '@/lib/api';
import { todayIso } from '@/lib/dates';
import { EditIconButton, FilterBar } from '@/components/Finance';
import styles from '@/components/crud.module.css';

export type HRLookupSection =
  | 'departments'
  | 'designations'
  | 'locations'
  | 'holidays'
  | 'leave-types';

const SECTION_LABELS: Record<HRLookupSection, string> = {
  departments: 'Departments',
  designations: 'Designations',
  locations: 'Work locations',
  holidays: 'Holidays',
  'leave-types': 'Leave types',
};

type Organization = {
  departments: Array<{ id: string; name: string; active: boolean }>;
  designations: Array<{ id: string; name: string; active: boolean }>;
  locations: Array<{
    id: string;
    name: string;
    kind: string;
    address: string | null;
    active: boolean;
  }>;
  holidays: Array<{ id: string; name: string; date: string }>;
};

type LeaveType = {
  id: string;
  name: string;
  code: string;
  paid: boolean;
  active: boolean;
};

type OrgKind = 'department' | 'designation' | 'location' | 'holiday';

function orgKind(section: HRLookupSection): OrgKind | null {
  if (section === 'departments') return 'department';
  if (section === 'designations') return 'designation';
  if (section === 'locations') return 'location';
  if (section === 'holidays') return 'holiday';
  return null;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export function HRLookupsPanel({
  canManage,
  onChanged,
}: {
  canManage: boolean;
  onChanged?: () => void;
}) {
  const [section, setSection] = useState<HRLookupSection>('departments');
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: '',
    date: todayIso(),
    address: '',
    locationKind: 'office',
    code: '',
    paid: true,
    active: true,
  });

  const reload = useCallback(async () => {
    const [org, types] = await Promise.all([
      apiFetch<Organization>('/company/hr/organization?all=true'),
      apiFetch<LeaveType[]>('/company/hr/leave-types'),
    ]);
    setOrganization(org);
    setLeaveTypes(types);
  }, []);

  useEffect(() => {
    void reload().catch((err) =>
      setError(err instanceof Error ? err.message : 'Could not load HR lookups'),
    );
  }, [reload]);

  function resetDraft() {
    setEditingId(null);
    setDraft({
      name: '',
      date: todayIso(),
      address: '',
      locationKind: 'office',
      code: '',
      paid: true,
      active: true,
    });
  }

  function startEdit(row: Record<string, unknown>) {
    setEditingId(String(row.id));
    setDraft({
      name: String(row.name ?? ''),
      date: row.date ? String(row.date).slice(0, 10) : '',
      address: String(row.address ?? ''),
      locationKind: String(row.kind ?? 'office'),
      code: String(row.code ?? ''),
      paid: row.paid !== false,
      active: row.active !== false,
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canManage || saving || !draft.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (section === 'leave-types') {
        const payload = {
          name: draft.name.trim(),
          code: draft.code.trim().toLowerCase(),
          paid: draft.paid,
          ...(editingId ? { active: draft.active } : {}),
        };
        if (editingId) {
          await apiPatch(`/company/hr/leave-types/${editingId}`, payload);
        } else {
          if (!draft.code.trim()) throw new Error('Code is required');
          await apiPost('/company/hr/leave-types', payload);
        }
      } else {
        const kind = orgKind(section);
        if (!kind) return;
        if (editingId) {
          await apiPatch(`/company/hr/organization/${editingId}`, {
            kind,
            name: draft.name.trim(),
            ...(kind === 'holiday' && draft.date ? { date: draft.date } : {}),
            ...(kind === 'location'
              ? {
                  address: draft.address.trim() || null,
                  locationKind: draft.locationKind.trim() || 'office',
                  active: draft.active,
                }
              : {}),
            ...(kind === 'department' || kind === 'designation'
              ? { active: draft.active }
              : {}),
          });
        } else {
          await apiPost('/company/hr/organization', {
            kind,
            name: draft.name.trim(),
            ...(kind === 'holiday' ? { date: draft.date || undefined } : {}),
            ...(kind === 'location'
              ? {
                  address: draft.address.trim() || undefined,
                  locationKind: draft.locationKind.trim() || 'office',
                }
              : {}),
          });
        }
      }
      resetDraft();
      await reload();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    if (!canManage) return;
    const kind = orgKind(section);
    try {
      if (section === 'leave-types') {
        await apiPatch(`/company/hr/leave-types/${id}`, { active });
      } else if (kind) {
        await apiPatch(`/company/hr/organization/${id}`, { kind, active });
      }
      await reload();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  type LookupRow =
    | Organization['departments'][number]
    | Organization['designations'][number]
    | Organization['locations'][number]
    | Organization['holidays'][number]
    | LeaveType;

  function rowMeta(row: LookupRow): string | null {
    if (section === 'holidays' && 'date' in row) return formatDate(row.date);
    if (section === 'locations' && 'kind' in row) {
      return [row.kind, row.address].filter(Boolean).join(' · ') || null;
    }
    if (section === 'leave-types' && 'code' in row) {
      return `${row.code} · ${row.paid ? 'Paid' : 'Unpaid'}`;
    }
    return null;
  }

  function rowActive(row: LookupRow) {
    if (section === 'holidays') return true;
    return 'active' in row ? row.active !== false : true;
  }

  const rows: LookupRow[] =
    section === 'leave-types'
      ? leaveTypes
      : section === 'departments'
        ? organization?.departments ?? []
        : section === 'designations'
          ? organization?.designations ?? []
          : section === 'locations'
            ? organization?.locations ?? []
            : organization?.holidays ?? [];

  return (
    <div>
      <p className={styles.count} style={{ marginBottom: '0.75rem' }}>
        Manage departments, designations, work locations, holidays, and leave types
        used across the HR module. Changes apply to employee forms and leave
        workflows immediately.
      </p>
      {error ? <p className={styles.error}>{error}</p> : null}

      <FilterBar
        active={section}
        onChange={(key) => {
          setSection(key as HRLookupSection);
          resetDraft();
        }}
        options={(Object.keys(SECTION_LABELS) as HRLookupSection[]).map(
          (key) => ({ key, label: SECTION_LABELS[key] }),
        )}
      />

      {canManage ? (
        <form className={styles.form} onSubmit={onSubmit}>
          <p className={styles.formTitle}>
            {editingId ? 'Edit lookup' : 'Add lookup'}
          </p>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>Name *</span>
              <input
                className={styles.input}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                required
              />
            </label>
            {section === 'holidays' ? (
              <label className={styles.field}>
                <span className={styles.label}>Date *</span>
                <input
                  className={styles.input}
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  required={!editingId}
                />
              </label>
            ) : null}
            {section === 'locations' ? (
              <>
                <label className={styles.field}>
                  <span className={styles.label}>Kind</span>
                  <select
                    className={styles.select}
                    value={draft.locationKind}
                    onChange={(e) =>
                      setDraft({ ...draft, locationKind: e.target.value })
                    }
                  >
                    <option value="office">Office</option>
                    <option value="site">Site</option>
                    <option value="warehouse">Warehouse</option>
                    <option value="remote">Remote</option>
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Address</span>
                  <input
                    className={styles.input}
                    value={draft.address}
                    onChange={(e) =>
                      setDraft({ ...draft, address: e.target.value })
                    }
                  />
                </label>
              </>
            ) : null}
            {section === 'leave-types' ? (
              <>
                <label className={styles.field}>
                  <span className={styles.label}>Code *</span>
                  <input
                    className={styles.input}
                    value={draft.code}
                    onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                    placeholder="annual"
                    required={!editingId}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Paid leave</span>
                  <select
                    className={styles.select}
                    value={draft.paid ? 'yes' : 'no'}
                    onChange={(e) =>
                      setDraft({ ...draft, paid: e.target.value === 'yes' })
                    }
                  >
                    <option value="yes">Paid</option>
                    <option value="no">Unpaid</option>
                  </select>
                </label>
              </>
            ) : null}
          </div>
          {editingId && section !== 'holidays' ? (
            <label className={styles.label} style={{ display: 'flex', gap: 8 }}>
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) =>
                  setDraft({ ...draft, active: e.target.checked })
                }
              />
              Active
            </label>
          ) : null}
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save' : 'Add'}
            </button>
            {editingId ? (
              <button
                className={styles.ghost}
                type="button"
                onClick={resetDraft}
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <p className={styles.count}>Only company admins can edit HR lookups.</p>
      )}

      <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
        {rows.length === 0 ? (
          <p className={styles.count}>No {SECTION_LABELS[section].toLowerCase()} yet.</p>
        ) : (
          (rows as LookupRow[]).map((row) => {
            const active = rowActive(row);
            const meta = rowMeta(row);
            return (
              <div
                key={row.id}
                className={styles.form}
                style={{ marginTop: 0, display: 'flex', gap: '0.65rem' }}
              >
                {canManage ? (
                  <EditIconButton onClick={() => startEdit(row as Record<string, unknown>)} />
                ) : null}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className={styles.formTitle} style={{ marginBottom: 4 }}>
                    {row.name}
                    {!active ? ' (inactive)' : ''}
                  </p>
                  {meta ? (
                    <p className={styles.count} style={{ marginBottom: 8 }}>
                      {meta}
                    </p>
                  ) : null}
                  {canManage && section !== 'holidays' ? (
                    <button
                      className={styles.ghost}
                      type="button"
                      onClick={() => void toggleActive(row.id, !active)}
                    >
                      {active ? 'Deactivate' : 'Activate'}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
