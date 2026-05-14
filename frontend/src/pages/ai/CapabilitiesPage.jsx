import { createElement, useMemo, useState } from 'react';
import { Badge, Input } from 'reactstrap';
import { Boxes, KeyRound, Layers3, Puzzle, Search, ShieldCheck } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { InlineError } from '../../components/ui/InlineError.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { useCapabilities } from '../../hooks/useCapabilities.js';
import { formatCompact, formatDate } from '../../utils/format.js';

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

function SummaryTile({ label, value, hint, icon }) {
  return (
    <div className="capabilities-summary-tile">
      <div className="capabilities-summary-icon">{createElement(icon, { size: 18, 'aria-hidden': 'true' })}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </div>
  );
}

function SkillCard({ skill }) {
  const capabilityFlags = [
    skill.hasScripts && 'scripts',
    skill.hasAssets && 'assets',
    skill.hasReferences && 'references'
  ].filter(Boolean);

  return (
    <article className="capability-row">
      <div className="capability-row-mark capability-row-mark-skill" aria-hidden="true">
        {skill.name?.slice(0, 1)?.toUpperCase() || 'S'}
      </div>
      <div className="capability-row-main">
        <div className="capability-row-title">
          <h3>{skill.name}</h3>
          <Badge color={skill.scope === 'system' ? 'secondary' : 'success'}>{skill.scope}</Badge>
        </div>
        <p>{skill.description || 'Reusable Codex instruction set'}</p>
        <div className="capability-row-meta">
          {capabilityFlags.length > 0 ? (
            capabilityFlags.map((flag) => <span key={flag}>{flag}</span>)
          ) : (
            <span>instructions</span>
          )}
          <span>{formatDate(skill.modifiedAt)}</span>
        </div>
      </div>
    </article>
  );
}

function PluginCard({ plugin }) {
  const capabilities = plugin.capabilities || [];
  const displayName = plugin.displayName || plugin.name;

  return (
    <article className="capability-row">
      <div className="capability-row-mark capability-row-mark-extension" aria-hidden="true">
        {displayName?.slice(0, 1)?.toUpperCase() || 'E'}
      </div>
      <div className="capability-row-main">
        <div className="capability-row-title">
          <h3>{displayName}</h3>
          <Badge color={plugin.marketplaceStatus === 'AVAILABLE' ? 'info' : 'light'}>
            {plugin.marketplaceStatus}
          </Badge>
        </div>
        <p>{plugin.description || 'Codex extension manifest'}</p>
        <div className="capability-row-meta">
          <span>{plugin.category}</span>
          {plugin.version && <span>v{plugin.version}</span>}
          {plugin.policy?.authentication && <span>{plugin.policy.authentication}</span>}
          {plugin.hasSkills && <span>skills</span>}
          {plugin.hasApps && <span>apps</span>}
        </div>
        {capabilities.length > 0 && (
          <div className="capability-row-chips">
            {capabilities.slice(0, 3).map((capability) => (
              <span className="chip" key={capability}>{capability}</span>
            ))}
            {capabilities.length > 3 && <span className="chip">+{capabilities.length - 3}</span>}
          </div>
        )}
      </div>
    </article>
  );
}

function SourceRow({ label, source }) {
  const isAvailable = Boolean(source?.readable || source?.available);

  return (
    <div>
      <span>{label}</span>
      <strong>{isAvailable ? 'Available' : 'Unavailable'}</strong>
      <small>{isAvailable ? 'readable' : 'unavailable'}</small>
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
        title="Skills"
        subtitle={loading ? 'Loading Codex skills...' : `Refreshed ${formatDate(data?.refreshedAt)}`}
        status={{ label: 'Read-only', tone: 'idle' }}
      />
      <InlineError message={error} />

      <section className="panel wide capabilities-hero">
        <div className="capabilities-hero-copy">
          <span className="eyebrow">Capability library</span>
          <h2>Skills, extensions, and source health in one surface.</h2>
          <p>
            Search the Codex capability catalog, compare metadata, and keep source boundaries visible without jumping
            across screens.
          </p>
        </div>

        <div className="capabilities-summary-grid">
          <SummaryTile label="Skills" value={formatCompact(stats.skills || 0)} hint="Reusable instructions" icon={Layers3} />
          <SummaryTile label="Extensions" value={formatCompact(stats.plugins || 0)} hint="Installed manifests" icon={Puzzle} />
          <SummaryTile label="Groups" value={formatCompact(stats.pluginCategories || 0)} hint="Capability families" icon={Boxes} />
          <SummaryTile label="Auth" value={formatCompact(stats.pluginsRequiringAuth || 0)} hint="Needs permission" icon={KeyRound} />
        </div>

        <div className="capability-toolbar capability-toolbar-surface">
          <Search size={18} aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search skills, extensions, or capabilities"
            aria-label="Search skills, extensions, or capabilities"
          />
        </div>
      </section>

      <div className="capability-layout wide">
        <section className="panel capability-panel">
          <div className="panel-header capability-section-header">
            <div>
              <span className="eyebrow">Skills</span>
              <h2>Reusable instructions</h2>
              <p>Instruction packs Codex can apply during a task.</p>
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

        <section className="panel capability-panel">
          <div className="panel-header capability-section-header">
            <div>
              <span className="eyebrow">Extensions</span>
              <h2>Installed extension manifests</h2>
              <p>Local plugin manifests and the actions they expose.</p>
            </div>
            <Badge color="light">{filteredPlugins.length}</Badge>
          </div>
          {filteredPlugins.length === 0 ? (
            <EmptyState title="No extensions" description="No extension records matched the current filter." />
          ) : (
            <div className="capability-list">
              {filteredPlugins.map((plugin) => <PluginCard plugin={plugin} key={plugin.id} />)}
            </div>
          )}
        </section>
      </div>

      <section className="panel wide capability-source-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Sources</span>
            <h2>Skill inputs</h2>
          </div>
          <ShieldCheck size={18} aria-hidden="true" />
        </div>
        <div className="source-grid capability-source-grid">
          <SourceRow label="Skills" source={data?.source?.skillsDirectory} />
          <SourceRow label="Project skills" source={data?.source?.projectSkillsDirectory} />
          <SourceRow label="Extension cache" source={data?.source?.pluginCache} />
          <SourceRow label="Extension manifests" source={data?.source?.pluginManifests} />
          <SourceRow label="Marketplace" source={data?.source?.marketplace} />
        </div>
      </section>
    </div>
  );
}
