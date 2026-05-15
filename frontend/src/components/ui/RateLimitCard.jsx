import { createElement } from 'react';
import { Badge } from 'reactstrap';
import { formatDate } from '../../utils/format.js';

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

export function RateLimitCard({ title, icon: Icon, limit }) {
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
