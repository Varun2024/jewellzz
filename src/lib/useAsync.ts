import { useCallback, useEffect, useRef, useState } from 'react';

// ponytail: minimal async state. Skipped SWR/react-query — MVP doesn't need cache invalidation policies.

export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export function errText(e: unknown): string {
  if (!e) return 'unknown error';
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return JSON.stringify(e);
}

// Auto-runs on mount and whenever `deps` change. Returns { data, loading, error, reload }.
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> & { reload: () => Promise<void> } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });
  const alive = useRef(true);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fn();
      if (alive.current) setState({ data, loading: false, error: null });
    } catch (e) {
      if (alive.current) setState({ data: null, loading: false, error: errText(e) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: load };
}

// One-shot mutation state (loading / error / success). Doesn't auto-run.
export function useMutation<A, T>(fn: (arg: A) => Promise<T>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (arg: A): Promise<T> => {
    setLoading(true); setError(null);
    try {
      const r = await fn(arg);
      setLoading(false);
      return r;
    } catch (e) {
      setLoading(false);
      const msg = errText(e);
      setError(msg);
      throw new Error(msg);
    }
  }, [fn]);

  return { run, loading, error, clearError: () => setError(null) };
}
