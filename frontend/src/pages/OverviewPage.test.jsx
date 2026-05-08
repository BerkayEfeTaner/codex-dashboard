import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OverviewPage from './OverviewPage.jsx';

vi.mock('recharts', () => ({
  Bar: () => null,
  BarChart: ({ children }) => <div>{children}</div>,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null
}));

const summary = {
  codexHome: 'C:\\Users\\sezer\\.codex',
  refreshedAt: '2026-05-08T12:00:00.000Z',
  counts: {
    agents: 2,
    teams: 1,
    threads: 4,
    logs: 128
  },
  teams: { core: 2 },
  models: { 'gpt-5.5': 2 },
  health: {
    ok: true,
    status: 'healthy',
    codexHomeReadable: true,
    codexHome: 'C:\\Users\\sezer\\.codex',
    sources: { readable: 2, total: 2, missing: 0, files: [] },
    databases: { available: 2, total: 2, errored: 0, files: [] }
  },
  usage: {
    source: {
      type: 'local-codex-sqlite',
      accountLimitConfigured: true
    },
    rateLimits: {
      source: {
        type: 'local-codex-session-jsonl',
        available: true,
        filesScanned: 12
      },
      updatedAt: '2026-05-08T12:00:00.000Z',
      planType: 'plus',
      primary: {
        label: '5-hour',
        windowMinutes: 300,
        usedPercent: 47,
        remainingPercent: 53,
        resetsAt: '2026-05-08T14:00:00.000Z',
        status: 'ok'
      },
      secondary: {
        label: 'weekly',
        windowMinutes: 10080,
        usedPercent: 64,
        remainingPercent: 36,
        resetsAt: '2026-05-11T12:00:00.000Z',
        status: 'ok'
      }
    },
    periods: {
      daily: {
        window: 'rolling_24h',
        usedTokens: 125000,
        limitTokens: 500000,
        remainingTokens: 375000,
        percentUsed: 25,
        status: 'ok',
        sessions: 3,
        logEvents: 40,
        to: '2026-05-08T12:00:00.000Z'
      },
      weekly: {
        window: 'rolling_7d',
        usedTokens: 900000,
        limitTokens: 2000000,
        remainingTokens: 1100000,
        percentUsed: 45,
        status: 'ok',
        sessions: 10,
        logEvents: 120,
        to: '2026-05-08T12:00:00.000Z'
      }
    }
  },
  activity: [],
  activeProfile: {}
};

describe('OverviewPage', () => {
  it('renders real usage limits from the summary contract', () => {
    render(<OverviewPage summary={summary} loading={false} />);

    const usagePanel = screen.getByRole('heading', { name: 'Usage Limits' }).closest('section');

    expect(within(usagePanel).getByText('rate limits detected')).toBeInTheDocument();
    expect(within(usagePanel).getByText('5-Hour')).toBeInTheDocument();
    expect(within(usagePanel).getByText('Weekly')).toBeInTheDocument();
    expect(within(usagePanel).getAllByText('53%').length).toBeGreaterThan(0);
    expect(within(usagePanel).getAllByText('36%').length).toBeGreaterThan(0);
  });
});
