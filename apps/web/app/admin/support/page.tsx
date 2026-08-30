"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiPost } from "@/lib/api";
import { day } from "@/lib/format";
import { searchItems, usePagination } from "@/lib/useCollection";
import { Pagination, SearchBox } from "@/components/ListControls";
import page from "../../page.module.css";
import styles from "@/components/crud.module.css";

type CompanyRow = { id: string; name: string };

type SupportRequest = {
  id: string;
  title: string;
  body: string;
  status: string;
  createdAt: string;
  closedAt: string | null;
  closeNote: string | null;
  company: { id: string; name: string };
  createdBy?: { name: string; email: string };
};

export default function AdminSupportPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [items, setItems] = useState<SupportRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function load(cid: string) {
    const qs = cid ? `?companyId=${encodeURIComponent(cid)}` : "";
    const rows = await apiFetch<SupportRequest[]>(`/admin/support/requests${qs}`);
    setItems(rows);
  }

  useEffect(() => {
    void apiFetch<CompanyRow[]>("/admin/companies")
      .then(setCompanies)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load companies"),
      );
    void load("").catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load"),
    );
  }, []);

  async function onCompanyChange(value: string) {
    setCompanyId(value);
    setError(null);
    try {
      await load(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  async function closeTicket(id: string) {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      await apiPost(`/admin/support/requests/${id}/close`, {});
      await load(companyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Close failed");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = searchItems(items, query);
  const pager = usePagination(filtered, `${companyId}:${query}`);

  return (
    <section className={page.page}>
      <h1 className={page.title}>Support</h1>
      <p className={page.lede}>
        Company support tickets across the platform.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.field} style={{ maxWidth: 320, marginTop: "0.75rem" }}>
        <label className={styles.label}>Filter by company</label>
        <select
          className={styles.select}
          value={companyId}
          onChange={(e) => void onCompanyChange(e.target.value)}
        >
          <option value="">All companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search support by title, company, or email…"
      />

      {filtered.length === 0 ? (
        <div className={styles.empty}>No support requests.</div>
      ) : (
        <ul className={styles.list}>
          {pager.paged.map((t) => (
            <li key={t.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div className={styles.cardContent}>
                  <p className={styles.cardTitle}>{t.title}</p>
                  <p className={styles.cardMeta}>
                    {t.company.name} · {t.status} · {day(t.createdAt)}
                    {t.createdBy
                      ? ` · ${t.createdBy.name} (${t.createdBy.email})`
                      : ""}
                  </p>
                  <p className={styles.cardMeta}>{t.body}</p>
                  {t.closeNote ? (
                    <p className={styles.cardMeta}>Closed: {t.closeNote}</p>
                  ) : null}
                </div>
                {t.status === "open" ? (
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.ghost}
                      disabled={busyId === t.id}
                      onClick={() => void closeTicket(t.id)}
                    >
                      Close
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
