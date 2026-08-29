"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminApi";

/**
 * Minimal fetch-and-refetch hook for the admin's read endpoints. Deliberately
 * not react-query: the admin loads one list per page and refetches after a
 * mutation, so a cache layer would be weight without benefit.
 */
export function useAdminResource<T>(path: string) {
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
  }, [reload]);

  return { data, loading, error, reload };
}
