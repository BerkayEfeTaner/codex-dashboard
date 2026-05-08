import { useCallback } from 'react';
import { fetchAgentDetail } from '../api/client.js';
import { useEndpoint } from './useEndpoint.js';

const emptyAgentDetail = {
  agent: null,
  source: null,
  lastKnownUsage: null,
  refreshedAt: null
};

export function useAgentDetail(id) {
  const fetcher = useCallback(() => {
    if (!id) return Promise.resolve(emptyAgentDetail);
    return fetchAgentDetail(id);
  }, [id]);

  return useEndpoint(fetcher, emptyAgentDetail);
}
