import { Badge } from 'reactstrap';
import { Bot, Clock3, GitBranch, Layers3, Link2, Network } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { InlineError } from '../../components/ui/InlineError.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { useOrchestration } from '../../hooks/useOrchestration.js';
import { formatCompact, formatDate } from '../../utils/format.js';

function AgentNode({ agent }) {
  return (
    <article className="orchestration-agent-card">
      <div className="orchestration-card-head">
        <div>
          <h3>{agent.name || agent.id}</h3>
          <span>{agent.team || 'unknown team'}</span>
        </div>
        <Badge color={agent.status === 'recent' ? 'success' : 'light'}>
          {agent.status === 'recent' ? 'Recent' : 'Configured'}
        </Badge>
      </div>

      <div className="orchestration-meta">
        <span>{agent.model || 'unknown model'}</span>
        <span>{agent.metrics?.skillCount || 0} skills</span>
        <span>{agent.metrics?.threadCount || 0} threads</span>
      </div>

      <div className="chips">
        {(agent.skills || []).slice(0, 4).map((skill) => (
          <span className="chip" key={skill}>{skill}</span>
        ))}
        {(agent.skills || []).length > 4 && (
          <span className="chip">+{agent.skills.length - 4}</span>
        )}
      </div>
    </article>
  );
}

function Lane({ lane }) {
  const agents = lane.agents || [];
  const threads = lane.threads || [];

  return (
    <section className="orchestration-lane">
      <div className="orchestration-lane-head">
        <strong>{lane.label}</strong>
        <span>{agents.length || threads.length}</span>
      </div>

      {agents.length > 0 && (
        <div className="orchestration-lane-items">
          {agents.map((agent) => <AgentNode agent={agent} key={agent.id} />)}
        </div>
      )}

      {threads.length > 0 && (
        <div className="orchestration-link-list">
          {threads.map((thread) => (
            <div className="orchestration-link-row" key={thread.id}>
              <GitBranch size={16} aria-hidden="true" />
              <div>
                <strong>{thread.title || thread.id}</strong>
                <span>{thread.model || 'unknown model'} · {formatDate(thread.updatedAtIso)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {agents.length === 0 && threads.length === 0 && (
        <EmptyState title="No records" description="This lane has no current records." />
      )}
    </section>
  );
}

function LinkRow({ edge }) {
  return (
    <div className="orchestration-link-row">
      <Link2 size={16} aria-hidden="true" />
      <div>
        <strong>{edge.label || edge.to}</strong>
        <span>{edge.type} · {formatDate(edge.updatedAtIso)}</span>
      </div>
    </div>
  );
}

export default function OrchestrationPage() {
  const { data, loading, error } = useOrchestration();
  const stats = data?.stats || {};
  const lanes = data?.lanes || [];
  const edges = data?.edges || [];

  return (
    <div className="page-grid orchestration-page">
      <PageHeader
        title="Orchestration"
        subtitle={loading ? 'Loading orchestration...' : `Refreshed ${formatDate(data?.refreshedAt)}`}
        status={<span className="pill">Read-only</span>}
      />
      <InlineError message={error} />

      <div className="stat-grid">
        <StatCard label="Agents" value={formatCompact(stats.agents || 0)} icon={Bot} />
        <StatCard label="Recent agents" value={formatCompact(stats.recentlyActiveAgents || 0)} icon={Clock3} />
        <StatCard label="Skills" value={formatCompact(stats.skills || 0)} icon={Layers3} />
        <StatCard label="Links" value={formatCompact(stats.links || 0)} icon={Network} />
      </div>

      <section className="panel wide">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Agent lanes</span>
            <h2>Operating map</h2>
          </div>
          <Badge color="light">{stats.agentSessions || 0} agent sessions</Badge>
        </div>

        <div className="orchestration-board">
          {lanes.map((lane) => <Lane lane={lane} key={lane.id} />)}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Relationships</span>
            <h2>Agent links</h2>
          </div>
          <Badge color="light">{edges.length}</Badge>
        </div>
        {edges.length === 0 ? (
          <EmptyState title="No links yet" description="No recent agent-to-session relationships were detected." />
        ) : (
          <div className="orchestration-link-list">
            {edges.slice(0, 12).map((edge) => <LinkRow edge={edge} key={edge.id} />)}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Sources</span>
            <h2>Contract inputs</h2>
          </div>
        </div>
        <div className="detail-list">
          <div><span>Agents</span><strong>{data?.source?.agents?.path || '-'}</strong></div>
          <div><span>Agent sessions</span><strong>{data?.source?.agentSessions?.path || '-'}</strong></div>
          <div><span>Threads DB</span><strong>{data?.source?.threads?.path || '-'}</strong></div>
        </div>
      </section>
    </div>
  );
}
