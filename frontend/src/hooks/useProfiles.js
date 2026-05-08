import { fetchProfiles } from '../api/client.js';
import { useEndpoint } from './useEndpoint.js';

const initialProfiles = {
  activeProfile: null,
  profiles: [],
  source: null
};

export function useProfiles() {
  return useEndpoint(fetchProfiles, initialProfiles);
}
