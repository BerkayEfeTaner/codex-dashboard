import { fetchCapabilities } from '../api/client.js';
import { useEndpoint } from './useEndpoint.js';

const initialCapabilities = {
  skills: [],
  plugins: [],
  stats: {},
  categories: {},
  source: {},
  refreshedAt: null
};

export function useCapabilities() {
  return useEndpoint(fetchCapabilities, initialCapabilities);
}
