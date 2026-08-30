"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, apiPatch, apiPost } from "@/lib/api";
import { beginReadOnlyWorkspace, getAuthToken } from "@/lib/auth";
import { day, money } from "@/lib/format";
import page from "../../../page.module.css";
import styles from "@/components/crud.module.css";

type Plan = {
  id: string;
  name: string;
  code: string;
  interval: string;
  priceAed: number;
  trialDays: number;
  maxUsers: number;
  active: boolean;
};

type IndustryCategory = {
  id: string;
  name: string;
  code: string;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  companyRole: string;
  accessExpiresAt: string | null;
};

type CompanyDetail = {
  id: string;
  name: string;
  slug: string;
  suspendedAt: string | null;
  industryCategoryId: string | null;
  industryCategory?: IndustryCategory | null;
  subscription?: {
    planId: string;
    status: string;
    startsAt: string;
    trialEndsAt: string | null;
    expiresAt: string | null;
    seatsIncluded: number;
    seatsOverride: number | null;
    note: string | null;
    plan?: Plan;
  } | null;
};

export default function AdminCompanyDetailPage() {
  const params = useParams();
  const id = String(params.id);

  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [categories, setCategories] = useState<IndustryCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [industryCategoryId, setIndustryCategoryId] = useState("");
  const [planId, setPlanId] = useState("");
  const [subStatus, setSubStatus] = useState("active");
  const [expiresAt, setExpiresAt] = useState("");
  const [seatsOverride, setSeatsOverride] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [paymentReference, setPaymentReference] = useState("");

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRole, setUserRole] = useState<"admin" | "member">("member");

  async function reload() {
    const [c, u, p, cats] = await Promise.all([
      apiFetch<CompanyDetail>(`/admin/companies/${id}`),
      apiFetch<UserRow[]>(`/admin/companies/${id}/users`),
      apiFetch<Plan[]>("/admin/plans"),
      apiFetch<IndustryCategory[]>("/admin/industry-categories"),
    ]);
    setCompany(c);
    setUsers(u);
    setPlans(p);
    setCategories(cats);
    setIndustryCategoryId(c.industryCategoryId ?? "");
    setPlanId(c.subscription?.planId ?? p[0]?.id ?? "");
    setSubStatus(c.subscription?.status ?? "active");
    setExpiresAt(c.subscription?.expiresAt?.slice(0, 10) ?? "");
    setSeatsOverride(
      c.subscription?.seatsOverride != null
        ? String(c.subscription.seatsOverride)
        : "",
    );
  }

  useEffect(() => {
    reload().catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveIndustry() {
    setBusy(true);
    setError(null);
    try {
      await apiPatch(`/admin/companies/${id}`, {
        industryCategoryId: industryCategoryId || null,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSuspend() {
    if (!company) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(
        `/admin/companies/${id}/${company.suspendedAt ? "unsuspend" : "suspend"}`,
        {},
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function openWorkspace() {
    if (busy || !getAuthToken()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost<{ token: string }>(
        `/admin/companies/${id}/workspace`,
        {},
      );
      beginReadOnlyWorkspace(result.token);
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Workspace access failed");
      setBusy(false);
    }
  }

  async function saveSubscription(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPatch(`/admin/companies/${id}/subscription`, {
        planId,
        status: subStatus,
        expiresAt: expiresAt || undefined,
        seatsOverride: seatsOverride === "" ? null : Number(seatsOverride),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Subscription save failed");
    } finally {
      setBusy(false);
    }
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/admin/companies/${id}/users`, {
        name: userName,
        email: userEmail,
        password: userPassword,
        companyRole: userRole,
      });
      setUserName("");
      setUserEmail("");
      setUserPassword("");
      setUserRole("member");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create user failed");
    } finally {
      setBusy(false);
    }
  }

  async function recordPayment(event: FormEvent) {
    event.preventDefault();
    if (!paymentAmount || !paymentDate) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/admin/companies/${id}/subscription/manual-payment`, {
        amount: Number(paymentAmount),
        paidAt: paymentDate,
        reference: paymentReference || undefined,
        extendExpiresAt: expiresAt || undefined,
      });
      setPaymentAmount("");
      setPaymentReference("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  async function patchUser(
    userId: string,
    body: { active?: boolean; companyRole?: "admin" | "member" },
  ) {
    setBusy(true);
    setError(null);
    try {
      await apiPatch(`/admin/users/${userId}`, body);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update user failed");
    } finally {
      setBusy(false);
    }
  }

  if (!company && !error) {
    return (
      <section className={page.page}>
        <p className={page.meta}>Loading…</p>
      </section>
    );
  }

  return (
    <section className={page.page}>
      <Link href="/admin/companies" className={page.backNav}>
        ← Companies
      </Link>
      <h1 className={page.title}>{company?.name ?? "Company"}</h1>
      <p className={page.lede}>
        {company?.slug}
        {company?.suspendedAt ? " · SUSPENDED" : ""}
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.button}
          disabled={busy}
          onClick={() => void openWorkspace()}
        >
          Open application (read-only)
        </button>
        <button
          type="button"
          className={company?.suspendedAt ? styles.button : `${styles.ghost} ${styles.danger}`}
          disabled={busy}
          onClick={() => void toggleSuspend()}
        >
          {company?.suspendedAt ? "Unsuspend" : "Suspend"}
        </button>
      </div>

      <div className={styles.form}>
        <p className={styles.formTitle}>Industry category</p>
        <div className={styles.field}>
          <select
            className={styles.select}
            value={industryCategoryId}
            onChange={(e) => setIndustryCategoryId(e.target.value)}
          >
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            disabled={busy}
            onClick={() => void saveIndustry()}
          >
            Save category
          </button>
        </div>
      </div>

      <form className={styles.form} onSubmit={saveSubscription}>
        <p className={styles.formTitle}>Subscription</p>
        {company?.subscription ? (
          <p className={styles.cardMeta}>
            Current: {company.subscription.plan?.name} ·{" "}
            {company.subscription.status}
            {company.subscription.expiresAt
              ? ` · expires ${day(company.subscription.expiresAt)}`
              : ""}
          </p>
        ) : (
          <p className={styles.cardMeta}>No subscription yet — set a plan below.</p>
        )}
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
                  {p.name} ({money(p.priceAed)})
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Status</label>
            <select
              className={styles.select}
              value={subStatus}
              onChange={(e) => setSubStatus(e.target.value)}
            >
              <option value="trial">trial</option>
              <option value="active">active</option>
              <option value="past_due">past_due</option>
              <option value="cancelled">cancelled</option>
              <option value="expired">expired</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Expires at</label>
            <input
              className={styles.input}
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Seats override</label>
            <input
              className={styles.input}
              type="number"
              min="0"
              value={seatsOverride}
              onChange={(e) => setSeatsOverride(e.target.value)}
              placeholder="Plan default"
            />
          </div>
        </div>
        <div className={styles.actions}>
          <button className={styles.button} type="submit" disabled={busy}>
            Save subscription
          </button>
        </div>
      </form>

      <form className={styles.form} onSubmit={recordPayment}>
        <p className={styles.formTitle}>Record manual payment</p>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label}>Amount (AED)</label>
            <input
              className={styles.input}
              type="number"
              min="0"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Paid at</label>
            <input
              className={styles.input}
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Reference</label>
            <input
              className={styles.input}
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
            />
          </div>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.button}
            type="submit"
            disabled={busy || !paymentAmount}
          >
            {busy ? "Saving…" : "Record payment"}
          </button>
        </div>
      </form>

      <form className={styles.form} onSubmit={createUser}>
        <p className={styles.formTitle}>Add user</p>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label}>Name</label>
            <input
              className={styles.input}
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input
              className={styles.input}
              type="password"
              value={userPassword}
              onChange={(e) => setUserPassword(e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Role</label>
            <select
              className={styles.select}
              value={userRole}
              onChange={(e) =>
                setUserRole(e.target.value as "admin" | "member")
              }
            >
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
          </div>
        </div>
        <div className={styles.actions}>
          <button className={styles.button} type="submit" disabled={busy}>
            Create user
          </button>
        </div>
      </form>

      <h2 className={page.panelTitle}>Users</h2>
      {users.length === 0 ? (
        <div className={styles.empty}>No users.</div>
      ) : (
        <ul className={styles.list}>
          {users.map((u) => (
            <li key={u.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div className={styles.cardContent}>
                  <p className={styles.cardTitle}>{u.name}</p>
                  <p className={styles.cardMeta}>
                    {u.email} · {u.companyRole} ·{" "}
                    {u.active ? "active" : "inactive"}
                  </p>
                </div>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.ghost}
                    disabled={busy}
                    onClick={() =>
                      void patchUser(u.id, {
                        companyRole:
                          u.companyRole === "admin" ? "member" : "admin",
                      })
                    }
                  >
                    Make {u.companyRole === "admin" ? "member" : "admin"}
                  </button>
                  <button
                    type="button"
                    className={styles.ghost}
                    disabled={busy}
                    onClick={() =>
                      void patchUser(u.id, { active: !u.active })
                    }
                  >
                    {u.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
