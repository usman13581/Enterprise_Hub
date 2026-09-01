import { useCallback, useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { apiFetch, apiPatch, apiPost } from '../lib/api';
import { day } from '../lib/format';
import { FormField } from './FormField';
import { ActionButton, FilterChips, RecordRow, RowActions } from './Finance';
import { colors, ui } from '../lib/ui';

export type HRLookupSection =
  | 'departments'
  | 'designations'
  | 'locations'
  | 'holidays'
  | 'leave-types';

const SECTIONS: Array<{ key: HRLookupSection; label: string }> = [
  { key: 'departments', label: 'Departments' },
  { key: 'designations', label: 'Designations' },
  { key: 'locations', label: 'Locations' },
  { key: 'holidays', label: 'Holidays' },
  { key: 'leave-types', label: 'Leave types' },
];

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

function orgKind(section: HRLookupSection) {
  if (section === 'departments') return 'department' as const;
  if (section === 'designations') return 'designation' as const;
  if (section === 'locations') return 'location' as const;
  if (section === 'holidays') return 'holiday' as const;
  return null;
}

export function HRLookupsSection({
  canManage,
  onChanged,
}: {
  canManage: boolean;
  onChanged?: () => void;
}) {
  const [section, setSection] = useState<HRLookupSection>('departments');
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: '',
    date: '',
    address: '',
    locationKind: 'office',
    code: '',
    paid: true,
    active: true,
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [org, types] = await Promise.all([
        apiFetch<Organization>('/company/hr/organization?all=true'),
        apiFetch<LeaveType[]>('/company/hr/leave-types'),
      ]);
      setOrganization(org);
      setLeaveTypes(types);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load lookups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function resetDraft() {
    setEditingId(null);
    setDraft({
      name: '',
      date: '',
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

  async function saveLookup() {
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

  function rowMeta(row: LookupRow): string {
    if (section === 'holidays' && 'date' in row) return day(row.date);
    if (section === 'locations' && 'kind' in row) {
      return [row.kind, row.address].filter(Boolean).join(' · ') || '—';
    }
    if (section === 'leave-types' && 'code' in row) {
      return `${row.code} · ${row.paid ? 'Paid' : 'Unpaid'}`;
    }
    return '—';
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
    <View>
      <Text style={ui.lede}>
        Manage HR lookup values used in employee profiles, attendance, and leave.
      </Text>
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <FilterChips
        active={section}
        onChange={(value) => {
          setSection(value as HRLookupSection);
          resetDraft();
        }}
        options={SECTIONS}
        scrollable
      />

      {canManage ? (
        <View style={ui.card}>
          <Text style={ui.cardTitle}>
            {editingId ? 'Edit lookup' : 'Add lookup'}
          </Text>
          <FormField
            label="Name *"
            value={draft.name}
            onChangeText={(name) => setDraft({ ...draft, name })}
          />
          {section === 'holidays' ? (
            <FormField
              label="Date (YYYY-MM-DD) *"
              value={draft.date}
              onChangeText={(date) => setDraft({ ...draft, date })}
              placeholder="2026-12-02"
            />
          ) : null}
          {section === 'locations' ? (
            <>
              <FormField
                label="Kind"
                value={draft.locationKind}
                onChangeText={(locationKind) =>
                  setDraft({ ...draft, locationKind })
                }
                placeholder="office"
              />
              <FormField
                label="Address"
                value={draft.address}
                onChangeText={(address) => setDraft({ ...draft, address })}
              />
            </>
          ) : null}
          {section === 'leave-types' ? (
            <>
              <FormField
                label="Code *"
                value={draft.code}
                onChangeText={(code) => setDraft({ ...draft, code })}
                placeholder="annual"
              />
              <View style={styles.switchRow}>
                <Text style={ui.label}>Paid leave</Text>
                <Switch
                  value={draft.paid}
                  onValueChange={(paid) => setDraft({ ...draft, paid })}
                  trackColor={{ false: colors.line, true: colors.accent }}
                />
              </View>
            </>
          ) : null}
          {editingId && section !== 'holidays' ? (
            <View style={styles.switchRow}>
              <Text style={ui.label}>Active</Text>
              <Switch
                value={draft.active}
                onValueChange={(active) => setDraft({ ...draft, active })}
                trackColor={{ false: colors.line, true: colors.accent }}
              />
            </View>
          ) : null}
          <RowActions variant="form">
            <ActionButton
              label={saving ? 'Saving…' : editingId ? 'Save' : 'Add'}
              tone="primary"
              disabled={saving}
              onPress={() => void saveLookup()}
            />
            {editingId ? (
              <ActionButton label="Cancel edit" onPress={resetDraft} />
            ) : null}
          </RowActions>
        </View>
      ) : (
        <Text style={ui.cardMeta}>Only company admins can edit HR lookups.</Text>
      )}

      {loading ? (
        <Text style={ui.cardMeta}>Loading lookups…</Text>
      ) : rows.length === 0 ? (
        <View style={ui.empty}>
          <Text style={ui.emptyText}>No values yet.</Text>
        </View>
      ) : (
        (rows as LookupRow[]).map((row) => {
          const active = rowActive(row);
          const meta = rowMeta(row);
          return (
            <RecordRow
              key={row.id}
              title={`${row.name}${active ? '' : ' (inactive)'}`}
              meta={meta}
            >
              {canManage ? (
                <View style={styles.rowActions}>
                  <ActionButton
                    label="Edit"
                    onPress={() => startEdit(row as Record<string, unknown>)}
                  />
                  {section !== 'holidays' ? (
                    <ActionButton
                      label={active ? 'Deactivate' : 'Activate'}
                      onPress={() => void toggleActive(row.id, !active)}
                    />
                  ) : null}
                </View>
              ) : null}
            </RecordRow>
          );
        })
      )}
    </View>
  );
}

const styles = {
  switchRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginTop: 4,
    marginBottom: 4,
  },
  rowActions: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 8,
  },
};
