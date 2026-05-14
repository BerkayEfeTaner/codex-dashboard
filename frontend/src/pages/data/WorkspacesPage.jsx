import { useMemo, useState } from 'react';
import { Badge, Input } from 'reactstrap';
import { Activity, FolderGit2, GitBranch, Search, ShieldCheck } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { InlineError } from '../../components/ui/InlineError.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { useWorkspaces } from '../../hooks/useWorkspaces.js';
import { formatCompact, formatDate } from '../../utils/format.js';

function matchesWorkspace(workspace, query) {
  if (!query) return true;
  const haystack = [
    workspace.name,
    ...Object.keys(workspace.models || {}),
    ...Object.keys(workspace.approvalModes || {}),
    ...Object.keys(workspace.sandboxTypes || {})
  ].filter(Boolean).join(' ').toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function TopMap({ title, items }) {
  const rows = Object.entries(items || {}).sort((a, b) => b[1] - a[1]).slice(0, 4);

  if (rows.length === 0) {
    return <span className="muted-label">-</span>;
  }

  return (
    <div className="chips" aria-label={title}>
      {rows.map(([label, count]) => (
        <span className="chip" key={label}>{label}: {formatCompact(count)}</span>
      ))}
    </div>
  );
}

function WorkspaceCard({ workspace }) {
  return (
    <article className="workspace-card">
      <div className="workspace-card-head">
        <div>
          <h3>{workspace.name}</h3>
          <span>{workspace.readable ? 'Workspace available' : 'Workspace not reachable'}</span>
        </div>
        <Badge color={workspace.readable ? 'success' : 'warning'}>
          {workspace.readable ? 'readable' : 'unavailable'}
        </Badge>
      </div>

      <div className="workspace-metrics">
        <div>
          <span>Sessions</span>
          <strong>{formatCompact(workspace.threadCount || 0)}</strong>
        </div>
        <div>
          <span>Logs</span>
          <strong>{formatCompact(workspace.logEvents || 0)}</strong>
        </div>
        <div>
          <span>Tokens</span>
          <strong>{formatCompact(workspace.tokensUsed || 0)}</strong>
        </div>
      </div>

      <div className="workspace-card-section">
        <span className="eyebrow">Models</span>
        <TopMap title="Workspace models" items={workspace.models} />
      </div>

      <div className="workspace-card-section">
        <span className="eyebrow">Policy</span>
        <TopMap title="Workspace sandbox types" items={workspace.sandboxTypes} />
      </div>

      <div className="workspace-thread-list">
        {workspace.recentThreads?.slice(0, 3).map((thread) => (
          <div key={thread.id}>
            <strong>{thread.title}</strong>
            <span>{formatDate(thread.updatedAtIso)} - {thread.model || 'unknown model'}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function WorkspacesPage() {
  const { data, loading, error } = useWorkspaces(48);
  const [query, setQuery] = useState('');
  const stats = data?.stats || {};
  const filteredWorkspaces = useMemo(
    () => (data?.workspaces || []).filter((workspace) => matchesWorkspace(workspace, query)),
    [data?.workspaces, query]
  );

  return (
    <div className="page-grid workspaces-page">
      <PageHeader
        title="Workspaces"
        subtitle={loading ? 'Loading workspaces...' : `Refreshed ${formatDate(data?.refreshedAt)}`}
        status={<span className="pill">Read-only</span>}
      />
      <InlineError message={error} />

      <div className="stat-grid">
        <StatCard label="Workspaces" value={formatCompact(stats.total || 0)} icon={FolderGit2} />
        <StatCard label="Readable" value={formatCompact(stats.readable || 0)} icon={ShieldCheck} />
        <StatCard label="Sessions" value={formatCompact(stats.threads || 0)} icon={GitBranch} />
        <StatCard label="Log events" value={formatCompact(stats.logEvents || 0)} icon={Activity} />
      </div>

      <section className="panel wide">
        <div className="capability-toolbar">
          <Search size={18} aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search workspace, model, or policy"
            aria-label="Search workspaces"
          />
        </div>
      </section>

      <section className="panel wide">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Workspace Inventory</span>
            <h2>Projects from Codex session history</h2>
          </div>
          <Badge color="light">{filteredWorkspaces.length}</Badge>
        </div>

        {filteredWorkspaces.length === 0 ? (
          <EmptyState title="No workspaces" description="No workspace records matched the current filter." />
        ) : (
          <div className="workspace-grid">
            {filteredWorkspaces.map((workspace) => (
              <WorkspaceCard workspace={workspace} key={workspace.id} />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
