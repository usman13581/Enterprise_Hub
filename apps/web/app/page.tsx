"use client";

import { useEffect, useState } from "react";
import {
  MODULE_NAV,
  SHOW_NOTIFICATIONS,
  type SessionPayload,
} from "@marble/types";
import { apiFetch } from "@/lib/api";
import { day, money } from "@/lib/format";
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

export default function HomePage() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<SessionPayload>("/auth/session"),
      apiFetch<Company>("/company/me"),
    ])
      .then(([s, c]) => {
        setSession(s);
        setCompany(c);
        if (s.companyRole === "admin") {
          return apiFetch<Dashboard>("/company/dashboard").then(setDashboard);
        }
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load session"),
      );
  }, []);

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
      <p className={styles.lede}>
        {isAdmin
          ? "Company overview and shortcuts into each module."
          : "Open a module to continue your work."}
      </p>

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
                hint={`AR ${money(dashboard.arTotal)}`}
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
