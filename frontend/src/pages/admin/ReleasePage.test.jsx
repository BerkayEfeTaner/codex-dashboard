import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReleasePage from './ReleasePage.jsx';

vi.mock('../../hooks/useReleaseHealth.js', () => ({
  useReleaseHealth: () => ({
    data: {
      release: {
        readiness: 'attention',
        score: 90,
        blockers: [],
        warnings: ['Frontend unit/component test runner is not configured.']
      },
      checks: [
        {
          id: 'frontend-build',
          label: 'Frontend production build',
          status: 'ready',
          detail: 'npm run build is configured.'
        },
        {
          id: 'frontend-tests',
          label: 'Frontend component tests',
          status: 'warn',
          detail: 'No component tests discovered.'
        }
      ],
      testCoverage: {
        backend: {
          configured: true,
          script: 'node --test',
          runners: ['node:test'],
          testFiles: ['server.test.js'],
          testFileCount: 1
        },
        frontend: {
          configured: true,
          script: 'vitest run',
          runners: ['vitest'],
          testFiles: ['src/pages/ReleasePage.test.jsx'],
          testFileCount: 1
        },
        totals: { testFiles: 2, configuredRunners: 2 },
        gaps: ['Add more endpoint contract tests.']
      },
      smoke: {
        endpointCount: 19,
        endpoints: ['/api/health', '/api/release/health']
      },
      source: {
        backendPackage: {
          label: 'Backend package.json',
          path: 'backend/package.json',
          exists: true
        }
      },
      refreshedAt: '2026-05-08T12:00:00.000Z'
    },
    loading: false,
    error: null
  })
}));

describe('ReleasePage', () => {
  it('renders release readiness, checks, and coverage gaps', () => {
    render(<ReleasePage />);

    expect(screen.getByRole('heading', { name: 'Release' })).toBeInTheDocument();
    expect(screen.getByText('attention')).toBeInTheDocument();
    expect(screen.getByText('90/100')).toBeInTheDocument();
    expect(screen.getByText('Frontend production build')).toBeInTheDocument();
    expect(screen.getByText('Add more endpoint contract tests.')).toBeInTheDocument();

    const frontendPanel = screen.getByText('Frontend Tests').closest('section');
    expect(within(frontendPanel).getByText('vitest run')).toBeInTheDocument();
  });
});
