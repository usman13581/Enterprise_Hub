"use client";

import { FormEvent, useState } from "react";
import { apiDelete, apiPost, apiPut } from "@/lib/api";
import {
  searchItems,
  useFlash,
  usePagination,
  usePolledList,
} from "@/lib/useCollection";
import { Pagination, SearchBox, Toast } from "@/components/ListControls";
import type { Customer } from "@/lib/types";
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
};

const EMPTY: Draft = {
  name: "",
  contact: "",
  phone: "",
  email: "",
  address: "",
  trn: "",
  notes: "",
};

export default function CustomersPage() {
  const { items, error, setError, reload } =
    usePolledList<Customer>("/customers");
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

  function startEdit(item: Customer) {
    setDraft({
      name: item.name,
      contact: item.contact ?? "",
      phone: item.phone ?? "",
      email: item.email ?? "",
      address: item.address ?? "",
      trn: item.trn ?? "",
      notes: item.notes ?? "",
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
        await apiPut(`/customers/${editingId}`, draft);
      } else {
        await apiPost("/customers", draft);
      }
      setShowForm(false);
      setEditingId(null);
      setDraft(EMPTY);
      await reload();
      notify(wasEditing ? "Customer saved" : "Customer added");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await apiDelete(`/customers/${id}`);
      await reload();
      notify("Customer deleted", "danger");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <section className={page.page}>
      <h1 className={page.title}>Customers</h1>
      <p className={page.lede}>
        Customer records for quotations, jobs, and invoices. Lists update
        automatically.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      {showForm ? (
        <form className={styles.form} onSubmit={onSubmit}>
          <p className={styles.formTitle}>
            {editingId ? "Edit customer" : "New customer"}
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
            <span className={styles.count}>{items.length} customers</span>
            <button className={styles.button} onClick={startCreate}>
              New customer
            </button>
          </div>

          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search customers by name, phone, email, TRN…"
          />

          {filtered.length === 0 ? (
            <div className={styles.empty}>
              {query
                ? "No customers match your search."
                : "No customers yet. Add your first customer to get started."}
            </div>
          ) : (
            <ul className={styles.list}>
              {pager.paged.map((item) => (
                <li key={item.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <div>
                      <h2 className={styles.cardTitle}>{item.name}</h2>
                      <p className={styles.cardMeta}>
                        {[item.contact, item.phone, item.email]
                          .filter(Boolean)
                          .join(" · ") || "No contact details"}
                      </p>
                      {item.trn ? (
                        <p className={styles.cardMeta}>TRN {item.trn}</p>
                      ) : null}
                      {item.address ? (
                        <p className={styles.cardMeta}>{item.address}</p>
                      ) : null}
                    </div>
                    <div className={styles.cardActions}>
                      <button
                        className={styles.ghost}
                        onClick={() => startEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        className={`${styles.ghost} ${styles.danger}`}
                        onClick={() => void onDelete(item.id)}
                      >
                        Delete
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
