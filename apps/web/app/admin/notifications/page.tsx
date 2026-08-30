"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch, apiPost } from "@/lib/api";
import { day } from "@/lib/format";
import {
  searchItems,
  usePagination,
  usePolledList,
} from "@/lib/useCollection";
import { Pagination, SearchBox } from "@/components/ListControls";
import page from "../../page.module.css";
import styles from "@/components/crud.module.css";

type CompanyRow = {
  id: string;
  name: string;
};

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  audience: string;
  kind: string;
  source: string;
  createdAt: string;
  companyId: string | null;
};

export default function AdminNotificationsPage() {
  const { items, error, setError, reload } =
    usePolledList<NotificationRow>("/admin/notifications?limit=100");
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"company_admins" | "all_users">(
    "company_admins",
  );
  const [target, setTarget] = useState<"all" | "selected">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void apiFetch<CompanyRow[]>("/admin/companies").then(setCompanies);
  }, []);

  async function onCompose(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await apiPost("/admin/notifications", {
        title,
        body,
        audience,
        companyIds: target === "all" ? "all" : selected,
      });
      setTitle("");
      setBody("");
      setSelected([]);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSaving(false);
    }
  }

  function toggleCompany(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const filtered = searchItems(items, query);
  const pager = usePagination(filtered, query);

  return (
    <section className={page.page}>
      <h1 className={page.title}>Notifications</h1>
      <p className={page.lede}>
        Broadcast messages to company admins or all users.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      <form className={styles.form} onSubmit={onCompose}>
        <p className={styles.formTitle}>Compose</p>
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
          <label className={styles.label}>Body</label>
          <textarea
            className={styles.textarea}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </div>
        <div className={styles.grid} style={{ marginTop: "0.9rem" }}>
          <div className={styles.field}>
            <label className={styles.label}>Audience</label>
            <select
              className={styles.select}
              value={audience}
              onChange={(e) =>
                setAudience(
                  e.target.value as "company_admins" | "all_users",
                )
              }
            >
              <option value="company_admins">Company admins</option>
              <option value="all_users">All users</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Companies</label>
            <select
              className={styles.select}
              value={target}
              onChange={(e) =>
                setTarget(e.target.value as "all" | "selected")
              }
            >
              <option value="all">All companies</option>
              <option value="selected">Selected companies</option>
            </select>
          </div>
        </div>
        {target === "selected" ? (
          <div
            style={{
              marginTop: "0.75rem",
              maxHeight: 180,
              overflow: "auto",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "0.5rem 0.75rem",
            }}
          >
            {companies.map((c) => (
              <label
                key={c.id}
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "center",
                  fontSize: "0.88rem",
                  marginBottom: "0.35rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={() => toggleCompany(c.id)}
                />
                {c.name}
              </label>
            ))}
          </div>
        ) : null}
        <div className={styles.actions}>
          <button className={styles.button} type="submit" disabled={saving}>
            {saving ? "Sending…" : "Send"}
          </button>
        </div>
      </form>

      <h2 className={page.panelTitle} style={{ marginTop: "1.25rem" }}>
        History
      </h2>
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search notifications by title or message…"
      />
      {filtered.length === 0 ? (
        <div className={styles.empty}>No notifications sent yet.</div>
      ) : (
        <ul className={styles.list}>
          {pager.paged.map((n) => (
            <li key={n.id} className={styles.card}>
              <strong>{n.title}</strong>
              <p className={styles.cardMeta}>
                {day(n.createdAt)} · {n.audience} · {n.source}
              </p>
              <p className={styles.cardMeta}>{n.body}</p>
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
