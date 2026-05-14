import { useState } from 'react';
import { Clock3, FileText, GitBranch, ShieldCheck } from 'lucide-react';
import { Badge } from 'reactstrap';
import { Detail } from '../../components/ui/Detail.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { InlineError } from '../../components/ui/InlineError.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { useSessionDetail } from '../../hooks/useSessionDetail.js';
import { useSessions } from '../../hooks/useSessions.js';
import { activityDisplay, visibleCodexActivity } from '../../utils/activityDisplay.js';
import { formatCompact, formatDate } from '../../utils/format.js';

function displayFileName(path) {
  if (!path) return 'Unknown file';
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

function shortId(id) {
  if (!id) return '-';
  return id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

function policyEntries(entries) {
  return entries.filter(([, count]) => count > 0);
}

export default function SessionsPage() {
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const { data, loading, error } = useSessions(24);
  const stats = data?.stats || {};
  const threads = data?.threads || [];
  const activeThreadId = selectedThreadId || threads[0]?.id || '';
  const { data: detail, loading: detailLoading, error: detailError } = useSessionDetail(activeThreadId);
  const activeThread = detail?.thread;
  const relatedActivity = visibleCodexActivity(detail?.activity);
  const fileGraph = detail?.fileGraph || { files: [], links: [], totals: { files: 0, events: 0 } };
  const relatedFiles = fileGraph.files || [];
  const maxFileEvents = Math.max(...relatedFiles.map((file) => file.events || 0), 1);
  const byApproval = policyEntries(Object.entries(stats.byApproval || {}));
  const bySandbox = policyEntries(Object.entries(stats.bySandbox || {}));

  return (
    <div className="page-grid two-col sessions-workbench">
      <section className="panel session-panel">
        <PageHeader
          title="Sessions"
          subtitle={loading ? 'Loading Codex sessions' : `${stats.total || 0} total Codex sessions`}
          status={{ label: `${stats.active || 0} active`, tone: 'ok' }}
        />
        <InlineError title="Sessions unavailable" message={error} />
        {threads.length === 0 ? (
          <EmptyState title="No sessions found" description="No Codex conversation sessions were found yet." />
        ) : (
          <div className="thread-list">
            {threads.map((thread) => (
              <button
                className={`thread-row thread-row-button ${activeThreadId === thread.id ? 'selected' : ''}`}
                key={thread.id}
                type="button"
                onClick={() => setSelectedThreadId(thread.id)}
              >
                <div className="thread-main">
                  <span className="thread-status-dot" aria-hidden="true" />
                  <div>
                    <strong>{thread.title || thread.id}</strong>
                    <p>{thread.firstUserMessage || thread.model || 'No summary recorded'}</p>
                  </div>
                </div>
                <div className="thread-meta">
                  <span>{thread.model || '-'}</span>
                  <span>{thread.reasoningEffort || '-'}</span>
                  <span>{formatDate(thread.updatedAtIso)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
      <section className="panel session-detail-panel">
        <PageHeader
          title="Session Detail"
          subtitle={detailLoading ? 'Loading selected session' : activeThread?.id || 'No session selected'}
          status={activeThread ? { label: activeThread.archived ? 'archived' : 'active', tone: activeThread.archived ? 'warn' : 'ok' } : null}
        />
        <InlineError title="Session detail unavailable" message={detailError} />
        {!activeThread ? (
          <EmptyState title="No session selected" description="Select a session to inspect metadata and related activity." />
        ) : (
          <>
            <div className="session-hero">
              <div className="session-hero-icon">
                <GitBranch size={20} aria-hidden="true" />
              </div>
              <div>
                <span>Conversation seed</span>
                <strong>{activeThread.title || 'Untitled session'}</strong>
                {activeThread.firstUserMessage ? <p>{activeThread.firstUserMessage}</p> : <p>No first user message recorded.</p>}
              </div>
            </div>

            <div className="session-runtime-grid">
              <Detail label="Model" value={activeThread.model || '-'} />
              <Detail label="Reasoning" value={activeThread.reasoningEffort || '-'} />
              <Detail label="Approval" value={activeThread.approvalMode || '-'} />
              <Detail label="Sandbox" value={activeThread.sandboxType || '-'} />
              <Detail label="Tokens" value={activeThread.tokensUsed ? formatCompact(activeThread.tokensUsed) : '-'} />
              <Detail label="Updated" value={formatDate(activeThread.updatedAtIso)} />
            </div>

            <div className="session-context-strip">
              <div>
                <Clock3 size={16} aria-hidden="true" />
                <span>Session id</span>
                <strong>{shortId(activeThread.id)}</strong>
              </div>
              <div>
                <FileText size={16} aria-hidden="true" />
                <span>Linked files</span>
                <strong>{formatCompact(fileGraph.totals?.files || 0)}</strong>
              </div>
              <div>
                <ShieldCheck size={16} aria-hidden="true" />
                <span>Boundary</span>
                <strong>{activeThread.sandboxType || '-'}</strong>
              </div>
            </div>

            <h2 className="section-title">Touched Files</h2>
            <div className="relationship-summary">
              <Detail label="Files" value={formatCompact(fileGraph.totals?.files || 0)} />
              <Detail label="Linked events" value={formatCompact(fileGraph.totals?.events || 0)} />
            </div>
            <div className="file-relationship-list scroll-list">
              {relatedFiles.length === 0 ? (
                <EmptyState title="No linked files" description="No file entries are linked to this session yet." />
              ) : (
                relatedFiles.map((file) => {
                  const primaryTarget = Object.entries(file.targets || {}).sort((a, b) => b[1] - a[1])[0];
                  return (
                    <article className="file-relationship-row" key={file.path}>
                      <div>
                        <strong>{displayFileName(file.path)}</strong>
                        <span>{primaryTarget ? `${primaryTarget[0]} / ${formatCompact(primaryTarget[1])} events` : 'No target'}</span>
                      </div>
                      <div className="relationship-meter" aria-label={`${file.events} linked events`}>
                        <span style={{ width: `${Math.max(8, (file.events / maxFileEvents) * 100)}%` }} />
                      </div>
                      <small>{formatDate(file.lastSeenIso)}</small>
                    </article>
                  );
                })
              )}
            </div>
            <h2 className="section-title">Related Activity</h2>
            <div className="compact-list scroll-list">
              {relatedActivity.length === 0 ? (
                <EmptyState title="No related activity" description="No log entries are linked to this session yet." />
              ) : (
                relatedActivity.map((entry) => {
                  const display = activityDisplay(entry);
                  return (
                    <div className="compact-row" key={entry.id}>
                      <strong>{display.title}</strong>
                      <span>{display.detail} / {entry.level || '-'} / {formatDate(entry.tsIso)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
        {(byApproval.length > 0 || bySandbox.length > 0) && (
          <div className="session-policy-grid">
            <div>
              <h2>Session Policy</h2>
              <div className="chips">
                {byApproval.map(([name, count]) => <Badge className="chip" key={name}>{name}: {count}</Badge>)}
              </div>
            </div>
            <div>
              <h2>Sandbox</h2>
              <div className="chips">
                {bySandbox.map(([name, count]) => <Badge className="chip" key={name}>{name}: {count}</Badge>)}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
