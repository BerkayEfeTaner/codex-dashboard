import { fetchReleaseHealth } from '../api/client.js';
import { useEndpoint } from './useEndpoint.js';

const initialReleaseHealth = {
  release: {
    readiness: 'attention',
    score: 0,
    blockers: [],
    warnings: []
  },
  checks: [],
  testCoverage: {
    backend: { configured: false, script: null, runners: [], testFiles: [], testFileCount: 0 },
    frontend: { configured: false, script: null, runners: [], testFiles: [], testFileCount: 0 },
    totals: { testFiles: 0, configuredRunners: 0 },
    gaps: []
  },
  smoke: {
    endpointCount: 0,
    endpoints: []
  },
  source: {},
  refreshedAt: null
};

export function useReleaseHealth() {
  return useEndpoint(fetchReleaseHealth, initialReleaseHealth);
}
