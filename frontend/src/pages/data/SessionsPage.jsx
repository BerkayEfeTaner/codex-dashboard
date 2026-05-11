import { useState } from 'react';
import { Badge } from 'reactstrap';
import { Detail } from '../../components/ui/Detail.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { InlineError } from '../../components/ui/InlineError.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { useSessionDetail } from '../../hooks/useSessionDetail.js';
import { useSessions } from '../../hooks/useSessions.js';
import { formatCompact, formatDate } from '../../utils/format.js';

export default function SessionsPage() {
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const { data, loading, error } = useSessions(24);
  const stats = data?.stats || {};
  const threads = data?.threads || [];
  const activeThreadId = selectedThreadId || threads[0]?.id || '';
  const { data: detail, loading: detailLoading, error: detailError } = useSessionDetail(activeThreadId);
  const activeThread = detail?.thread;
  const relatedActivity = detail?.activity || [];
  const fileGraph = detail?.fileGraph || { files: [], links: [], totals: { files: 0, events: 0 } };
  const relatedFiles = fileGraph.files || [];
  const maxFileEvents = Math.max(...relatedFiles.map((file) => file.events || 0), 1);
  const byApproval = Object.entries(stats.byApproval || {});
  const bySandbox = Object.entries(stats.bySandbox || {});

  return (
    <div className="page-grid two-col">
      <section className="panel session-panel">
        <PageHeader
          title="Threads"
          subtitle={loading ? 'Loading Codex threads' : `${stats.total || 0} total Codex threads`}
          status={{ label: `${stats.active || 0} active`, tone: 'ok' }}
        />
        <InlineError title="Sessions unavailable" message={error} />
        {threads.length === 0 ? (
          <EmptyState title="No threads found" description="No Codex conversation threads were found yet." />
        ) : (
          <div className="thread-list">
            {threads.map((thread) => (
              <button
                className={`thread-row thread-row-button ${activeThreadId === thread.id ? 'selected' : ''}`}
                key={thread.id}
                type="button"
                onClick={() => setSelectedThreadId(thread.id)}
              >
                <div>
                  <strong>{thread.title || thread.id}</strong>
                  <p>{thread.firstUserMessage || thread.cwd || '-'}</p>
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
          title="Thread Detail"
          subtitle={detailLoading ? 'Loading selected thread' : activeThread?.id || 'No thread selected'}
          status={activeThread ? { label: activeThread.archived ? 'archived' : 'active', tone: activeThread.archived ? 'warn' : 'ok' } : null}
        />
        <InlineError title="Thread detail unavailable" message={detailError} />
        {!activeThread ? (
          <EmptyState title="No thread selected" description="Select a thread to inspect metadata and related activity." />
        ) : (
          <>
            <div className="detail-list">
              <Detail label="Title" value={activeThread.title || '-'} />
              <Detail label="Working directory" value={activeThread.cwd || '-'} />
              <Detail label="Model" value={activeThread.model || '-'} />
              <Detail label="Reasoning" value={activeThread.reasoningEffort || '-'} />
              <Detail label="Approval" value={activeThread.approvalMode || '-'} />
              <Detail label="Sandbox" value={activeThread.sandboxType || '-'} />
              <Detail label="Tokens" value={activeThread.tokensUsed ?? '-'} />
              <Detail label="Updated" value={formatDate(activeThread.updatedAtIso)} />
            </div>
            {activeThread.firstUserMessage && (
              <div className="session-message">
                <strong>First message</strong>
                <p>{activeThread.firstUserMessage}</p>
              </div>
            )}
            <h2 className="section-title">File Relationships</h2>
            <div className="relationship-summary">
              <Detail label="Files" value={formatCompact(fileGraph.totals?.files || 0)} />
              <Detail label="Linked events" value={formatCompact(fileGraph.totals?.events || 0)} />
            </div>
            <div className="file-relationship-list">
              {relatedFiles.length === 0 ? (
                <EmptyState title="No linked files" description="No file or module path entries are linked to this thread yet." />
              ) : (
                relatedFiles.map((file) => {
                  const primaryTarget = Object.entries(file.targets || {}).sort((a, b) => b[1] - a[1])[0];
                  return (
                    <article className="file-relationship-row" key={file.path}>
                      <div>
                        <strong>{file.path}</strong>
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
            <div className="compact-list">
              {relatedActivity.length === 0 ? (
                <EmptyState title="No related activity" description="No log entries are linked to this thread yet." />
              ) : (
                relatedActivity.map((entry) => (
                  <div className="compact-row" key={entry.id}>
                    <strong>{entry.target || 'unknown target'}</strong>
                    <span>{entry.level || '-'} / {formatDate(entry.tsIso)}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
        <div className="session-policy-grid">
          <div>
            <h2>Thread Policy</h2>
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
      </section>
    </div>
  );
}
