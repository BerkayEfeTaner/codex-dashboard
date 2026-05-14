import { CheckCircle2, FileSearch, PenLine, Search, ShieldCheck, TerminalSquare, Wrench, XCircle } from 'lucide-react';
import { Badge } from 'reactstrap';
import { Detail } from '../../components/ui/Detail.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { InlineError } from '../../components/ui/InlineError.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { useActivity } from '../../hooks/useActivity.js';
import { formatCompact, formatDate } from '../../utils/format.js';

const toolSignals = [
  { id: 'shell', label: 'Shell', icon: TerminalSquare, pattern: /(shell|terminal|command|powershell|bash|cmd|exec|spawn)/i },
  { id: 'edit', label: 'Edit', icon: PenLine, pattern: /(apply_patch|patch|write|edit|modified|created|deleted|rename)/i },
  { id: 'read', label: 'Read/Search', icon: FileSearch, pattern: /(read|open|search|find|rg|grep|scan|list|file)/i },
  { id: 'boundary', label: 'Boundary', icon: ShieldCheck, pattern: /(approval|approve|permission|sandbox|policy|denied|blocked)/i }
];

function textFor(entry) {
  return `${entry.target || ''} ${entry.message || ''} ${entry.modulePath || ''}`.trim();
}

function classifyEntry(entry) {
  const text = textFor(entry);
  return toolSignals.find((signal) => signal.pattern.test(text)) || {
    id: 'runtime',
    label: 'Runtime',
    icon: Wrench
  };
}

function isFailure(entry) {
  const level = String(entry.level || '').toLowerCase();
  const text = textFor(entry);
  return level.includes('error') || level.includes('warn') || /(failed|error|denied|blocked|timeout)/i.test(text);
}

function buildExecutionModel(activity) {
  return activity.reduce((acc, entry) => {
    const signal = classifyEntry(entry);
    acc.counts[signal.id] = (acc.counts[signal.id] || 0) + 1;
    if (isFailure(entry)) acc.failures += 1;
    if (entry.threadId) acc.sessions.add(entry.threadId);
    return acc;
  }, { counts: {}, failures: 0, sessions: new Set() });
}

export default function ExecutionPage({ summary }) {
  const { data, loading, error } = useActivity({ limit: 100 });
  const activity = data?.activity || [];
  const model = buildExecutionModel(activity);
  const observedSignals = toolSignals
    .map((signal) => ({ ...signal, count: model.counts[signal.id] || 0 }))
    .filter((signal) => signal.count > 0);
  const runtimeCount = model.counts.runtime || 0;

  return (
    <div className="page-grid execution-page">
      <PageHeader
        title="Execution"
        subtitle={loading ? 'Loading execution signals' : `${activity.length} recent Codex activity events inspected`}
        status={{ label: model.failures ? `${model.failures} needs attention` : 'normal', tone: model.failures ? 'warn' : 'ok' }}
      />

      <section className="stat-grid">
        <StatCard label="Observed Events" value={formatCompact(activity.length)} icon={Wrench} />
        <StatCard label="Tool Signals" value={formatCompact(observedSignals.reduce((total, signal) => total + signal.count, 0))} icon={TerminalSquare} />
        <StatCard label="Linked Sessions" value={formatCompact(model.sessions.size)} icon={Search} />
        <StatCard label="Attention" value={formatCompact(model.failures)} icon={model.failures ? XCircle : CheckCircle2} />
      </section>

      <InlineError title="Execution unavailable" message={error} />

      <section className="panel">
        <PageHeader
          title="Tool Signals"
          subtitle="Derived from recent Codex activity text"
          status={{ label: observedSignals.length ? `${observedSignals.length} categories` : 'no signals', tone: observedSignals.length ? 'ok' : 'idle' }}
        />
        {observedSignals.length === 0 && runtimeCount === 0 ? (
          <EmptyState title="No execution signals" description="Tool activity will appear when Codex logs include command, file, or boundary events." />
        ) : (
          <div className="execution-signal-grid">
            {observedSignals.map((signal) => (
              <div className="execution-signal" key={signal.id}>
                <signal.icon size={20} aria-hidden="true" />
                <div>
                  <strong>{signal.label}</strong>
                  <span>{formatCompact(signal.count)} matching events</span>
                </div>
              </div>
            ))}
            {runtimeCount > 0 ? (
              <div className="execution-signal">
                <Wrench size={20} aria-hidden="true" />
                <div>
                  <strong>Runtime</strong>
                  <span>{formatCompact(runtimeCount)} uncategorized events</span>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="panel">
        <PageHeader title="Boundaries" subtitle="Current Codex profile guardrails" />
        <div className="detail-list">
          <Detail label="Approval" value={summary?.activeProfile?.approvalMode || summary?.system?.activeApprovalMode} />
          <Detail label="Model" value={summary?.activeProfile?.model || summary?.system?.activeModel} />
          <Detail label="Reasoning" value={summary?.activeProfile?.reasoningEffort} />
          <Detail label="Profile" value={summary?.activeProfile?.name} />
        </div>
      </section>

      <section className="panel wide">
        <PageHeader title="Recent Execution Events" subtitle="Latest activity with inferred execution category" />
        {activity.length === 0 ? (
          <EmptyState title="No activity found" description="Recent Codex execution events will appear here." />
        ) : (
          <div className="timeline execution-timeline">
            {activity.slice(0, 30).map((entry) => {
              const signal = classifyEntry(entry);
              return (
                <article className="timeline-row" key={entry.id}>
                  <Badge className={`level level-${String(entry.level || 'unknown').toLowerCase()}`} pill>
                    {signal.label}
                  </Badge>
                  <div>
                    <strong>{entry.target || 'Codex event'}</strong>
                    <p>{entry.message || '-'}</p>
                    <small>{formatDate(entry.tsIso)}{entry.threadId ? ` / session ${entry.threadId}` : ''}</small>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
