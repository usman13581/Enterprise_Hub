"use client";

import { FormEvent, useEffect, useState } from "react";
import type { SessionPayload } from "@marble/types";
import { apiFetch, apiPost } from "@/lib/api";
import { day } from "@/lib/format";
import {
  searchItems,
  usePagination,
  usePolledList,
} from "@/lib/useCollection";
import { Pagination, SearchBox } from "@/components/ListControls";
import page from "../page.module.css";
import styles from "@/components/crud.module.css";

type SupportRequest = {
  id: string;
  title: string;
  body: string;
  status: string;
  attachmentUrl: string | null;
  createdAt: string;
  closedAt: string | null;
  closeNote: string | null;
  createdBy?: { name: string; email: string };
};

export default function SupportPage() {
  const { items, error, setError, reload } =
    usePolledList<SupportRequest>("/support/requests");
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void apiFetch<SessionPayload>("/auth/session").then(setSession);
  }, []);

  const isAdmin = session?.companyRole === "admin";

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await apiPost("/support/requests", { title, body });
      setTitle("");
      setBody("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function closeTicket(id: string) {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      await apiPost(`/support/requests/${id}/close`, {});
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Close failed");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = searchItems(items, query);
  const pager = usePagination(filtered, query);

  return (
    <section className={page.page}>
      <h1 className={page.title}>Support</h1>
      <p className={page.lede}>
        Open a ticket for billing, access, or product help.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      <form className={styles.form} onSubmit={onCreate}>
        <p className={styles.formTitle}>New ticket</p>
        <div className={styles.field}>
          <label className={styles.label}>Title</label>
          <input
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className={styles.field} style={{ marginTop: "0.9rem" }}>
          <label className={styles.label}>Details</label>
          <textarea
            className={styles.textarea}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </div>
        <div className={styles.actions}>
          <button className={styles.button} type="submit" disabled={saving}>
            {saving ? "Sending…" : "Submit ticket"}
          </button>
        </div>
      </form>

      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search support by title, status, or email…"
      />

      {filtered.length === 0 ? (
        <div className={styles.empty}>No support tickets yet.</div>
      ) : (
        <ul className={styles.list}>
          {pager.paged.map((t) => (
            <li key={t.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div className={styles.cardContent}>
                  <p className={styles.cardTitle}>{t.title}</p>
                  <p className={styles.cardMeta}>
                    {t.status} · {day(t.createdAt)}
                    {t.createdBy
                      ? ` · ${t.createdBy.name} (${t.createdBy.email})`
                      : ""}
                  </p>
                  <p className={styles.cardMeta}>{t.body}</p>
                  {t.closeNote ? (
                    <p className={styles.cardMeta}>Closed: {t.closeNote}</p>
                  ) : null}
                  <span className={styles.tag}>{t.status}</span>
                </div>
                {isAdmin && t.status === "open" ? (
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.ghost}
                      disabled={busyId === t.id}
                      onClick={() => void closeTicket(t.id)}
                    >
                      {busyId === t.id ? "…" : "Close"}
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
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
