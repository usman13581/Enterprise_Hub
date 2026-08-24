"use client";

import { FormEvent, useState } from "react";
import { apiPost, apiPut } from "@/lib/api";
import {
  searchItems,
  useFlash,
  usePagination,
  usePolledList,
} from "@/lib/useCollection";
import { Pagination, SearchBox, Toast } from "@/components/ListControls";
import { EditIconButton } from "@/components/Finance";
import type { Supplier } from "@/lib/types";
import page from "../page.module.css";
import styles from "@/components/crud.module.css";

type Draft = {
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  trn: string;
  notes: string;
  active: boolean;
};

const EMPTY: Draft = {
  name: "",
  contact: "",
  phone: "",
  email: "",
  address: "",
  trn: "",
  notes: "",
  active: true,
};

export default function SuppliersPage() {
  const { items, error, setError, reload } =
    usePolledList<Supplier>("/suppliers");
  const { flash, notify } = useFlash();
  const [query, setQuery] = useState("");
  const filtered = searchItems(items, query);
  const pager = usePagination(filtered);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  function startCreate() {
    setDraft(EMPTY);
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(item: Supplier) {
    setDraft({
      name: item.name,
      contact: item.contact ?? "",
      phone: item.phone ?? "",
      email: item.email ?? "",
      address: item.address ?? "",
      trn: item.trn ?? "",
      notes: item.notes ?? "",
      active: item.active !== false,
    });
    setEditingId(item.id);
    setShowForm(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim() || saving) return;
    setSaving(true);
    const wasEditing = Boolean(editingId);
    try {
      if (editingId) {
        await apiPut(`/suppliers/${editingId}`, draft);
      } else {
        await apiPost("/suppliers", draft);
      }
      setShowForm(false);
      setEditingId(null);
      setDraft(EMPTY);
      await reload();
      notify(wasEditing ? "Supplier saved" : "Supplier added");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function setActive(item: Supplier, active: boolean) {
    try {
      await apiPut(`/suppliers/${item.id}`, {
        name: item.name,
        contact: item.contact,
        phone: item.phone,
        email: item.email,
        address: item.address,
        trn: item.trn,
        notes: item.notes,
        active,
      });
      await reload();
      notify(active ? "Supplier activated" : "Supplier deactivated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <section className={page.page}>
      <h1 className={page.title}>Suppliers</h1>
      <p className={page.lede}>
        Supplier directory. Products can optionally be tagged to a supplier.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      {showForm ? (
        <form className={styles.form} onSubmit={onSubmit}>
          <p className={styles.formTitle}>
            {editingId ? "Edit supplier" : "New supplier"}
          </p>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>Name *</label>
              <input
                className={styles.input}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Contact person</label>
              <input
                className={styles.input}
                value={draft.contact}
                onChange={(e) =>
                  setDraft({ ...draft, contact: e.target.value })
                }
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Phone</label>
              <input
                className={styles.input}
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input
                className={styles.input}
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>TRN</label>
              <input
                className={styles.input}
                value={draft.trn}
                onChange={(e) => setDraft({ ...draft, trn: e.target.value })}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Address</label>
              <input
                className={styles.input}
                value={draft.address}
                onChange={(e) =>
                  setDraft({ ...draft, address: e.target.value })
                }
              />
            </div>
          </div>
          <div className={styles.field} style={{ marginTop: "0.9rem" }}>
            <label className={styles.label}>Notes</label>
            <textarea
              className={styles.textarea}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
          <div className={styles.field} style={{ marginTop: "0.9rem" }}>
            <label className={styles.label} style={{ display: "flex", gap: 8 }}>
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) =>
                  setDraft({ ...draft, active: e.target.checked })
                }
              />
              Active
            </label>
          </div>
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Create"}
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
      ) : (
        <>
          <div className={styles.toolbar}>
            <span className={styles.count}>{items.length} suppliers</span>
            <button className={styles.button} onClick={startCreate}>
              New supplier
            </button>
          </div>

          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search suppliers by name, contact, phone…"
          />

          {filtered.length === 0 ? (
            <div className={styles.empty}>
              {query
                ? "No suppliers match your search."
                : "No suppliers yet. Suppliers are optional on products."}
            </div>
          ) : (
            <ul className={styles.list}>
              {pager.paged.map((item) => (
                <li key={item.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <EditIconButton onClick={() => startEdit(item)} />
                    <div className={styles.cardContent}>
                      <h2 className={styles.cardTitle}>
                        {item.name}
                        {item.active === false ? " (inactive)" : ""}
                      </h2>
                      <p className={styles.cardMeta}>
                        {[item.contact, item.phone, item.email]
                          .filter(Boolean)
                          .join(" · ") || "No contact details"}
                      </p>
                      {item.address ? (
                        <p className={styles.cardMeta}>{item.address}</p>
                      ) : null}
                      <span className={styles.tag}>
                        {item._count?.products ?? 0} products
                      </span>
                    </div>
                    <div className={styles.cardActions}>
                      <button
                        className={styles.ghost}
                        onClick={() => void setActive(item, !item.active)}
                      >
                        {item.active === false ? "Activate" : "Deactivate"}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
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

      <Toast flash={flash} />
    </section>
  );
}
