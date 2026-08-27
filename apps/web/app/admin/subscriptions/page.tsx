"use client";

import Link from "next/link";
import { day } from "@/lib/format";
import { searchItems, usePolledList } from "@/lib/useCollection";
import { SearchBox } from "@/components/ListControls";
import { useState } from "react";
import page from "../../page.module.css";
import styles from "@/components/crud.module.css";

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  suspendedAt: string | null;
  subscription?: {
    status: string;
    startsAt: string;
    trialEndsAt: string | null;
    expiresAt: string | null;
    seatsIncluded: number;
    seatsOverride: number | null;
    plan?: { name: string; code: string };
  } | null;
};

export default function AdminSubscriptionsPage() {
  const { items, error } = usePolledList<CompanyRow>("/admin/companies");
  const [query, setQuery] = useState("");
  const filtered = searchItems(items, query);

  return (
    <section className={page.page}>
      <h1 className={page.title}>Subscriptions</h1>
      <p className={page.lede}>
        All company subscriptions. Open a company to edit.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search companies…"
      />

      <ul className={styles.list}>
        {filtered.map((c) => (
          <li key={c.id} className={styles.card}>
            <Link href={`/admin/companies/${c.id}`}>
              <strong>{c.name}</strong>
              <p className={styles.cardMeta}>
                {c.subscription
                  ? `${c.subscription.plan?.name ?? "Plan"} · ${c.subscription.status}` +
                    (c.subscription.expiresAt
                      ? ` · expires ${day(c.subscription.expiresAt)}`
                      : c.subscription.trialEndsAt
                        ? ` · trial ends ${day(c.subscription.trialEndsAt)}`
                        : ` · started ${day(c.subscription.startsAt)}`) +
                    ` · seats ${c.subscription.seatsOverride ?? c.subscription.seatsIncluded}`
                  : "No subscription"}
                {c.suspendedAt ? " · SUSPENDED" : ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
