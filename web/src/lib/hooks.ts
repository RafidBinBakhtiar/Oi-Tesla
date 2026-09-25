'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, useSession } from './session';
import type { Zone } from './types';

interface Loadable<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * Loads data once and then re-polls every `intervalMs` while the tab is
 * visible. Polling is the MVP's "real-time" channel — see README trade-offs.
 */
export function usePolling<T>(load: () => Promise<T>, intervalMs: number | null): Loadable<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    if (!intervalMs) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [reload, intervalMs]);

  return { data, error, loading, reload };
}

let zonesCache: Promise<Zone[]> | null = null;

/** Zones rarely change, so they are fetched once per page load. */
export function useZones() {
  const { request } = useSession();
  return usePolling(() => {
    zonesCache ??= request<Zone[]>('GET', '/api/locations').catch((err) => {
      zonesCache = null;
      throw err;
    });
    return zonesCache;
  }, null);
}

/** Wraps an async action with pending + error state for buttons and forms. */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setPending(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (err) {
        setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', String(err)));
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [fn],
  );
  return { run, pending, error, clearError: () => setError(null) };
}
