"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminApi";

/**
 * Minimal fetch-and-refetch hook for the admin's read endpoints. Deliberately
 * not react-query: the admin loads one list per page and refetches after a
 * mutation, so a cache layer would be weight without benefit.
 *
 * `pollMs` re-runs the fetch on an interval, for the one list that changes
 * without the admin touching anything — the support inbox, where a customer's
 * message has to surface without a manual refresh. Omitted everywhere else.
 */
export function useAdminResource<T>(path: string, pollMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setData(await adminFetch<T>(path));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this data.");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void reload();
    if (!pollMs) return;
    const timer = setInterval(() => void reload(), pollMs);
    return () => clearInterval(timer);
  }, [reload, pollMs]);

  return { data, loading, error, reload };
}
