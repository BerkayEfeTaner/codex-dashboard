import { fetchSkillCandidates } from '../api/client.js';
import { useEndpoint } from './useEndpoint.js';

const initialSkillCandidates = {
  daemon: {
    status: 'idle',
    mode: 'read-only',
    writesSkills: false
  },
  candidates: [],
  stats: {},
  source: {},
  refreshedAt: null
};

export function useSkillCandidates() {
  return useEndpoint(fetchSkillCandidates, initialSkillCandidates, { pollIntervalMs: 60000 });
}
