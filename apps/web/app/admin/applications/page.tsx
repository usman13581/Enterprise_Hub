"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch, apiPost } from "@/lib/api";
import { day } from "@/lib/format";
import { usePolledList } from "@/lib/useCollection";
import page from "../../page.module.css";
import styles from "@/components/crud.module.css";

type Application = {
  id: string;
  legalName: string;
  tradeName: string | null;
  contactName: string;
  email: string;
  phone: string;
  emirate: string;
  status: string;
  createdAt: string;
  needs: string | null;
  note: string | null;
};

type Plan = {
  id: string;
  name: string;
  code: string;
};

export default function AdminApplicationsPage() {
  const { items, error, setError, reload } =
    usePolledList<Application>("/admin/applications");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [planId, setPlanId] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    void apiFetch<Plan[]>("/admin/plans").then((p) => {
      setPlans(p);
      if (p[0]) setPlanId(p[0].id);
    });
  }, []);

  async function approve(event: FormEvent) {
    event.preventDefault();
    if (!approveId || busyId) return;
    setBusyId(approveId);
    setError(null);
    try {
      await apiPost(`/admin/applications/${approveId}/approve`, {
        planId,
        ownerPassword,
      });
      setApproveId(null);
      setOwnerPassword("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    if (busyId) return;
    const reason = rejectReason.trim() || prompt("Reject reason?");
    if (!reason) return;
    setBusyId(id);
    setError(null);
    try {
      await apiPost(`/admin/applications/${id}/reject`, { reason });
      setRejectReason("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  }

  const pending = items.filter((a) => a.status === "pending");
  const others = items.filter((a) => a.status !== "pending");

  return (
    <section className={page.page}>
      <h1 className={page.title}>Applications</h1>
      <p className={page.lede}>Approve or reject new company applications.</p>

      {error ? <p className={styles.error}>{error}</p> : null}

      {approveId ? (
        <form className={styles.form} onSubmit={approve}>
          <p className={styles.formTitle}>Approve application</p>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>Plan</label>
              <select
                className={styles.select}
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                required
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Owner password</label>
              <input
                className={styles.input}
                type="password"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <div className={styles.actions}>
            <button
              className={styles.button}
              type="submit"
              disabled={busyId === approveId}
            >
              Confirm approve
            </button>
            <button
              className={styles.ghost}
              type="button"
              onClick={() => setApproveId(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <h2 className={page.panelTitle}>Pending</h2>
      {pending.length === 0 ? (
        <div className={styles.empty}>No pending applications.</div>
      ) : (
        <ul className={styles.list}>
          {pending.map((a) => (
            <li key={a.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div className={styles.cardContent}>
                  <p className={styles.cardTitle}>{a.legalName}</p>
                  <p className={styles.cardMeta}>
                    {a.contactName} · {a.email} · {a.phone} · {a.emirate}
                    <br />
                    Submitted {day(a.createdAt)}
                    {a.needs ? ` · ${a.needs}` : ""}
                  </p>
                </div>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.button}
                    disabled={!!busyId}
                    onClick={() => setApproveId(a.id)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className={`${styles.ghost} ${styles.danger}`}
                    disabled={!!busyId}
                    onClick={() => void reject(a.id)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {others.length > 0 ? (
        <>
          <h2 className={page.panelTitle} style={{ marginTop: "1.25rem" }}>
            History
          </h2>
          <ul className={styles.list}>
            {others.map((a) => (
              <li key={a.id} className={styles.card}>
                <strong>
                  {a.legalName} · {a.status}
                </strong>
                <p className={styles.cardMeta}>
                  {a.email} · {day(a.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
