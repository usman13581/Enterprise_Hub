"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch, apiPost, apiUpload, assetUrl } from "@/lib/api";
import { day, money } from "@/lib/format";
import {
  searchItems,
  usePagination,
  usePolledList,
} from "@/lib/useCollection";
import { Pagination, SearchBox } from "@/components/ListControls";
import page from "../page.module.css";
import styles from "@/components/crud.module.css";

type Subscription = {
  planName: string;
  planCode: string;
  status: string;
  isDemo: boolean;
  demoCleanupStatus: string | null;
  startsAt: string;
  trialEndsAt: string | null;
  expiresAt: string | null;
  seats: number;
  lastPaymentAmount: number | null;
  lastPaymentAt: string | null;
} | null;

type RenewalRequest = {
  id: string;
  amount: number;
  paidAt: string;
  bankReference: string | null;
  notes: string | null;
  depositDocumentUrl: string;
  status: string;
  createdAt: string;
  rejectReason: string | null;
};

export default function SubscriptionPage() {
  const [sub, setSub] = useState<Subscription>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [notes, setNotes] = useState("");
  const [depositUrl, setDepositUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const { items: requests, reload } = usePolledList<RenewalRequest>(
    "/company/subscription/renewal-requests",
  );
  const [query, setQuery] = useState("");
  const filteredRequests = searchItems(requests, query);
  const requestPager = usePagination(filteredRequests, query);

  useEffect(() => {
    apiFetch<Subscription>("/company/subscription")
      .then(setSub)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load"),
      );
  }, []);

  async function onUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { url } = await apiUpload(file);
      setDepositUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!depositUrl) {
      setError("Upload a deposit document first");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiPost("/company/subscription/renewal-requests", {
        amount: Number(amount),
        paidAt,
        bankReference: bankReference || undefined,
        notes: notes || undefined,
        depositDocumentUrl: depositUrl,
      });
      setAmount("");
      setPaidAt("");
      setBankReference("");
      setNotes("");
      setDepositUrl("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSaving(false);
    }
  }

  async function cancelTrial() {
    if (!sub?.isDemo || cancelling) return;
    if (
      !window.confirm(
        "Cancel this trial? All company data will be permanently removed, while the inactive registration is retained.",
      )
    ) {
      return;
    }
    setCancelling(true);
    setError(null);
    try {
      await apiPost("/company/subscription/cancel-trial", {});
      window.location.href = "/login";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancellation failed");
      setCancelling(false);
    }
  }

  return (
    <section className={page.page}>
      <h1 className={page.title}>Subscription</h1>
      <p className={page.lede}>
        Plan dates and renewal deposit requests for your company.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={page.panel}>
        <p className={page.panelTitle}>Current plan</p>
        {sub ? (
          <p className={page.meta}>
            {sub.planName} ({sub.planCode}) · {sub.status}
            <br />
            Starts {day(sub.startsAt)}
            {sub.trialEndsAt ? ` · trial ends ${day(sub.trialEndsAt)}` : ""}
            {sub.expiresAt ? ` · expires ${day(sub.expiresAt)}` : ""}
            <br />
            Seats: {sub.seats}
            {sub.lastPaymentAt
              ? ` · last payment ${money(sub.lastPaymentAmount)} on ${day(sub.lastPaymentAt)}`
              : ""}
          </p>
        ) : (
          <p className={page.meta}>Loading…</p>
        )}
      </div>

      {sub?.isDemo && sub.status === "trial" ? (
        <div className={page.panel}>
          <p className={page.panelTitle}>Cancel trial</p>
          <p className={page.meta}>
            Cancelling permanently removes this demo company and its data.
            The inactive registration is retained.
          </p>
          <button
            className={`${styles.ghost} ${styles.danger}`}
            type="button"
            disabled={cancelling}
            onClick={() => void cancelTrial()}
          >
            {cancelling ? "Cancelling…" : "Cancel trial"}
          </button>
        </div>
      ) : null}

      <form className={styles.form} onSubmit={onSubmit}>
        <p className={styles.formTitle}>Request renewal</p>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label}>Amount (AED)</label>
            <input
              className={styles.input}
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Paid at</label>
            <input
              className={styles.input}
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Bank reference</label>
            <input
              className={styles.input}
              value={bankReference}
              onChange={(e) => setBankReference(e.target.value)}
            />
          </div>
        </div>
        <div className={styles.field} style={{ marginTop: "0.9rem" }}>
          <label className={styles.label}>Notes</label>
          <textarea
            className={styles.textarea}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className={styles.uploadRow}>
          <input
            className={styles.fileInput}
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
          />
          {uploading ? <span className={styles.count}>Uploading…</span> : null}
          {depositUrl ? (
            <a
              href={assetUrl(depositUrl) ?? "#"}
              target="_blank"
              rel="noreferrer"
            >
              Deposit uploaded
            </a>
          ) : null}
        </div>
        <div className={styles.actions}>
          <button className={styles.button} type="submit" disabled={saving}>
            {saving ? "Submitting…" : "Submit renewal request"}
          </button>
        </div>
      </form>

      <h2 className={page.panelTitle} style={{ marginTop: "1.5rem" }}>
        Renewal requests
      </h2>
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search renewal requests by status or reference…"
      />
      {filteredRequests.length === 0 ? (
        <div className={styles.empty}>No renewal requests yet.</div>
      ) : (
        <ul className={styles.list}>
          {requestPager.paged.map((r) => (
            <li key={r.id} className={styles.card}>
              <strong>
                {money(r.amount)} · {r.status}
              </strong>
              <p className={styles.cardMeta}>
                Paid {day(r.paidAt)} · submitted {day(r.createdAt)}
                {r.bankReference ? ` · ref ${r.bankReference}` : ""}
                {r.rejectReason ? ` · ${r.rejectReason}` : ""}
              </p>
              <a
                href={assetUrl(r.depositDocumentUrl) ?? "#"}
                target="_blank"
                rel="noreferrer"
              >
                Deposit
              </a>
            </li>
          ))}
        </ul>
      )}
      {filteredRequests.length > 0 ? (
        <Pagination
          page={requestPager.page}
          setPage={requestPager.setPage}
          pageSize={requestPager.pageSize}
          setPageSize={requestPager.setPageSize}
          pageCount={requestPager.pageCount}
          total={requestPager.total}
        />
      ) : null}
    </section>
  );
}
