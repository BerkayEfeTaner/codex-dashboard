import { createElement } from 'react';
import { Activity, ArrowRight, Bot, CalendarDays, FileText, Gauge, GitBranch, Layers3, ShieldCheck, Wrench } from 'lucide-react';
import { Badge } from 'reactstrap';
import { Detail } from '../../components/ui/Detail.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { activityDisplay, visibleCodexActivity } from '../../utils/activityDisplay.js';
import { formatCompact, formatDate } from '../../utils/format.js';

const conceptSignals = [
  { label: 'Agent', value: 'handles the active turn', detail: 'Primary worker', tone: 'core' },
  { label: 'Subagent', value: 'takes delegated work', detail: 'Parallel support', tone: 'profile' },
  { label: 'Skill', value: 'adds task-specific rules', detail: 'Reusable guidance', tone: 'skill' },
  { label: 'Session', value: 'keeps conversation state', detail: 'Thread context', tone: 'session' },
  { label: 'Workspace', value: 'bounds files and commands', detail: 'Local project', tone: 'workspace' },
  { label: 'Approval', value: 'controls risky actions', detail: 'Permission layer', tone: 'boundary' }
];

function displayProfileValue(value) {
  return value || 'not detected';
}

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

function boundaryLabel(value) {
  return displayProfileValue(value).replaceAll('_', ' ');
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

function OverviewLoadingState() {
  return (
    <div className="page-grid overview-page" aria-busy="true">
      <div className="page-header overview-loading-header">
        <div>
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-subtitle" />
        </div>
        <span className="skeleton-pill" />
      </div>
      <section className="stat-grid overview-stat-grid">
        {[0, 1, 2, 3].map((item) => (
          <div className="stat-card overview-skeleton-card" key={item}>
            <div className="card-body">
              <div>
                <span className="skeleton-line skeleton-label" />
                <span className="skeleton-line skeleton-value" />
                <span className="skeleton-line skeleton-subtitle" />
              </div>
              <span className="skeleton-icon" />
            </div>
          </div>
        ))}
      </section>
      <section className="panel wide overview-skeleton-panel">
        <span className="skeleton-line skeleton-title" />
        <div className="runtime-loop-grid">
          {[0, 1, 2, 3].map((item) => (
            <div className="runtime-loop-card" key={item}>
              <span className="skeleton-line skeleton-label" />
              <span className="skeleton-line skeleton-value" />
              <span className="skeleton-line skeleton-subtitle" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function OverviewPage({ summary, loading }) {
  const health = summary?.health;
  const usage = summary?.usage;
  const rateLimits = usage?.rateLimits;
  const counts = summary?.counts || {};
  const recentActivity = visibleCodexActivity(summary?.activity).slice(0, 6);
  const activeProfile = summary?.activeProfile || {};
  const activeModel = activeProfile.model || summary?.system?.activeModel;
  const activeApproval = activeProfile.approvalMode || summary?.system?.activeApprovalMode;
  const workflowSignals = [
    {
      label: 'Context',
      value: `${counts.threads || 0} sessions`,
      detail: 'Conversation state available',
      icon: GitBranch
    },
    {
      label: 'Tools',
      value: 'task scoped',
      detail: 'Commands and file edits run through tool calls',
      icon: Wrench
    },
    {
      label: 'Workspace',
      value: health?.codexHomeReadable ? 'readable' : 'needs attention',
      detail: 'Files are handled inside the current project boundary',
      icon: FileText
    },
    {
      label: 'Guardrails',
      value: boundaryLabel(activeApproval),
      detail: 'Approval mode defines risky action handling',
      icon: ShieldCheck
    }
  ];

  if (loading && !summary) return <OverviewLoadingState />;

  return (
    <div className="page-grid overview-page">
      <PageHeader
        title="Codex Overview"
        subtitle="Live status for the Codex concepts, limits, and current working profile"
        action={<span className="overview-refresh-note">Updated {formatDate(summary?.refreshedAt)}</span>}
        status={{ label: health?.status || 'unknown', tone: health?.ok ? 'ok' : 'warn' }}
      />

      <section className="stat-grid overview-stat-grid">
        <StatCard label="Subagents" value={counts.agents || 0} icon={Bot} description="delegation profiles" />
        <StatCard label="Skills" value={counts.skills || 0} icon={Layers3} description="reusable instructions" />
        <StatCard label="Sessions" value={counts.threads || 0} icon={GitBranch} description="stored conversations" />
        <StatCard label="Activity Events" value={formatCompact(counts.logs || 0)} icon={Activity} description="visible Codex signals" />
      </section>

      <section className="panel wide overview-loop-panel">
        <div className="panel-header">
          <div>
            <h2>Runtime Loop</h2>
            <p>How the active turn moves through Codex</p>
          </div>
          <span className="pill">{activeModel || 'model pending'}</span>
        </div>
        <div className="runtime-loop-grid">
          {workflowSignals.map((item) => (
            <div className="runtime-loop-card" key={item.label}>
              <div className="icon-row">
                {createElement(item.icon, { size: 18, 'aria-hidden': 'true' })}
                <div>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              </div>
              <p>{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel wide usage-limits-panel">
        <PageHeader
          title="Usage Limits"
          subtitle="Remaining capacity from local Codex session signals"
          status={{
            label: rateLimits?.source?.available ? 'limits detected' : 'limits unavailable',
            tone: rateLimits?.source?.available ? 'ok' : 'idle'
          }}
        />
        <div className="usage-limit-grid">
          <RateLimitCard title="5-Hour Window" icon={Gauge} limit={rateLimits?.primary ? { ...rateLimits.primary, updatedAt: rateLimits?.updatedAt } : null} />
          <RateLimitCard title="Weekly Window" icon={CalendarDays} limit={rateLimits?.secondary ? { ...rateLimits.secondary, updatedAt: rateLimits?.updatedAt } : null} />
        </div>
      </section>

      <section className="panel overview-health">
        <div className="panel-header">
          <div>
            <h2>Health</h2>
            <p>Source readiness</p>
          </div>
          <span className={`status ${health?.ok ? 'ok' : 'warn'}`}>{health?.status || 'unknown'}</span>
        </div>
        <div className="compact-list">
          <div className="compact-row icon-row">
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong>{health?.codexHomeReadable ? 'Codex sources readable' : 'Codex sources need attention'}</strong>
              <span>No local path is shown here; only readiness is surfaced.</span>
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

      <section className="panel overview-profile-panel">
        <div className="panel-header">
          <div>
            <h2>Active Profile</h2>
            <p>Current model and tool boundary</p>
          </div>
          <span className="pill">{activeProfile.name || 'default'}</span>
        </div>
        <div className="detail-list overview-profile-list">
          <Detail label="Model" value={displayProfileValue(activeModel)} />
          <Detail label="Reasoning" value={displayProfileValue(activeProfile.reasoningEffort)} />
          <Detail label="Approval" value={boundaryLabel(activeApproval)} />
          <Detail label="Profile" value={displayProfileValue(activeProfile.name)} />
        </div>
      </section>

      <section className="panel overview-activity-panel">
        <div className="panel-header">
          <div>
            <h2>Recent Activity</h2>
            <p>Latest log events</p>
          </div>
          <span className="pill">{recentActivity.length} shown</span>
        </div>
        {recentActivity.length === 0 ? (
          <div className="overview-empty-slot">
            <EmptyState title="No visible activity" description="Codex activity appears here after non-telemetry events are recorded." />
          </div>
        ) : (
          <div className="compact-list overview-activity-list">
            {recentActivity.map((entry, index) => {
              const display = activityDisplay(entry);

              return (
                <div className="compact-row overview-activity-row" key={`${entry.tsIso || index}-${entry.target || 'event'}`}>
                  <div>
                    <strong>{display.title}</strong>
                    <span>
                      {display.detail} - {formatDate(entry.tsIso)}
                    </span>
                  </div>
                  <span className={`level level-${entry.level || 'info'}`}>{entry.level || 'info'}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel overview-map-panel">
        <div className="panel-header">
          <div>
            <h2>Codex Map</h2>
            <p>Six core concepts in the working loop</p>
          </div>
        </div>
        <div className="codex-map-grid">
          {conceptSignals.map((item, index) => (
            <div className="codex-map-step" key={item.label}>
              <div className={`codex-map-term codex-map-term-${item.tone}`}>
                <span className="codex-map-index">{index + 1}</span>
                <strong>{item.label}</strong>
                <span>{item.value}</span>
                <small>{item.detail}</small>
              </div>
              {index < conceptSignals.length - 1 ? <ArrowRight className="codex-map-arrow" size={18} aria-hidden="true" /> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
