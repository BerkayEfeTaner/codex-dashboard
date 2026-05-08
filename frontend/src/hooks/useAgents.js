import { fetchAgents } from '../api/client.js';
import { useEndpoint } from './useEndpoint.js';

export function useAgents() {
  return useEndpoint(fetchAgents, []);
}
