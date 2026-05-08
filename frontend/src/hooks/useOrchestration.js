import { fetchOrchestration } from '../api/client.js';
import { useEndpoint } from './useEndpoint.js';

const initialOrchestration = {
  agents: [],
  lanes: [],
  edges: [],
  unmappedThreads: [],
  stats: {},
  source: null,
  refreshedAt: null
};

export function useOrchestration() {
  return useEndpoint(fetchOrchestration, initialOrchestration);
}
