"use client";

import { useState } from "react";
import { apiPatch } from "@/lib/api";
import { day } from "@/lib/format";
import {
  searchItems,
  usePagination,
  usePolledList,
} from "@/lib/useCollection";
import { Pagination, SearchBox } from "@/components/ListControls";
import page from "../page.module.css";
import styles from "@/components/crud.module.css";

type UserRow = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  companyRole: string;
  accessExpiresAt: string | null;
  createdAt: string;
};

export default function TeamPage() {
  const { items, error, setError, reload } =
    usePolledList<UserRow>("/company/users");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function toggleActive(user: UserRow) {
    if (busyId) return;
    setBusyId(user.id);
    setError(null);
    try {
      await apiPatch(`/company/users/${user.id}`, { active: !user.active });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = searchItems(items, query);
  const pager = usePagination(filtered, query);

  return (
    <section className={page.page}>
      <h1 className={page.title}>Team</h1>
      <p className={page.lede}>
        Company users and seat status. Deactivate to free a seat.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search team by name, email, or role…"
      />

      {filtered.length === 0 ? (
        <div className={styles.empty}>No users found.</div>
      ) : (
        <ul className={styles.list}>
          {pager.paged.map((u) => (
            <li key={u.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div className={styles.cardContent}>
                  <p className={styles.cardTitle}>{u.name}</p>
                  <p className={styles.cardMeta}>
                    {u.email} · {u.companyRole}
                    {u.accessExpiresAt
                      ? ` · access until ${day(u.accessExpiresAt)}`
                      : ""}
                    <br />
                    Joined {day(u.createdAt)}
                  </p>
                  <span className={styles.tag}>
                    {u.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={u.active ? styles.ghost : styles.button}
                    disabled={busyId === u.id}
                    onClick={() => void toggleActive(u)}
                  >
                    {busyId === u.id
                      ? "…"
                      : u.active
                        ? "Deactivate"
                        : "Activate"}
                  </button>
                </div>
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
