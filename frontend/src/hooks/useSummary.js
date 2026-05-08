import { fetchSummary } from '../api/client.js';
import { useEndpoint } from './useEndpoint.js';

export function useSummary() {
  const { data: summary, loading, error, reload, refresh } = useEndpoint(fetchSummary, null, { pollIntervalMs: 30000 });

  return { summary, loading, error, reload, refresh };
}
