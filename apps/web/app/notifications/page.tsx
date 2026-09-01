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

type NotificationReceipt = {
  id: string;
  readAt: string | null;
  createdAt: string;
  notification: {
    id: string;
    title: string;
    body: string;
    kind: string;
    source: string;
    createdAt: string;
  };
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  active: boolean;
};

export default function NotificationsPage() {
  const { items, error, setError, reload } =
    usePolledList<NotificationReceipt>("/notifications");
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all_users" | "one_user">(
    "all_users",
  );
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void apiFetch<SessionPayload>("/auth/session").then((s) => {
      setSession(s);
      if (s.companyRole === "admin") {
        void apiFetch<UserRow[]>("/company/users").then(setUsers);
      }
    });
  }, []);

  const isAdmin = session?.companyRole === "admin";

  async function markRead(notificationId: string) {
    if (busyId) return;
    setBusyId(notificationId);
    setError(null);
    try {
      await apiPost(`/notifications/${notificationId}/read`, {});
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mark read failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onCompose(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await apiPost("/notifications", {
        title,
        body,
        audience,
        userId: audience === "one_user" ? userId : undefined,
      });
      setTitle("");
      setBody("");
      setAudience("all_users");
      setUserId("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSaving(false);
    }
  }

  const filtered = searchItems(items, query);
  const pager = usePagination(filtered, query);

  return (
    <section className={page.page}>
      <h1 className={page.title}>Notifications</h1>

      {error ? <p className={styles.error}>{error}</p> : null}

      {isAdmin ? (
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
                  setAudience(e.target.value as "all_users" | "one_user")
                }
              >
                <option value="all_users">All users</option>
                <option value="one_user">One user</option>
              </select>
            </div>
            {audience === "one_user" ? (
              <div className={styles.field}>
                <label className={styles.label}>User</label>
                <select
                  className={styles.select}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  {users
                    .filter((u) => u.active)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                </select>
              </div>
            ) : null}
          </div>
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={saving}>
              {saving ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      ) : null}

      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search notifications by title or message…"
      />

      {filtered.length === 0 ? (
        <div className={styles.empty}>No notifications yet.</div>
      ) : (
        <ul className={styles.list}>
          {pager.paged.map((r) => (
            <li key={r.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div className={styles.cardContent}>
                  <p className={styles.cardTitle}>{r.notification.title}</p>
                  <p className={styles.cardMeta}>
                    {day(r.notification.createdAt)} · {r.notification.source}
                    {r.readAt ? " · read" : " · unread"}
                  </p>
                  <p className={styles.cardMeta}>{r.notification.body}</p>
                </div>
                {!r.readAt ? (
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.ghost}
                      disabled={busyId === r.notification.id}
                      onClick={() => void markRead(r.notification.id)}
                    >
                      {busyId === r.notification.id ? "…" : "Mark read"}
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
