import { fetchSystem } from '../api/client.js';
import { useEndpoint } from './useEndpoint.js';

export function useSystem() {
  return useEndpoint(fetchSystem);
}
