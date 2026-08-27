"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  DashboardHero,
  DashboardMetric,
  DashboardMosaic,
  DashboardSection,
  DashboardShortcuts,
} from "@/components/Dashboard";
import page from "../page.module.css";
import styles from "@/components/crud.module.css";

type Overview = {
  pendingApplications: number;
  applicationsApprovedThisMonth: number;
  applicationsRejectedThisMonth: number;
  subscriptionsByStatus: Record<string, number>;
  expiriesIn7Days: number;
  expiriesIn14Days: number;
  pendingRenewals: number;
  companyCount: number;
  suspendedCount: number;
  activeUsers: number;
  openSupport: number;
};

export default function AdminHomePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Overview>("/admin/overview")
      .then(setData)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load"),
      );
  }, []);

  const statusEntries = Object.entries(data?.subscriptionsByStatus ?? {});
  const statusHint = statusEntries.length
    ? statusEntries.map(([k, v]) => `${k}: ${v}`).join(" · ")
    : "No subscriptions";

  return (
    <section className={page.page}>
      <h1 className={page.title}>Overview</h1>
      <p className={page.lede}>Platform health at a glance.</p>

      {error ? <p className={styles.error}>{error}</p> : null}

      {!data && !error ? <p className={page.meta}>Loading…</p> : null}

      {data ? (
        <>
          <DashboardHero
            title="Platform admin"
            subtitle={`${data.companyCount} companies · ${data.activeUsers} active users`}
            chip={
              data.pendingApplications > 0
                ? `${data.pendingApplications} pending apps`
                : "Inbox clear"
            }
            chipTone={data.pendingApplications > 0 ? "trial" : "active"}
          />

          <DashboardSection title="Tenants & applications">
            <DashboardMosaic>
              <DashboardMetric
                href="/admin/companies"
                label="Companies"
                value={data.companyCount}
                hint={`${data.suspendedCount} suspended`}
              />
              <DashboardMetric
                href="/admin/applications"
                label="Pending apps"
                value={data.pendingApplications}
                hint={`${data.applicationsApprovedThisMonth} approved · ${data.applicationsRejectedThisMonth} rejected this month`}
              />
              <DashboardMetric
                href="/admin/companies"
                label="Active users"
                value={data.activeUsers}
              />
              <DashboardMetric
                href="/admin/support"
                label="Open support"
                value={data.openSupport}
              />
            </DashboardMosaic>
          </DashboardSection>

          <DashboardSection title="Subscriptions">
            <DashboardMosaic>
              <DashboardMetric
                href="/admin/subscriptions"
                label="By status"
                value={statusEntries.length}
                hint={statusHint}
              />
              <DashboardMetric
                href="/admin/subscriptions"
                label="Expire in 7d"
                value={data.expiriesIn7Days}
              />
              <DashboardMetric
                href="/admin/subscriptions"
                label="Expire in 14d"
                value={data.expiriesIn14Days}
              />
              <DashboardMetric
                href="/admin/renewal-requests"
                label="Pending renewals"
                value={data.pendingRenewals}
              />
            </DashboardMosaic>
          </DashboardSection>

          <DashboardSection title="Shortcuts">
            <DashboardShortcuts
              items={[
                { href: "/admin/companies", label: "Companies" },
                { href: "/admin/applications", label: "Applications" },
                { href: "/admin/renewal-requests", label: "Renewals" },
                { href: "/admin/plans", label: "Plans" },
                { href: "/admin/support", label: "Support" },
                { href: "/admin/audit", label: "Audit" },
              ]}
            />
          </DashboardSection>
        </>
      ) : null}
    </section>
  );
}
