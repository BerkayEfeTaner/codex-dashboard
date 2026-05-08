import { useCallback } from 'react';
import { fetchSessions } from '../api/client.js';
import { useEndpoint } from './useEndpoint.js';

const initialSessions = {
  threads: [],
  stats: {
    total: 0,
    archived: 0,
    active: 0,
    byModel: {},
    byApproval: {},
    bySandbox: {}
  }
};

export function useSessions(limit = 24) {
  const fetcher = useCallback(() => fetchSessions({ limit }), [limit]);
  return useEndpoint(fetcher, initialSessions);
}
