import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Badge } from 'reactstrap';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { InlineError } from '../../components/ui/InlineError.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { useAgentDetail } from '../../hooks/useAgentDetail.js';
import { useAgents } from '../../hooks/useAgents.js';

export default function AgentsPage() {
  const [query, setQuery] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const { data: agents = [], loading, error } = useAgents();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return agents.filter((agent) => {
      const haystack = [agent.name, agent.id, agent.team, agent.model, agent.type, agent.scope, ...(agent.skills || [])].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [agents, query]);

  const effectiveSelectedAgentId = selectedAgentId || filtered[0]?.id || '';
  const detailState = useAgentDetail(effectiveSelectedAgentId);
  const detail = detailState.data?.agent;
  const usage = detailState.data?.lastKnownUsage;

  return (
    <div className="page-grid agents-layout">
      <section className="panel agents-list-panel">
        <PageHeader
          title="Subagents"
          subtitle={loading ? 'Loading subagents...' : `${filtered.length} visible Codex records`}
          action={(
            <label className="search-box">
              <Search size={16} aria-hidden="true" />
              <input
                aria-label="Search subagents"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search subagents"
              />
            </label>
          )}
        />
        <InlineError message={error} />
        {filtered.length === 0 ? (
          <EmptyState
            title="No subagents found"
            description={query ? 'Try a different search term.' : 'No Codex subagent TOML files or local profile notes were found.'}
          />
        ) : (
          <div className="agent-grid">
            {filtered.map((agent) => (
              <button
                className={`agent-card agent-card-button ${agent.id === effectiveSelectedAgentId ? 'selected' : ''}`}
                key={agent.id}
                type="button"
                onClick={() => setSelectedAgentId(agent.id)}
              >
                <h3>{agent.name || agent.id}</h3>
                <p>{agent.description || agent.instructions || 'No description'}</p>
                <div className="chips">
                  {[agent.type, agent.scope, agent.team, agent.model, agent.reasoningEffort, ...(agent.skills || []).slice(0, 3)]
                    .filter(Boolean)
                    .map((chip) => <span className="chip" key={chip}>{chip}</span>)}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="panel agent-detail-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Selected record</span>
            <h2>{detail?.name || detail?.id || 'Subagent detail'}</h2>
          </div>
          {detail?.team && <Badge color="light">{detail.team}</Badge>}
        </div>
        <InlineError message={detailState.error} />
        {!detail ? (
          <EmptyState
            title={detailState.loading ? 'Loading detail' : 'No subagent selected'}
            description="Select a subagent or local profile record to inspect its source-backed detail."
          />
        ) : (
          <>
            <p>{detail.description || detail.instructions || 'No description available.'}</p>
            <div className="detail-list">
              <div><span>ID</span><strong>{detail.id}</strong></div>
              <div><span>Model</span><strong>{detail.model || 'Unknown'}</strong></div>
              <div><span>Reasoning</span><strong>{detail.reasoningEffort || 'Default'}</strong></div>
              <div><span>Source</span><strong>{detailState.data?.source?.readable === false ? 'Unavailable' : 'Local Codex profile'}</strong></div>
              <div>
                <span>Last usage</span>
                <strong>{usage?.updatedAtIso || 'Not available yet'}</strong>
              </div>
            </div>
            <div className="chips skill-list">
              {(detail.skills || []).length === 0 ? (
                <span className="chip">No skills</span>
              ) : (
                detail.skills.map((skill) => <span className="chip" key={skill}>{skill}</span>)
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
