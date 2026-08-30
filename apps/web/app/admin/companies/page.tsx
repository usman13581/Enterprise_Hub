"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api";
import { day } from "@/lib/format";
import { searchItems, usePagination, usePolledList } from "@/lib/useCollection";
import { Pagination, SearchBox } from "@/components/ListControls";
import page from "../../page.module.css";
import styles from "@/components/crud.module.css";

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  suspendedAt: string | null;
  createdAt: string;
  subscription?: {
    status: string;
    expiresAt: string | null;
    plan?: { name: string };
  } | null;
  industryCategory?: { name: string } | null;
  _count?: { users: number };
};

export default function AdminCompaniesPage() {
  const { items, error, setError, reload } =
    usePolledList<CompanyRow>("/admin/companies");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = searchItems(items, query);
  const pager = usePagination(filtered, query);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await apiPost("/admin/companies", {
        name,
        slug: slug || undefined,
      });
      setName("");
      setSlug("");
      setShowForm(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={page.page}>
      <h1 className={page.title}>Companies</h1>
      <p className={page.lede}>All tenant companies on the platform.</p>

      <div className={styles.toolbar}>
        <span className={styles.count}>{filtered.length} companies</span>
        <button
          type="button"
          className={styles.button}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Cancel" : "New company"}
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {showForm ? (
        <form className={styles.form} onSubmit={onCreate}>
          <p className={styles.formTitle}>Create company</p>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>Name</label>
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Slug (optional)</label>
              <input
                className={styles.input}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      ) : null}

      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search companies…"
      />

      {filtered.length === 0 ? (
        <div className={styles.empty}>No companies found.</div>
      ) : (
        <ul className={styles.list}>
          {pager.paged.map((c) => (
            <li key={c.id} className={styles.card}>
              <Link href={`/admin/companies/${c.id}`}>
                <strong>{c.name}</strong>
                <p className={styles.cardMeta}>
                  {c.slug}
                  {c.industryCategory
                    ? ` · ${c.industryCategory.name}`
                    : ""}
                  {c._count ? ` · ${c._count.users} users` : ""}
                  <br />
                  {c.subscription
                    ? `${c.subscription.plan?.name ?? "Plan"} · ${c.subscription.status}` +
                      (c.subscription.expiresAt
                        ? ` · expires ${day(c.subscription.expiresAt)}`
                        : "")
                    : "No subscription"}
                  {c.suspendedAt ? " · SUSPENDED" : ""}
                </p>
              </Link>
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
