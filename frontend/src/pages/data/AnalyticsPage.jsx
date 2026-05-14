import { useMemo, useState } from 'react';
import { Activity, BarChart3, Clock, GitBranch } from 'lucide-react';
import { Button, ButtonGroup } from 'reactstrap';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { InlineError } from '../../components/ui/InlineError.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { useAnalyticsTrends } from '../../hooks/useAnalyticsTrends.js';
import { formatCompact, formatDate } from '../../utils/format.js';

const ranges = [7, 14, 30, 90];

function DistributionList({ title, subtitle, items, emptyTitle }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className="pill">{items.length} shown</span>
      </div>
      {items.length === 0 ? (
        <EmptyState title={emptyTitle} description="Source records will appear when local Codex data is available." />
      ) : (
        <div className="compact-list">
          {items.map((item) => (
            <div className="compact-row metric-row" key={item.name}>
              <strong>{item.name || 'unknown'}</strong>
              <span>{formatCompact(item.count || 0)} events</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(14);
  const { data, loading, error } = useAnalyticsTrends(days);
  const dailyRows = data?.daily;
  const daily = useMemo(
    () => (dailyRows || []).map((row) => ({ ...row, label: row.day?.slice(5) || row.day })),
    [dailyRows]
  );
  const hasDailyData = daily.some((row) => row.sessions || row.logEvents || row.tokensUsed);
  const totals = data?.totals || {};
  const averages = data?.averages || {};
  const distributions = data?.distributions || {};

  return (
    <div className="analytics-page page-grid">
      <PageHeader
        title="Analytics"
        subtitle={`${data?.range?.days || days} day UTC trend window`}
        status={{ label: loading ? 'Loading' : `Updated ${formatDate(data?.refreshedAt)}`, tone: loading ? 'warn' : 'ok' }}
        action={(
          <ButtonGroup className="range-control" size="sm" aria-label="Trend range">
            {ranges.map((range) => (
              <Button
                key={range}
                type="button"
                color={range === days ? 'primary' : 'secondary'}
                outline={range !== days}
                onClick={() => setDays(range)}
              >
                {range}d
              </Button>
            ))}
          </ButtonGroup>
        )}
      />

      <InlineError title="Analytics error" message={error} />

      <section className="stat-grid">
        <StatCard label="Sessions" value={formatCompact(totals.sessions || 0)} icon={GitBranch} />
        <StatCard label="Log Events" value={formatCompact(totals.logEvents || 0)} icon={Activity} />
        <StatCard label="Tokens" value={formatCompact(totals.tokensUsed || 0)} icon={BarChart3} />
        <StatCard label="Models" value={formatCompact((distributions.models || []).length)} icon={BarChart3} />
      </section>

      <section className="panel wide">
        <div className="panel-header">
          <div>
            <h2>Daily Trend</h2>
            <p>Sessions and log events by source event day</p>
          </div>
          <span className="pill">{formatCompact(averages.logEventsPerDay || 0)} logs/day</span>
        </div>
        {!hasDailyData ? (
          <EmptyState title="No trend data" description="Daily analytics will appear when session or log records are available." />
        ) : (
          <div className="chart-wrap chart-wrap-large">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={formatCompact} />
                <Tooltip formatter={(value) => formatCompact(value)} />
                <Line type="monotone" dataKey="sessions" name="Sessions" stroke="#0f766e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="logEvents" name="Log events" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="panel wide">
        <div className="panel-header">
          <div>
            <h2>Usage Volume</h2>
            <p>Token usage by source event day</p>
          </div>
          <span className="pill">{formatCompact(averages.tokensPerDay || 0)} tokens/day</span>
        </div>
        {!hasDailyData ? (
          <EmptyState title="No volume data" description="Usage volume will appear when token records are available." />
        ) : (
          <div className="chart-wrap chart-wrap-large">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={formatCompact} />
                <Tooltip formatter={(value) => formatCompact(value)} />
                <Bar dataKey="tokensUsed" name="Tokens" fill="#0f766e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <DistributionList
        title="Models"
        subtitle="Most common session models in range"
        items={distributions.models || []}
        emptyTitle="No model usage"
      />
      <DistributionList
        title="Targets"
        subtitle="Most common log targets in range"
        items={distributions.targets || []}
        emptyTitle="No target data"
      />
      <DistributionList
        title="Levels"
        subtitle="Log level distribution in range"
        items={distributions.levels || []}
        emptyTitle="No level data"
      />

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Range Source</h2>
            <p>Refresh time and source availability</p>
          </div>
          <Clock size={18} aria-hidden="true" />
        </div>
        <div className="compact-list">
          <div className="compact-row">
            <strong>{data?.range?.timezone || 'UTC'}</strong>
            <span>{data?.range?.from ? `${formatDate(data.range.from)} - ${formatDate(data.range.to)}` : '-'}</span>
          </div>
          <div className="compact-row">
            <strong>{data?.source?.threads?.available ? 'Sessions available' : 'Sessions unavailable'}</strong>
            <span>Conversation history</span>
          </div>
          <div className="compact-row">
            <strong>{data?.source?.logs?.available ? 'Logs available' : 'Logs unavailable'}</strong>
            <span>Activity events</span>
          </div>
        </div>
      </section>
    </div>
  );
}
