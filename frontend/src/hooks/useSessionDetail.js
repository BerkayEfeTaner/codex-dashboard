import { useCallback } from 'react';
import { fetchSessionDetail } from '../api/client.js';
import { useEndpoint } from './useEndpoint.js';

const emptySessionDetail = {
  thread: null,
  activity: [],
  fileGraph: { files: [], links: [], totals: { files: 0, events: 0 } },
  source: null,
  refreshedAt: null
};

export function useSessionDetail(id) {
  const fetcher = useCallback(() => {
    if (!id) return Promise.resolve(emptySessionDetail);
    return fetchSessionDetail(id);
  }, [id]);

  return useEndpoint(fetcher, emptySessionDetail);
}
