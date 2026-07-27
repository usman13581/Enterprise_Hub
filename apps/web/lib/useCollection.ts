"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "./api";

/** Fetches a list and keeps it fresh with silent background polling. */
export function usePolledList<T>(path: string, intervalMs = 3000) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pathRef = useRef(path);
  pathRef.current = path;

  const load = useCallback(async (silent = false) => {
    try {
      const data = await apiFetch<T[]>(pathRef.current);
      setItems(data);
      setError(null);
    } catch (e) {
      if (!silent) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(true), intervalMs);
    return () => clearInterval(id);
  }, [load, intervalMs]);

  return { items, loading, error, setError, reload: load };
}

function matches(value: unknown, q: string): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.toLowerCase().includes(q);
  if (typeof value === "number") return String(value).includes(q);
  if (Array.isArray(value)) return value.some((v) => matches(v, q));
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((v) =>
      matches(v, q),
    );
  }
  return false;
}

export function searchItems<T>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => matches(item, q));
}

export type Flash = { text: string; tone: "success" | "danger" } | null;

/** Transient confirmation message shown after create, save, or delete. */
export function useFlash(timeoutMs = 3000) {
  const [flash, setFlash] = useState<Flash>(null);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), timeoutMs);
    return () => clearTimeout(id);
  }, [flash, timeoutMs]);

  const notify = useCallback(
    (text: string, tone: "success" | "danger" = "success") =>
      setFlash({ text, tone }),
    [],
  );

  return { flash, notify };
}

export const PAGE_SIZES = [5, 10, 25, 50];

export function usePagination<T>(items: T[]) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount);

  const paged = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  );

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  return {
    paged,
    page: safePage,
    setPage,
    pageSize,
    setPageSize: (n: number) => {
      setPageSize(n);
      setPage(1);
    },
    pageCount,
    total: items.length,
  };
}
