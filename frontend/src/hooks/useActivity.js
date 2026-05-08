import { useCallback } from 'react';
import { fetchActivity } from '../api/client.js';
import { useEndpoint } from './useEndpoint.js';

const initialActivity = {
  activity: [],
  stats: { total: 0, byLevel: {}, recentTargets: [] },
  filters: { level: '', target: '', threadId: '', query: '', from: '', to: '', limit: 50, offset: 0 },
  pagination: { limit: 50, offset: 0, total: 0, hasNext: false }
};

export function useActivity(filters = {}) {
  const { level = '', target = '', threadId = '', query = '', from = '', to = '', limit = 50, offset = 0 } = filters;
  const fetcher = useCallback(
    () => fetchActivity({ level, target, threadId, query, from, to, limit, offset }),
    [level, target, threadId, query, from, to, limit, offset]
  );

  return useEndpoint(fetcher, initialActivity);
}
