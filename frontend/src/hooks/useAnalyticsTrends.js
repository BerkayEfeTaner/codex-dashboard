import { useCallback } from 'react';
import { fetchAnalyticsTrends } from '../api/client.js';
import { useEndpoint } from './useEndpoint.js';

const initialAnalyticsTrends = {
  range: { days: 14, timezone: 'UTC' },
  daily: [],
  totals: {
    sessions: 0,
    logEvents: 0,
    tokensUsed: 0,
    estimatedBytes: 0
  },
  averages: {
    sessionsPerDay: 0,
    logEventsPerDay: 0,
    tokensPerDay: 0
  },
  distributions: {
    models: [],
    targets: [],
    levels: []
  }
};

export function useAnalyticsTrends(days = 14) {
  const fetcher = useCallback(() => fetchAnalyticsTrends({ days }), [days]);
  return useEndpoint(fetcher, initialAnalyticsTrends);
}
