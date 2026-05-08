import { useMemo, useState } from 'react';
import { Badge, Input } from 'reactstrap';
import { Boxes, KeyRound, Layers3, Puzzle, Search, ShieldCheck } from 'lucide-react';
import { EmptyState } from '../components/EmptyState.jsx';
import { InlineError } from '../components/InlineError.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { useCapabilities } from '../hooks/useCapabilities.js';
import { formatCompact, formatDate } from '../utils/format.js';

function matchesQuery(item, query) {
  if (!query) return true;
  const haystack = [
    item.name,
    item.displayName,
    item.description,
    item.scope,
    item.category,
    ...(item.capabilities || []),
    ...(item.keywords || [])
  ].filter(Boolean).join(' ').toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function SkillCard({ skill }) {
  return (
    <article className="capability-card">
      <div className="capability-card-head">
        <div>
          <h3>{skill.name}</h3>
          <span>{skill.description || skill.path}</span>
        </div>
        <Badge color={skill.scope === 'system' ? 'secondary' : 'success'}>{skill.scope}</Badge>
      </div>
      <div className="capability-meta">
        {skill.hasScripts && <span>scripts</span>}
        {skill.hasAgents && <span>agents</span>}
        {skill.hasAssets && <span>assets</span>}
        {skill.hasReferences && <span>references</span>}
        <span>{formatDate(skill.modifiedAt)}</span>
      </div>
    </article>
  );
}

function PluginCard({ plugin }) {
  return (
    <article className="capability-card">
      <div className="capability-card-head">
        <div>
          <h3>{plugin.displayName || plugin.name}</h3>
          <span>{plugin.description || plugin.path}</span>
        </div>
        <Badge color={plugin.marketplaceStatus === 'AVAILABLE' ? 'info' : 'light'}>{plugin.marketplaceStatus}</Badge>
      </div>
      <div className="capability-meta">
        <span>{plugin.category}</span>
        {plugin.version && <span>v{plugin.version}</span>}
        {plugin.policy?.authentication && <span>{plugin.policy.authentication}</span>}
        {plugin.hasSkills && <span>skills</span>}
        {plugin.hasApps && <span>apps</span>}
      </div>
      {plugin.capabilities?.length > 0 && (
        <div className="chips">
          {plugin.capabilities.slice(0, 5).map((capability) => (
            <span className="chip" key={capability}>{capability}</span>
          ))}
          {plugin.capabilities.length > 5 && <span className="chip">+{plugin.capabilities.length - 5}</span>}
        </div>
      )}
    </article>
  );
}

function SourceRow({ label, source }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{source?.path || '-'}</strong>
      <small>{source?.readable ? 'readable' : 'unavailable'}</small>
    </div>
  );
}

export default function CapabilitiesPage() {
  const { data, loading, error } = useCapabilities();
  const [query, setQuery] = useState('');
  const stats = data?.stats || {};

  const filteredSkills = useMemo(
    () => (data?.skills || []).filter((skill) => matchesQuery(skill, query)),
    [data?.skills, query]
  );
  const filteredPlugins = useMemo(
    () => (data?.plugins || []).filter((plugin) => matchesQuery(plugin, query)),
    [data?.plugins, query]
  );

  return (
    <div className="page-grid capabilities-page">
      <PageHeader
        title="Capabilities"
        subtitle={loading ? 'Loading capabilities...' : `Refreshed ${formatDate(data?.refreshedAt)}`}
        status={<span className="pill">Read-only</span>}
      />
      <InlineError message={error} />

      <div className="stat-grid">
        <StatCard label="Skills" value={formatCompact(stats.skills || 0)} icon={Layers3} />
        <StatCard label="Plugins" value={formatCompact(stats.plugins || 0)} icon={Puzzle} />
        <StatCard label="Categories" value={formatCompact(stats.pluginCategories || 0)} icon={Boxes} />
        <StatCard label="Auth plugins" value={formatCompact(stats.pluginsRequiringAuth || 0)} icon={KeyRound} />
      </div>

      <section className="panel wide">
        <div className="capability-toolbar">
          <Search size={18} aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search skills and plugins"
            aria-label="Search capabilities"
          />
        </div>
      </section>

      <div className="capability-layout wide">
        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Skills</span>
              <h2>Available workflows</h2>
            </div>
            <Badge color="light">{filteredSkills.length}</Badge>
          </div>
          {filteredSkills.length === 0 ? (
            <EmptyState title="No skills" description="No skill records matched the current filter." />
          ) : (
            <div className="capability-list">
              {filteredSkills.map((skill) => <SkillCard skill={skill} key={skill.id} />)}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Plugins</span>
              <h2>Installed manifests</h2>
            </div>
            <Badge color="light">{filteredPlugins.length}</Badge>
          </div>
          {filteredPlugins.length === 0 ? (
            <EmptyState title="No plugins" description="No plugin records matched the current filter." />
          ) : (
            <div className="capability-list">
              {filteredPlugins.map((plugin) => <PluginCard plugin={plugin} key={plugin.id} />)}
            </div>
          )}
        </section>
      </div>

      <section className="panel wide">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Sources</span>
            <h2>Capability inputs</h2>
          </div>
          <ShieldCheck size={18} aria-hidden="true" />
        </div>
        <div className="source-grid">
          <SourceRow label="Skills" source={data?.source?.skillsDirectory} />
          <SourceRow label="Plugin cache" source={data?.source?.pluginCache} />
          <SourceRow label="Plugin manifests" source={data?.source?.pluginManifests} />
          <SourceRow label="Marketplace" source={data?.source?.marketplace} />
        </div>
      </section>
    </div>
  );
}
