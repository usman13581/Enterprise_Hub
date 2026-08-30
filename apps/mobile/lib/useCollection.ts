import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "./api";

export const PAGE_SIZES = [5, 10, 25, 50];

/** Fetches a list and keeps it fresh with silent background polling. */
export function usePolledList<T>(path: string, intervalMs = 3000) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      try {
        setItems(await apiFetch<T[]>(path));
        setError(null);
      } catch (e) {
        if (!silent) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(true), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, load]);

  return { items, loading, error, setError, reload: load };
}

/** Single-resource twin of usePolledList, for detail and hub screens. */
export function usePolledItem<T>(path: string | null, intervalMs = 4000) {
  const [item, setItem] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!path) {
        setLoading(false);
        return;
      }
      try {
        setItem(await apiFetch<T>(path));
        setError(null);
      } catch (e) {
        if (!silent) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(true), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, load]);

  return { item, loading, error, setError, reload: load };
}

function matches(value: unknown, query: string): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.toLowerCase().includes(query);
  if (typeof value === "number") return String(value).includes(query);
  if (Array.isArray(value)) return value.some((item) => matches(item, query));
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) =>
      matches(item, query),
    );
  }
  return false;
}

export function searchItems<T>(items: T[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => matches(item, normalized));
}

export function usePagination<T>(items: T[], resetKey?: unknown) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeValue] = useState(PAGE_SIZES[0]);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, pageSize, safePage],
  );

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    if (resetKey !== undefined) setPage(1);
  }, [resetKey]);

  return {
    paged,
    page: safePage,
    setPage,
    pageSize,
    setPageSize: (size: number) => {
      setPageSizeValue(size);
      setPage(1);
    },
    pageCount,
    total: items.length,
  };
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
