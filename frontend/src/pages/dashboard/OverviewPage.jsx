import { createElement } from 'react';
import { Activity, Bot, CalendarDays, FileText, Gauge, GitBranch, Layers3, ShieldCheck } from 'lucide-react';
import { Badge } from 'reactstrap';
import { Detail } from '../../components/ui/Detail.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { formatCompact, formatDate } from '../../utils/format.js';

function usageBadgeColor(status) {
  if (status === 'ok') return 'success';
  if (status === 'warning') return 'warning';
  if (status === 'exhausted') return 'danger';
  return 'secondary';
}

function usageLabel(status) {
  if (status === 'ok') return 'on track';
  if (status === 'warning') return 'watch';
  if (status === 'exhausted') return 'exhausted';
  if (status === 'stale') return 'awaiting update';
  if (status === 'unknown') return 'unknown';
  return 'not configured';
}

function formatPercent(value) {
  if (value === null || value === undefined) return '-';
  return `${Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}%`;
}

function formatWindowMinutes(minutes) {
  if (minutes === 300) return '5 hours';
  if (minutes === 10080) return 'weekly';
  if (!minutes) return '-';
  if (minutes % 1440 === 0) return `${minutes / 1440} days`;
  if (minutes % 60 === 0) return `${minutes / 60} hours`;
  return `${minutes} minutes`;
}

function RateLimitCard({ title, icon: Icon, limit }) {
  const remainingPercent = limit?.remainingPercent ?? 0;
  const hasData = !limit?.stale && limit?.usedPercent !== null && limit?.usedPercent !== undefined;
  const meterPercent = hasData ? Math.min(Math.max(remainingPercent, 0), 100) : 100;
  const valueLabel = hasData ? formatPercent(limit.remainingPercent) : limit?.stale ? 'Awaiting update' : 'Unavailable';

  return (
    <div className="usage-limit-card">
      <div className="usage-limit-head">
        <div className="icon-row">
          {createElement(Icon, { size: 18, 'aria-hidden': 'true' })}
          <div>
            <h3>{title}</h3>
            <span>{formatWindowMinutes(limit?.windowMinutes)}</span>
          </div>
        </div>
        <Badge color={usageBadgeColor(limit?.status)}>{usageLabel(limit?.status)}</Badge>
      </div>
      <div className="usage-limit-value">
        <span>Remaining</span>
        <strong>{valueLabel}</strong>
      </div>
      <div className={`usage-meter ${hasData ? 'usage-meter-remaining' : 'usage-meter-empty'}`} aria-label={`${title} remaining rate limit`}>
        <span style={{ width: `${meterPercent}%` }} />
      </div>
      <div className="usage-limit-metrics">
        <div>
          <span>Used</span>
          <strong>{formatPercent(limit?.usedPercent)}</strong>
        </div>
        <div>
          <span>Remaining</span>
          <strong>{hasData ? formatPercent(limit?.remainingPercent) : '-'}</strong>
        </div>
        <div>
          <span>Window</span>
          <strong>{formatWindowMinutes(limit?.windowMinutes)}</strong>
        </div>
        <div>
          <span>Reset</span>
          <strong>{formatDate(limit?.resetsAt)}</strong>
        </div>
      </div>
      <p>Updated {formatDate(limit?.updatedAt)}</p>
    </div>
  );
}

export default function OverviewPage({ summary, loading }) {
  const sourceTypes = (summary?.agents || []).reduce((acc, agent) => {
    const key = agent.type || agent.source || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const health = summary?.health;
  const usage = summary?.usage;
  const rateLimits = usage?.rateLimits;
  const recentActivity = summary?.activity?.slice(0, 5) || [];
  const sourceFiles = health?.sources?.files?.slice(0, 5) || [];

  if (loading && !summary) return <div className="panel">Loading dashboard...</div>;

  return (
    <div className="page-grid">
      <PageHeader
        title="Overview"
        subtitle="Compact Codex runtime, source, session, and activity status"
        status={{ label: health?.status || 'unknown', tone: health?.ok ? 'ok' : 'warn' }}
      />

      <section className="stat-grid">
        <StatCard label="Subagents" value={summary?.counts.agents || 0} icon={Bot} />
        <StatCard label="Skills" value={summary?.counts.skills || 0} icon={Layers3} />
        <StatCard label="Threads" value={summary?.counts.threads || 0} icon={GitBranch} />
        <StatCard label="Log Events" value={formatCompact(summary?.counts.logs || 0)} icon={Activity} />
      </section>

      <section className="panel wide usage-limits-panel">
        <PageHeader
          title="Usage Limits"
          subtitle="Real Codex rate-limit percentages from local session events"
          status={{
            label: rateLimits?.source?.available ? 'rate limits detected' : 'rate limits unavailable',
            tone: rateLimits?.source?.available ? 'ok' : 'idle'
          }}
        />
        <div className="usage-limit-grid">
          <RateLimitCard title="5-Hour" icon={Gauge} limit={rateLimits?.primary ? { ...rateLimits.primary, updatedAt: rateLimits?.updatedAt } : null} />
          <RateLimitCard title="Weekly" icon={CalendarDays} limit={rateLimits?.secondary ? { ...rateLimits.secondary, updatedAt: rateLimits?.updatedAt } : null} />
        </div>
      </section>

      <section className="panel overview-health">
        <div className="panel-header">
          <div>
            <h2>Health</h2>
            <p>Runtime and source readiness</p>
          </div>
          <span className={`status ${health?.ok ? 'ok' : 'warn'}`}>{health?.status || 'unknown'}</span>
        </div>
        <div className="compact-list">
          <div className="compact-row icon-row">
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong>{health?.codexHomeReadable ? 'Codex home readable' : 'Codex home needs attention'}</strong>
              <span>{health?.codexHomeReadable ? 'Local Codex sources are accessible' : 'Local Codex sources need attention'}</span>
            </div>
          </div>
          <div className="compact-row icon-row">
            <FileText size={18} aria-hidden="true" />
            <div>
              <strong>
                {health?.sources?.readable || 0}/{health?.sources?.total || 0} sources readable
              </strong>
              <span>{health?.sources?.missing || 0} missing source files</span>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Recent Activity</h2>
            <p>Latest log events</p>
          </div>
          <span className="pill">{recentActivity.length} shown</span>
        </div>
        {recentActivity.length === 0 ? (
          <EmptyState title="No activity yet" description="Recent Codex log events will appear here." />
        ) : (
          <div className="compact-list">
            {recentActivity.map((entry, index) => (
              <div className="compact-row" key={`${entry.tsIso || index}-${entry.target || 'event'}`}>
                <strong>{entry.target || 'Codex event'}</strong>
                <span>{entry.level || 'info'} - {formatDate(entry.tsIso)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Active Profile</h2>
        <div className="detail-list">
          <Detail label="Name" value={summary?.activeProfile?.name} />
          <Detail label="Model" value={summary?.activeProfile?.model} />
          <Detail label="Reasoning" value={summary?.activeProfile?.reasoningEffort} />
          <Detail label="Approval" value={summary?.activeProfile?.approvalMode} />
        </div>
      </section>

      <section className="panel">
        <h2>Runtime</h2>
        <div className="compact-list">
          <div className="compact-row">
            <strong>{summary?.system?.node || '-'}</strong>
            <span>Node runtime</span>
          </div>
          <div className="compact-row">
            <strong>{summary?.system?.threadStats?.active || 0} active threads</strong>
            <span>{summary?.system?.platform || '-'}</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Subagent Sources</h2>
        <div className="compact-list">
          {Object.keys(sourceTypes).length === 0 ? (
            <EmptyState title="No source data" description="Codex subagent source types will appear when records are available." />
          ) : Object.entries(sourceTypes).map(([source, count]) => (
            <div className="compact-row" key={source}>
              <strong>{source}</strong>
              <span>{count} records</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Source Files</h2>
            <p>Readiness preview</p>
          </div>
          <Badge color={health?.sources?.missing ? 'warning' : 'success'}>
            {health?.sources?.readable || 0}/{health?.sources?.total || 0}
          </Badge>
        </div>
        {sourceFiles.length === 0 ? (
          <EmptyState title="No source files" description="Configured Codex dashboard files will appear here." />
        ) : (
          <div className="compact-list">
            {sourceFiles.map((file) => (
              <div className="compact-row" key={file.name}>
                <strong>{file.name}</strong>
                <span>{file.readable ? 'readable' : file.exists ? 'unreadable' : 'missing'}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
