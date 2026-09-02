"use client";

import { FormEvent, useState } from "react";
import { apiPatch, apiPost } from "@/lib/api";
import {
  searchItems,
  usePagination,
  usePolledList,
} from "@/lib/useCollection";
import { Pagination, SearchBox } from "@/components/ListControls";
import page from "../../page.module.css";
import styles from "@/components/crud.module.css";

type Plan = {
  id: string;
  name: string;
  code: string;
  interval: string;
  priceUsd: number;
  trialDays: number;
  maxUsers: number;
  active: boolean;
};

const EMPTY = {
  name: "",
  code: "",
  interval: "monthly",
  priceUsd: "0",
  trialDays: "14",
  maxUsers: "5",
  active: true,
};

export default function AdminPlansPage() {
  const { items, error, setError, reload } = usePolledList<Plan>("/admin/plans");
  const [draft, setDraft] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");

  function startEdit(plan: Plan) {
    setEditingId(plan.id);
    setDraft({
      name: plan.name,
      code: plan.code,
      interval: plan.interval,
      priceUsd: String(plan.priceUsd),
      trialDays: String(plan.trialDays),
      maxUsers: String(plan.maxUsers),
      active: plan.active,
    });
    setShowForm(true);
  }

  function startCreate() {
    setEditingId(null);
    setDraft(EMPTY);
    setShowForm(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    const payload = {
      name: draft.name,
      code: draft.code,
      interval: draft.interval,
      priceUsd: Number(draft.priceUsd),
      trialDays: Number(draft.trialDays),
      maxUsers: Number(draft.maxUsers),
      active: draft.active,
    };
    try {
      if (editingId) await apiPatch(`/admin/plans/${editingId}`, payload);
      else await apiPost("/admin/plans", payload);
      setShowForm(false);
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const filtered = searchItems(items, query);
  const pager = usePagination(filtered, query);

  return (
    <section className={page.page}>
      <h1 className={page.title}>Plans</h1>

      <div className={styles.toolbar}>
        <span className={styles.count}>{items.length} plans</span>
        <button type="button" className={styles.button} onClick={startCreate}>
          New plan
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search plans by name or code…"
      />

      {showForm ? (
        <form className={styles.form} onSubmit={onSubmit}>
          <p className={styles.formTitle}>
            {editingId ? "Edit plan" : "Create plan"}
          </p>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>Name</label>
              <input
                className={styles.input}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Code</label>
              <input
                className={styles.input}
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Interval</label>
              <select
                className={styles.select}
                value={draft.interval}
                onChange={(e) =>
                  setDraft({ ...draft, interval: e.target.value })
                }
              >
                <option value="monthly">monthly</option>
                <option value="yearly">yearly</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Price (USD)</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="0.01"
                value={draft.priceUsd}
                onChange={(e) =>
                  setDraft({ ...draft, priceUsd: e.target.value })
                }
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Trial days</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                value={draft.trialDays}
                onChange={(e) =>
                  setDraft({ ...draft, trialDays: e.target.value })
                }
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Max users (0 = unlimited)</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                value={draft.maxUsers}
                onChange={(e) =>
                  setDraft({ ...draft, maxUsers: e.target.value })
                }
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Active</label>
              <select
                className={styles.select}
                value={draft.active ? "yes" : "no"}
                onChange={(e) =>
                  setDraft({ ...draft, active: e.target.value === "yes" })
                }
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              className={styles.ghost}
              type="button"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <ul className={styles.list}>
        {pager.paged.map((p) => (
          <li key={p.id} className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardContent}>
                <p className={styles.cardTitle}>{p.name}</p>
                <p className={styles.cardMeta}>
                  {p.code} · {p.interval} ·{" "}
                  {p.code === "custom"
                    ? "Contact sales"
                    : `USD ${Number(p.priceUsd).toFixed(2)}`}{" "}
                  · trial {p.trialDays}d ·{" "}
                  {p.maxUsers === 0 ? "unlimited users" : `max ${p.maxUsers}`} ·{" "}
                  {p.active ? "active" : "inactive"}
                </p>
              </div>
              <div className={styles.cardActions}>
                <button
                  type="button"
                  className={styles.ghost}
                  onClick={() => startEdit(p)}
                >
                  Edit
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {filtered.length > 0 ? (
        <Pagination
          page={pager.page}
          setPage={pager.setPage}
          pageSize={pager.pageSize}
          setPageSize={pager.setPageSize}
          pageCount={pager.pageCount}
          total={pager.total}
        />
      ) : null}
    </section>
  );
}
