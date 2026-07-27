"use client";

import { PAGE_SIZES, type Flash } from "@/lib/useCollection";
import styles from "./crud.module.css";

export function Toast({ flash }: { flash: Flash }) {
  if (!flash) return null;
  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <span
        className={`${styles.toastDot} ${
          flash.tone === "danger" ? styles.toastDotDanger : ""
        }`}
      />
      {flash.text}
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className={styles.search}
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "Search…"}
    />
  );
}

export function Pagination({
  page,
  setPage,
  pageSize,
  setPageSize,
  pageCount,
  total,
}: {
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
  pageCount: number;
  total: number;
}) {
  if (total === 0) return null;
  return (
    <div className={styles.pagination}>
      <span className={styles.count}>
        {total} record{total === 1 ? "" : "s"}
      </span>
      <div className={styles.pageControls}>
        <label className={styles.count}>
          Rows{" "}
          <select
            className={styles.pageSizeSelect}
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          className={styles.ghost}
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          ‹ Prev
        </button>
        <span className={styles.count}>
          Page {page} of {pageCount}
        </span>
        <button
          className={styles.ghost}
          disabled={page >= pageCount}
          onClick={() => setPage(page + 1)}
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
