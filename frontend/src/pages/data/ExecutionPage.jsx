import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FilePenLine,
  FileSearch,
  ListFilter,
  PenLine,
  ShieldCheck,
  TerminalSquare,
  Wrench,
  XCircle
} from 'lucide-react';
import { Badge } from 'reactstrap';
import { Detail } from '../../components/ui/Detail.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { InlineError } from '../../components/ui/InlineError.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { useActivity } from '../../hooks/useActivity.js';
import { activityDisplay, visibleCodexActivity } from '../../utils/activityDisplay.js';
import { formatCompact, formatDate } from '../../utils/format.js';

const toolSignals = [
  { id: 'shell', label: 'Shell', icon: TerminalSquare, color: '#0f766e', pattern: /(shell|terminal|command|powershell|bash|cmd|exec|spawn)/i },
  { id: 'edit', label: 'Edit', icon: PenLine, color: '#2563eb', pattern: /(apply_patch|patch|write|edit|modified|created|deleted|rename)/i },
  { id: 'read', label: 'Read/Search', icon: FileSearch, color: '#7c3aed', pattern: /(read|open|search|find|rg|grep|scan|list|file)/i },
  { id: 'boundary', label: 'Boundary', icon: ShieldCheck, color: '#c2410c', pattern: /(approval|approve|permission|sandbox|policy|denied|blocked)/i }
];

const runtimeSignal = { id: 'runtime', label: 'Runtime', icon: Wrench, color: '#475569' };
const allSignals = [...toolSignals, runtimeSignal];
const baselineLevels = ['info', 'warn', 'error', 'debug', 'trace'];
const emptyActivity = [];

function last24HoursIso() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

function textFor(entry) {
  return `${entry.target || ''} ${entry.message || ''} ${entry.modulePath || ''}`.trim();
}

function classifyEntry(entry) {
  const text = textFor(entry);
  return toolSignals.find((signal) => signal.pattern.test(text)) || runtimeSignal;
}

function isFailure(entry) {
  const level = String(entry.level || '').toLowerCase();
  const text = textFor(entry);
  return level.includes('error') || level.includes('warn') || /(failed|error|denied|blocked|timeout)/i.test(text);
}

function isBlocked(entry) {
  return /(approval|approve|permission|sandbox|policy|denied|blocked|guardrail)/i.test(textFor(entry));
}

function buildExecutionModel(events) {
  return events.reduce((acc, event) => {
    const { entry, signal } = event;
    acc.counts[signal.id] = (acc.counts[signal.id] || 0) + 1;
    if (event.failure) acc.failures += 1;
    if (event.blocked) acc.blocked += 1;
    if (entry.threadId) acc.sessions.add(entry.threadId);
    return acc;
  }, { counts: {}, failures: 0, blocked: 0, sessions: new Set() });
}

function shortSession(threadId) {
  if (!threadId) return 'No session';
  return threadId.length > 14 ? `${threadId.slice(0, 8)}...${threadId.slice(-4)}` : threadId;
}

function percent(count, total) {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

export default function ExecutionPage({ summary }) {
  const from = useMemo(() => last24HoursIso(), []);
  const [typeFilter, setTypeFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [expandedId, setExpandedId] = useState('');

  const { data, loading, error } = useActivity({ limit: 200, from });
  const rawActivity = data?.activity || emptyActivity;
  const activity = useMemo(() => visibleCodexActivity(rawActivity), [rawActivity]);
  const events = useMemo(() => activity.map((entry, index) => {
    const signal = classifyEntry(entry);
    return {
      key: entry.id || `${entry.tsIso || entry.ts || 'event'}-${index}`,
      entry,
      signal,
      display: activityDisplay(entry),
      failure: isFailure(entry),
      blocked: isBlocked(entry)
    };
  }), [activity]);
  const model = useMemo(() => buildExecutionModel(events), [events]);
  const totalSignals = allSignals.reduce((total, signal) => total + (model.counts[signal.id] || 0), 0);
  const signalBreakdown = allSignals.map((signal) => ({
    ...signal,
    count: model.counts[signal.id] || 0,
    percent: percent(model.counts[signal.id] || 0, totalSignals)
  }));
  const levelOptions = useMemo(() => {
    const observed = new Set(events.map(({ entry }) => String(entry.level || '').toLowerCase()).filter(Boolean));
    return [...baselineLevels, ...observed].filter((level, index, list) => level && list.indexOf(level) === index);
  }, [events]);
  const sessionOptions = useMemo(() => [...model.sessions].sort(), [model.sessions]);
  const filteredEvents = useMemo(() => events.filter(({ entry, signal }) => {
    const level = String(entry.level || '').toLowerCase();
    return (!typeFilter || signal.id === typeFilter)
      && (!levelFilter || level === levelFilter)
      && (!sessionFilter || entry.threadId === sessionFilter);
  }), [events, levelFilter, sessionFilter, typeFilter]);
  const blockedEvents = events.filter((event) => event.blocked).slice(0, 5);
  const hasFilters = Boolean(typeFilter || levelFilter || sessionFilter);
  const statusAttention = model.failures > 0 || model.blocked > 0;
  const statusLabel = statusAttention ? 'Attention' : 'Normal';
  const StatusIcon = statusAttention ? AlertTriangle : CheckCircle2;

  function clearFilters() {
    setTypeFilter('');
    setLevelFilter('');
    setSessionFilter('');
  }

  return (
    <div className="page-grid execution-page">
      <PageHeader
        title="Execution"
        subtitle={loading ? 'Loading execution signals' : `${activity.length} visible events from the last 24 hours`}
        status={{ label: statusLabel.toLowerCase(), tone: statusAttention ? 'warn' : 'ok' }}
      />

      <section className={`panel execution-health-hero ${statusAttention ? 'is-attention' : 'is-normal'}`}>
        <div className="execution-health-main">
          <span className="execution-health-icon">
            <StatusIcon size={24} aria-hidden="true" />
          </span>
          <div>
            <span className="eyebrow">Execution Health</span>
            <h2>{statusLabel}</h2>
            <p>Command, file, read/search, boundary, and runtime signals observed in the last 24 hours.</p>
          </div>
        </div>
        <div className="execution-health-metrics" aria-label="Last 24 hour execution totals">
          <div>
            <span>Failures</span>
            <strong>{formatCompact(model.failures)}</strong>
          </div>
          <div>
            <span>Blocked</span>
            <strong>{formatCompact(model.blocked)}</strong>
          </div>
          <div>
            <span>Commands</span>
            <strong>{formatCompact(model.counts.shell || 0)}</strong>
          </div>
        </div>
        <div className="execution-mini-grid">
          <div className="execution-mini-card">
            <TerminalSquare size={18} aria-hidden="true" />
            <span>Commands</span>
            <strong>{formatCompact(model.counts.shell || 0)}</strong>
          </div>
          <div className="execution-mini-card">
            <FilePenLine size={18} aria-hidden="true" />
            <span>File Edits</span>
            <strong>{formatCompact(model.counts.edit || 0)}</strong>
          </div>
          <div className="execution-mini-card">
            <FileSearch size={18} aria-hidden="true" />
            <span>Reads/Search</span>
            <strong>{formatCompact(model.counts.read || 0)}</strong>
          </div>
        </div>
      </section>

      <InlineError title="Execution unavailable" message={error} />

      <div className="execution-workbench">
        <section className="panel execution-breakdown-panel">
          <PageHeader
            title="Signal Breakdown"
            subtitle="Click a signal to filter the timeline"
            status={{ label: `${formatCompact(totalSignals)} signals`, tone: totalSignals ? 'ok' : 'idle' }}
          />
          {totalSignals === 0 ? (
            <EmptyState title="No execution signals" description="Execution events will appear after shell, edit, read, or boundary activity is logged." />
          ) : (
            <>
              <div className="execution-stacked-bar" aria-label="Execution signal breakdown">
                {signalBreakdown.filter((signal) => signal.count > 0).map((signal) => (
                  <button
                    aria-pressed={typeFilter === signal.id}
                    className={`execution-stack-segment ${typeFilter === signal.id ? 'is-active' : ''}`}
                    key={signal.id}
                    onClick={() => setTypeFilter(typeFilter === signal.id ? '' : signal.id)}
                    style={{ '--segment-color': signal.color, flexGrow: signal.count }}
                    title={`${signal.label}: ${signal.count} events`}
                    type="button"
                  >
                    <span>{signal.percent}%</span>
                  </button>
                ))}
              </div>
              <div className="execution-breakdown-legend">
                {signalBreakdown.map((signal) => (
                  <button
                    aria-pressed={typeFilter === signal.id}
                    className={`execution-legend-button ${typeFilter === signal.id ? 'is-active' : ''}`}
                    key={signal.id}
                    onClick={() => setTypeFilter(typeFilter === signal.id ? '' : signal.id)}
                    type="button"
                  >
                    <span className="execution-dot" style={{ '--segment-color': signal.color }} />
                    <span>{signal.label}</span>
                    <strong>{formatCompact(signal.count)}</strong>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        <aside className="panel execution-risk-panel">
          <PageHeader
            title="Risk & Guardrails"
            subtitle="Current profile boundary and recent blocked signals"
            status={{ label: model.blocked ? `${model.blocked} blocked` : 'clear', tone: model.blocked ? 'warn' : 'ok' }}
          />
          <div className="execution-guardrail-grid">
            <Detail label="Approval" value={summary?.activeProfile?.approvalMode || summary?.system?.activeApprovalMode} />
            <Detail label="Model" value={summary?.activeProfile?.model || summary?.system?.activeModel} />
            <Detail label="Reasoning" value={summary?.activeProfile?.reasoningEffort} />
            <Detail label="Profile" value={summary?.activeProfile?.name} />
          </div>
          <div className="execution-risk-list">
            <h3>Recent blocked / denied</h3>
            {blockedEvents.length === 0 ? (
              <div className="execution-quiet-state">
                <CheckCircle2 size={18} aria-hidden="true" />
                <span>No blocked or denied events in this window.</span>
              </div>
            ) : blockedEvents.map(({ entry, display, key }) => (
              <article className="execution-risk-event" key={key}>
                <strong>{display.title}</strong>
                <span>{formatDate(entry.tsIso)}</span>
              </article>
            ))}
          </div>
        </aside>
      </div>

      <section className="panel wide execution-timeline-panel">
        <div className="execution-timeline-top">
          <PageHeader
            title="Execution Timeline"
            subtitle={`${filteredEvents.length} events shown`}
            status={{ label: hasFilters ? 'filtered' : 'all', tone: hasFilters ? 'warn' : 'ok' }}
          />
          <div className="filter-bar execution-filter-bar">
            <ListFilter size={18} aria-hidden="true" />
            <select aria-label="Filter by type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="">All types</option>
              {allSignals.map((signal) => (
                <option key={signal.id} value={signal.id}>{signal.label}</option>
              ))}
            </select>
            <select aria-label="Filter by level" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>
              <option value="">All levels</option>
              {levelOptions.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
            <select aria-label="Filter by session" value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value)}>
              <option value="">All sessions</option>
              {sessionOptions.map((threadId) => (
                <option key={threadId} value={threadId}>{shortSession(threadId)}</option>
              ))}
            </select>
            {hasFilters ? (
              <button className="execution-clear-button" onClick={clearFilters} type="button">Clear</button>
            ) : null}
          </div>
        </div>
        {filteredEvents.length === 0 ? (
          <EmptyState title="No matching events" description="Adjust the filters to see more execution activity." />
        ) : (
          <div className="timeline execution-timeline">
            {filteredEvents.map(({ entry, signal, display, failure, key }) => {
              const expanded = expandedId === key;
              const level = String(entry.level || 'unknown').toLowerCase();
              return (
                <article className={`timeline-row execution-event-row ${expanded ? 'is-expanded' : ''}`} key={key}>
                  <Badge className={`level level-${level}`} pill>
                    {signal.label}
                  </Badge>
                  <div className="execution-event-body">
                    <div className="execution-event-title-row">
                      <strong>{display.title}</strong>
                      {failure ? <XCircle size={16} aria-label="Needs attention" /> : <Clock3 size={16} aria-hidden="true" />}
                    </div>
                    <p>{entry.message || display.detail || 'No additional event detail.'}</p>
                    <small>
                      {formatDate(entry.tsIso)}
                      {entry.threadId ? ` / session ${shortSession(entry.threadId)}` : ''}
                    </small>
                    {expanded ? (
                      <div className="execution-detail-drawer">
                        <Detail label="Level" value={level} />
                        <Detail label="Target" value={entry.target} />
                        <Detail label="Module" value={entry.modulePath} />
                        <Detail label="Session" value={entry.threadId} />
                        <Detail label="Timestamp" value={formatDate(entry.tsIso)} />
                        <Detail label="Signal" value={signal.label} />
                      </div>
                    ) : null}
                  </div>
                  <button
                    className="execution-event-action"
                    onClick={() => setExpandedId(expanded ? '' : key)}
                    type="button"
                  >
                    {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                    <span>{expanded ? 'Hide detail' : 'View detail'}</span>
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
