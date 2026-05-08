import { useCallback, useEffect, useRef, useState } from 'react';

export function useEndpoint(fetcher, initialData = null, { pollIntervalMs = 0 } = {}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const mountedRef = useRef(false);
  const dataRef = useRef(initialData);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const runFetch = useCallback(async ({ background = false } = {}) => {
    const hasData = dataRef.current !== null && dataRef.current !== undefined;

    if (background || hasData) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const payload = await fetcher();
      if (mountedRef.current) {
        setData(payload);
      }
      return payload;
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message);
      }
      throw err;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [fetcher]);

  const reload = useCallback(() => runFetch(), [runFetch]);
  const refresh = useCallback(() => runFetch({ background: true }), [runFetch]);

  useEffect(() => {
    mountedRef.current = true;
    Promise.resolve().then(() => runFetch().catch(() => {}));

    return () => {
      mountedRef.current = false;
    };
  }, [runFetch]);

  useEffect(() => {
    if (!pollIntervalMs || typeof window === 'undefined') return undefined;

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        refresh().catch(() => {});
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [pollIntervalMs, refresh]);

  useEffect(() => {
    if (!pollIntervalMs) return undefined;

    const id = setInterval(() => {
      refresh().catch(() => {});
    }, pollIntervalMs);

    return () => clearInterval(id);
  }, [pollIntervalMs, refresh]);

  return { data, loading, refreshing, error, reload, refresh };
}
