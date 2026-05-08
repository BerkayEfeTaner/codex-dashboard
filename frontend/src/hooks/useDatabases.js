import { fetchDatabases } from '../api/client.js';
import { useEndpoint } from './useEndpoint.js';

export function useDatabases() {
  return useEndpoint(fetchDatabases, []);
}
