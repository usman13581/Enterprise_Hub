"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import styles from "./page.module.css";

type Session = {
  companyId: string;
  userId: string;
  email: string;
  companyName: string;
};

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

export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Session>("/auth/session"),
      apiFetch<Company>("/company/me"),
    ])
      .then(([s, c]) => {
        setSession(s);
        setCompany(c);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load session"),
      );
  }, []);

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Home</h1>
      <p className={styles.lede}>
        Phase 0 foundation for Marble with Nuage. Bootstrap session talks to the
        NestJS API with company scope.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.panel}>
        <p className={styles.panelTitle}>Active company</p>
        {session && company ? (
          <ul className={styles.list}>
            <li className={styles.card}>
              <strong>{company.name}</strong>
              <p className={styles.meta}>
                Legal: {company.profile?.legalName ?? "—"} · TRN:{" "}
                {company.profile?.trn ?? "—"} · {company.profile?.currency}
              </p>
              <p className={styles.meta}>
                Actor: <code>{session.email}</code>
              </p>
            </li>
          </ul>
        ) : (
          <p className={styles.meta}>Loading Binhaj Marble session…</p>
        )}
      </div>
    </section>
  );
}
