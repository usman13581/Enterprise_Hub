"use client";

import { Fragment, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { TableScroll } from "@/components/Finance";
import { searchItems, usePagination } from "@/lib/useCollection";
import { Pagination, SearchBox } from "@/components/ListControls";
import page from "../../page.module.css";
import styles from "@/components/crud.module.css";
import finance from "@/components/finance.module.css";

type CompanyRow = { id: string; name: string };

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

export default function AdminAuditPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [items, setItems] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void apiFetch<CompanyRow[]>("/admin/companies")
      .then((rows) => {
        setCompanies(rows);
        if (rows[0]) {
          setCompanyId(rows[0].id);
          return load(rows[0].id);
        }
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load"),
      );
  }, []);

  async function load(cid: string) {
    if (!cid) {
      setItems([]);
      return;
    }
    const rows = await apiFetch<AuditRow[]>(
      `/admin/audit?companyId=${encodeURIComponent(cid)}&limit=100`,
    );
    setItems(rows);
  }

  async function onCompanyChange(value: string) {
    setCompanyId(value);
    setError(null);
    setOpenId(null);
    try {
      await load(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit");
    }
  }

  const filtered = searchItems(items, query);
  const pager = usePagination(filtered, `${companyId}:${query}`);

  return (
    <section className={page.page}>
      <h1 className={page.title}>Audit</h1>
      <p className={page.lede}>
        Pick a company to review its audit trail.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.field} style={{ maxWidth: 320, marginTop: "0.75rem" }}>
        <label className={styles.label}>Company</label>
        <select
          className={styles.select}
          value={companyId}
          onChange={(e) => void onCompanyChange(e.target.value)}
        >
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
        placeholder="Search audit by action, actor, or entity…"
      />

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          {companyId ? "No audit entries." : "Select a company."}
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

function tryPretty(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
