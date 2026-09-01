"use client";

import { useEffect, useState } from "react";
import {
  MODULE_NAV,
  SHOW_NOTIFICATIONS,
  type SessionPayload,
} from "@marble/types";
import { apiFetch, apiPost } from "@/lib/api";
import { amount, day, moneyHeader } from "@/lib/format";
import {
  DashboardHero,
  DashboardMetric,
  DashboardMosaic,
  DashboardSection,
  DashboardShortcuts,
} from "@/components/Dashboard";
import styles from "./page.module.css";
import crud from "@/components/crud.module.css";

type Company = {
  id: string;
  name: string;
  slug: string;
  profile: {
    legalName: string;
    tradeName: string | null;
    trn: string | null;
    currency: string;
  } | null;
};

type Dashboard = {
  subscription: {
    planName: string;
    status: string;
    expiresAt: string | null;
    trialEndsAt: string | null;
  } | null;
  seats: { active: number; cap: number; deactivated: number };
  openQuotations: number;
  openJobs: number;
  outstandingInvoiceCount: number;
  arTotal: number;
  overdueInvoiceCount: number;
  unreadNotifications: number;
  openSupportCount: number;
};

type SampleStatus = {
  eligible: boolean;
  status: string;
  counts: Record<string, number> | null;
  canLoad: boolean;
  canErase: boolean;
};

export default function HomePage() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [sample, setSample] = useState<SampleStatus | null>(null);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [s, c] = await Promise.all([
          apiFetch<SessionPayload>("/auth/session"),
          apiFetch<Company>("/company/me"),
        ]);
        setSession(s);
        setCompany(c);
        if (s.companyRole === "admin") {
          const [d, sampleStatus] = await Promise.all([
            apiFetch<Dashboard>("/company/dashboard"),
            apiFetch<SampleStatus>("/company/sample-data"),
          ]);
          setDashboard(d);
          setSample(sampleStatus);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load session");
      }
    })();
  }, []);

  async function reloadSample() {
    setSample(await apiFetch<SampleStatus>("/company/sample-data"));
  }

  async function loadSample() {
    if (sampleBusy || !sample?.canLoad) return;
    setSampleBusy(true);
    setError(null);
    try {
      await apiPost("/company/sample-data/load", {});
      await reloadSample();
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sample data could not be loaded");
    } finally {
      setSampleBusy(false);
    }
  }

  async function eraseSample() {
    if (sampleBusy || !sample?.canErase || !company) return;
    let confirmation: string | null;
    try {
      const preview = await apiFetch<{ counts: Record<string, number> }>(
        "/company/sample-data/preview-erase",
      );
      const summary = Object.entries(preview.counts)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
      confirmation = window.prompt(
        `This permanently deletes trial data (${summary}). Type ERASE ${company.name} to continue.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare sample data erase");
      return;
    }
    if (confirmation !== `ERASE ${company.name}`) return;
    setSampleBusy(true);
    setError(null);
    try {
      await apiPost("/company/sample-data/erase", { confirmation });
      await reloadSample();
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sample data could not be erased");
    } finally {
      setSampleBusy(false);
    }
  }

  const isAdmin = session?.companyRole === "admin";
  const sub = dashboard?.subscription;
  const chipTone =
    sub?.status === "trial"
      ? "trial"
      : sub?.status === "active"
        ? "active"
        : "muted";

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>{isAdmin ? "Dashboard" : "Home"}</h1>

      {error ? <p className={styles.error}>{error}</p> : null}

      {isAdmin && dashboard ? (
        <>
          <DashboardHero
            title={company?.name ?? "Company"}
            subtitle={
              sub
                ? `${sub.planName}${
                    sub.expiresAt
                      ? ` · expires ${day(sub.expiresAt)}`
                      : sub.trialEndsAt
                        ? ` · trial ends ${day(sub.trialEndsAt)}`
                        : ""
                  }`
                : "No subscription on file"
            }
            chip={sub?.status ?? "unknown"}
            chipTone={chipTone}
          />

          <DashboardSection title="Work snapshot">
            <DashboardMosaic>
              <DashboardMetric
                href="/team"
                label="Active seats"
                value={
                  dashboard.seats.cap > 0
                    ? `${dashboard.seats.active}/${dashboard.seats.cap}`
                    : dashboard.seats.active
                }
                hint={`${dashboard.seats.deactivated} deactivated`}
              />
              <DashboardMetric
                href="/quotations"
                label="Open quotations"
                value={dashboard.openQuotations}
              />
              <DashboardMetric
                href="/jobs"
                label="Open jobs"
                value={dashboard.openJobs}
              />
              <DashboardMetric
                href="/invoices"
                label="Outstanding"
                value={dashboard.outstandingInvoiceCount}
                hint={`${moneyHeader('AR')} ${amount(dashboard.arTotal)}`}
              />
              <DashboardMetric
                href="/invoices"
                label="Overdue"
                value={dashboard.overdueInvoiceCount}
              />
              {SHOW_NOTIFICATIONS ? (
                <DashboardMetric
                  href="/notifications"
                  label="Unread"
                  value={dashboard.unreadNotifications}
                />
              ) : null}
              <DashboardMetric
                href="/support"
                label="Open support"
                value={dashboard.openSupportCount}
              />
              <DashboardMetric
                href="/subscription"
                label="Plan"
                value={sub?.planName ?? "—"}
                hint={sub?.status}
              />
            </DashboardMosaic>
          </DashboardSection>

          {isAdmin && sample?.eligible ? (
            <DashboardSection title="Trial workspace">
              <div className={crud.card}>
                <p className={crud.cardTitle}>Generic sample data</p>
                <p className={crud.cardMeta}>
                  Load a complete demo workspace for this trial company. You
                  can erase it while the trial remains active.
                </p>
                <div className={crud.actions}>
                  {sample.canLoad ? (
                    <button
                      className={crud.button}
                      type="button"
                      disabled={sampleBusy}
                      onClick={() => void loadSample()}
                    >
                      {sampleBusy ? "Loading…" : "Load sample data"}
                    </button>
                  ) : null}
                  {sample.canErase ? (
                    <button
                      className={`${crud.ghost} ${crud.danger}`}
                      type="button"
                      disabled={sampleBusy}
                      onClick={() => void eraseSample()}
                    >
                      {sampleBusy ? "Working…" : "Erase sample data"}
                    </button>
                  ) : null}
                </div>
              </div>
            </DashboardSection>
          ) : null}

          <DashboardSection title="Shortcuts">
            <DashboardShortcuts
              items={[
                { href: "/customers", label: "Customers" },
                { href: "/quotations", label: "Quotations" },
                { href: "/jobs", label: "Jobs" },
                { href: "/invoices", label: "Invoices" },
                { href: "/reports", label: "Reports" },
                { href: "/team", label: "Team" },
                { href: "/support", label: "Support" },
                { href: "/subscription", label: "Renew" },
              ]}
            />
          </DashboardSection>
        </>
      ) : null}

      {!isAdmin ? (
        <>
          <DashboardHero
            title={company?.name ?? "Workspace"}
            subtitle={
              session ? `Signed in as ${session.email}` : "Loading session…"
            }
          />
          <DashboardSection title="Modules">
            <DashboardShortcuts
              items={MODULE_NAV.filter((m) => m.key !== "home").map((item) => ({
                href: item.href,
                label: item.label,
              }))}
            />
          </DashboardSection>
        </>
      ) : null}

      {isAdmin && !dashboard && !error ? (
        <p className={crud.cardMeta}>Loading dashboard…</p>
      ) : null}
    </section>
  );
}
