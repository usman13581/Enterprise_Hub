"use client";

import { useState } from "react";
import { searchItems, usePagination, usePolledList } from "@/lib/useCollection";
import { Pagination, SearchBox } from "@/components/ListControls";
import page from "../page.module.css";
import styles from "@/components/crud.module.css";

type AuditRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
};

export default function AuditPage() {
  const { items, error } = usePolledList<AuditRow>("/audit?limit=200");
  const [query, setQuery] = useState("");
  const filtered = searchItems(items, query);
  const pager = usePagination(filtered);

  return (
    <section className={page.page}>
      <h1 className={page.title}>Audit</h1>
      <p className={page.lede}>
        Strong history of creates, updates, and status changes. Updates
        automatically.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search by action or entity type…"
      />

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          {query
            ? "No audit entries match your search."
            : "No audit entries yet. Writes will appear here."}
        </div>
      ) : (
        <ul className={styles.list}>
          {pager.paged.map((r) => (
            <li key={r.id} className={styles.card}>
              <strong>
                {r.action} · {r.entityType}
              </strong>
              <p className={styles.cardMeta}>
                {r.entityId} · {new Date(r.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={pager.page}
        setPage={pager.setPage}
        pageSize={pager.pageSize}
        setPageSize={pager.setPageSize}
        pageCount={pager.pageCount}
        total={pager.total}
      />
    </section>
  );
}
