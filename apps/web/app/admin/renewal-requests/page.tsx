"use client";

import { useState } from "react";
import { apiPost, assetUrl } from "@/lib/api";
import { day, money } from "@/lib/format";
import {
  searchItems,
  usePagination,
  usePolledList,
} from "@/lib/useCollection";
import { Pagination, SearchBox } from "@/components/ListControls";
import page from "../../page.module.css";
import styles from "@/components/crud.module.css";

type Renewal = {
  id: string;
  amount: number;
  paidAt: string;
  bankReference: string | null;
  notes: string | null;
  depositDocumentUrl: string;
  status: string;
  createdAt: string;
  rejectReason: string | null;
  company: { id: string; name: string; slug: string };
  submittedBy?: { name: string; email: string };
};

export default function AdminRenewalsPage() {
  const { items, error, setError, reload } =
    usePolledList<Renewal>("/admin/renewal-requests");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [query, setQuery] = useState("");

  async function approve(id: string) {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      await apiPost(`/admin/renewal-requests/${id}/approve`, {
        expiresAt: expiresAt || undefined,
      });
      setExpiresAt("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    if (busyId) return;
    const reason = window.prompt("Reject reason?");
    if (!reason?.trim()) return;
    setBusyId(id);
    setError(null);
    try {
      await apiPost(`/admin/renewal-requests/${id}/reject`, {
        reason: reason.trim(),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = searchItems(items, query);
  const pager = usePagination(filtered, query);

  return (
    <section className={page.page}>
      <h1 className={page.title}>Renewal requests</h1>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.field} style={{ maxWidth: 220, marginTop: "0.75rem" }}>
        <label className={styles.label}>Approve expires at (optional)</label>
        <input
          className={styles.input}
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
      </div>

      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search renewals by company, email, reference…"
      />

      {filtered.length === 0 ? (
        <div className={styles.empty}>No renewal requests.</div>
      ) : (
        <ul className={styles.list}>
          {pager.paged.map((r) => (
            <li key={r.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div className={styles.cardContent}>
                  <p className={styles.cardTitle}>
                    {r.company.name} · {money(r.amount)}
                  </p>
                  <p className={styles.cardMeta}>
                    {r.status} · paid {day(r.paidAt)} · submitted{" "}
                    {day(r.createdAt)}
                    {r.bankReference ? ` · ref ${r.bankReference}` : ""}
                    {r.submittedBy
                      ? ` · by ${r.submittedBy.name}`
                      : ""}
                    {r.rejectReason ? ` · ${r.rejectReason}` : ""}
                  </p>
                  {r.notes ? (
                    <p className={styles.cardMeta}>{r.notes}</p>
                  ) : null}
                  <a
                    href={assetUrl(r.depositDocumentUrl) ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Deposit document
                  </a>
                </div>
                {r.status === "pending" ? (
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.button}
                      disabled={!!busyId}
                      onClick={() => void approve(r.id)}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className={`${styles.ghost} ${styles.danger}`}
                      disabled={!!busyId}
                      onClick={() => void reject(r.id)}
                    >
                      Reject
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
