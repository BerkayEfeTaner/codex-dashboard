import { useCallback } from 'react';
import { fetchWorkspaces } from '../api/client.js';
import { useEndpoint } from './useEndpoint.js';

const initialWorkspaces = {
  workspaces: [],
  stats: {
    total: 0,
    readable: 0,
    missing: 0,
    threads: 0,
    activeThreads: 0,
    archivedThreads: 0,
    logEvents: 0,
    tokensUsed: 0
  },
  limit: 24,
  source: {},
  refreshedAt: null
};

export function useWorkspaces(limit = 24) {
  const fetcher = useCallback(() => fetchWorkspaces({ limit }), [limit]);
  return useEndpoint(fetcher, initialWorkspaces);
}
