"use client";

import { Fragment, useState } from "react";
import { searchItems, usePagination, usePolledList } from "@/lib/useCollection";
import { Pagination, SearchBox } from "@/components/ListControls";
import { TableScroll } from "@/components/Finance";
import page from "../page.module.css";
import styles from "@/components/crud.module.css";
import finance from "@/components/finance.module.css";

type AuditRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
  actorName?: string | null;
  actorEmail?: string | null;
  beforeJson?: string | null;
  afterJson?: string | null;
};

export default function AuditPage() {
  const { items, error } = usePolledList<AuditRow>("/audit?limit=200");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const filtered = searchItems(items, query);
  const pager = usePagination(filtered, query);

  return (
    <section className={page.page}>
      <h1 className={page.title}>Audit</h1>

      {error ? <p className={styles.error}>{error}</p> : null}

      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search by action, actor, or entity…"
      />

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          {query
            ? "No audit entries match your search."
            : "No audit entries yet. Writes will appear here."}
        </div>
      ) : (
        <TableScroll>
          <table className={finance.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Id</th>
              </tr>
            </thead>
            <tbody>
              {pager.paged.map((r) => {
                const actor =
                  r.actorName || r.actorEmail
                    ? [r.actorName, r.actorEmail].filter(Boolean).join(" · ")
                    : "—";
                const expanded = openId === r.id;
                const hasJson = Boolean(r.beforeJson || r.afterJson);
                return (
                  <Fragment key={r.id}>
                    <tr
                      onClick={() =>
                        hasJson
                          ? setOpenId(expanded ? null : r.id)
                          : undefined
                      }
                      style={hasJson ? { cursor: "pointer" } : undefined}
                    >
                      <td>{new Date(r.createdAt).toLocaleString()}</td>
                      <td>{actor}</td>
                      <td>{r.action}</td>
                      <td>{r.entityType}</td>
                      <td>{r.entityId}</td>
                    </tr>
                    {expanded && hasJson ? (
                      <tr>
                        <td colSpan={5}>
                          <pre
                            style={{
                              margin: 0,
                              padding: "0.65rem",
                              background: "#f4f6f8",
                              borderRadius: 8,
                              fontSize: "0.75rem",
                              overflow: "auto",
                            }}
                          >
                            {r.beforeJson
                              ? `before:\n${tryPretty(r.beforeJson)}\n\n`
                              : ""}
                            {r.afterJson
                              ? `after:\n${tryPretty(r.afterJson)}`
                              : ""}
                          </pre>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
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

function tryPretty(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
