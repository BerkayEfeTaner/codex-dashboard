import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Badge, Button } from 'reactstrap';
import { Detail } from '../../components/ui/Detail.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { InlineError } from '../../components/ui/InlineError.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { useActivity } from '../../hooks/useActivity.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { activityDisplay } from '../../utils/activityDisplay.js';
import { formatCompact, formatDate } from '../../utils/format.js';

export default function ActivityPage() {
  const limit = 50;
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('');
  const [target, setTarget] = useState('');
  const [threadId, setThreadId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);
  const debouncedQuery = useDebouncedValue(query.trim(), 250);
  const debouncedThreadId = useDebouncedValue(threadId.trim(), 250);
  const { data, loading, error } = useActivity({
    query: debouncedQuery,
    level,
    target,
    threadId: debouncedThreadId,
    from,
    to,
    limit,
    offset
  });
  const activity = data?.activity || [];
  const pagination = data?.pagination || { limit, offset, total: 0, hasNext: false };
  const logLevels = Object.entries(data?.stats?.byLevel || {});
  const recentTargets = data?.stats?.recentTargets || [];
  const pageStart = pagination.total === 0 ? 0 : pagination.offset + 1;
  const pageEnd = Math.min(pagination.offset + pagination.limit, pagination.total);
  const hasFilters = Boolean(query || level || target || threadId || from || to);

  function resetFilters() {
    setQuery('');
    setLevel('');
    setTarget('');
    setThreadId('');
    setFrom('');
    setTo('');
    setOffset(0);
  }

  return (
    <div className="page-grid two-col">
      <section className="panel activity-panel">
        <PageHeader
          title="Signals"
          subtitle={loading ? 'Loading recent Codex signals' : `${pageStart}-${pageEnd} of ${pagination.total} raw Codex signals`}
          action={(
            <div className="filter-bar">
              <label className="search-box">
                <Search size={16} aria-hidden="true" />
                <input
                  aria-label="Search signals"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setOffset(0);
                  }}
                  placeholder="Search signals"
                />
              </label>
              <select
                aria-label="Filter signals by level"
                value={level}
                onChange={(event) => {
                  setLevel(event.target.value);
                  setOffset(0);
                }}
              >
                <option value="">All levels</option>
                {logLevels.map(([name]) => <option key={name} value={name}>{name}</option>)}
              </select>
              <select
                aria-label="Filter signals by target"
                value={target}
                onChange={(event) => {
                  setTarget(event.target.value);
                  setOffset(0);
                }}
              >
                <option value="">All signals</option>
                {recentTargets.map((item) => (
                  <option key={item.target} value={item.target}>
                    {activityDisplay({ target: item.target }).title}
                  </option>
                ))}
              </select>
              <Button
                color="light"
                className="icon-button"
                disabled={!hasFilters}
                onClick={resetFilters}
                title="Clear filters"
                aria-label="Clear signal filters"
              >
                <X size={16} aria-hidden="true" />
              </Button>
            </div>
          )}
        />
        <div className="advanced-filter-grid" aria-label="Advanced signal filters">
          <label>
            <span>Session</span>
            <input
              aria-label="Filter signals by session id"
              value={threadId}
              onChange={(event) => {
                setThreadId(event.target.value);
                setOffset(0);
              }}
              placeholder="Session id"
            />
          </label>
          <label>
            <span>From</span>
            <input
              aria-label="Filter signals from date"
              type="datetime-local"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setOffset(0);
              }}
            />
          </label>
          <label>
            <span>To</span>
            <input
              aria-label="Filter signals to date"
              type="datetime-local"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setOffset(0);
              }}
            />
          </label>
        </div>
        <InlineError title="Signals unavailable" message={error} />
        {activity.length === 0 ? (
          <EmptyState
            title="No signals found"
            description={query ? 'Try a different search term.' : 'No recent Codex signals were found.'}
          />
        ) : (
          <div className="timeline">
            {activity.map((entry) => {
              const display = activityDisplay(entry);
              return (
                <article className="timeline-row" key={entry.id}>
                  <Badge className={`level level-${String(entry.level || 'unknown').toLowerCase()}`} pill>
                    {entry.level || '-'}
                  </Badge>
                  <div>
                    <strong>{display.title}</strong>
                    <p>{entry.message || display.detail}</p>
                    <small>{display.detail} / {formatDate(entry.tsIso)} {entry.threadId ? ` / ${entry.threadId}` : ''}</small>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <div className="pager-actions">
          <Button
            color="light"
            disabled={loading || pagination.offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            Previous
          </Button>
          <span>{pageStart}-{pageEnd} / {pagination.total}</span>
          <Button
            color="light"
            disabled={loading || !pagination.hasNext}
            onClick={() => setOffset(offset + limit)}
          >
            Next
          </Button>
        </div>
      </section>

      <section className="panel">
        <h2>Signal Health</h2>
        <div className="detail-list">
          {logLevels.length === 0 ? (
            <EmptyState title="No log levels" description="Log level statistics are not available yet." />
          ) : (
            logLevels.map(([level, count]) => (
              <Detail key={level} label={level} value={formatCompact(count)} />
            ))
          )}
        </div>
        <h2 className="section-title">Recent Signals</h2>
        <div className="compact-list">
          {recentTargets.length === 0 ? (
            <EmptyState title="No targets" description="Recent signal targets are not available yet." />
          ) : (
            recentTargets.map((target) => {
              const display = activityDisplay({ target: target.target });
              return (
                <div className="compact-row" key={target.target}>
                  <strong>{display.title}</strong>
                  <span>{display.detail} / {formatCompact(target.count)} events / {formatDate(target.lastSeenIso)}</span>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
