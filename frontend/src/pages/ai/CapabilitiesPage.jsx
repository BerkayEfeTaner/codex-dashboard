import { createElement, useMemo, useState } from 'react';
import { Badge, Input } from 'reactstrap';
import { Boxes, FilePlus2, KeyRound, Layers3, Puzzle, Search, ShieldCheck } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { InlineError } from '../../components/ui/InlineError.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { useCapabilities } from '../../hooks/useCapabilities.js';
import { useSkillCandidates } from '../../hooks/useSkillCandidates.js';
import { formatCompact, formatDate } from '../../utils/format.js';

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

function getSkillFlags(skill) {
  return [
    skill.hasScripts && 'scripts',
    skill.hasAssets && 'assets',
    skill.hasReferences && 'references'
  ].filter(Boolean);
}

function toSkillItem(skill) {
  const flags = getSkillFlags(skill);

  return {
    id: `skill-${skill.id}`,
    type: 'skill',
    label: 'Skill',
    title: skill.name,
    description: skill.description || 'Reusable Codex instruction set',
    badge: skill.scope,
    badgeColor: skill.scope === 'system' ? 'secondary' : 'success',
    mark: skill.name?.slice(0, 1)?.toUpperCase() || 'S',
    definition: 'Task-time instruction pack',
    meta: [
      { label: 'Scope', value: skill.scope || 'unknown' },
      { label: 'Updated', value: formatDate(skill.modifiedAt) },
      { label: 'Signals', value: flags.length > 0 ? flags.join(', ') : 'instructions' }
    ],
    chips: flags.length > 0 ? flags : ['instructions'],
    search: [
      skill.name,
      skill.description,
      skill.scope,
      ...flags
    ].filter(Boolean).join(' ')
  };
}

function toPluginItem(plugin) {
  const displayName = plugin.displayName || plugin.name;
  const capabilities = plugin.capabilities || [];
  const signals = [
    plugin.hasSkills && 'skills',
    plugin.hasApps && 'apps',
    plugin.policy?.authentication && plugin.policy.authentication
  ].filter(Boolean);

  return {
    id: `extension-${plugin.id}`,
    type: 'extension',
    label: 'Extension',
    title: displayName,
    description: plugin.description || 'Codex extension manifest',
    badge: plugin.marketplaceStatus,
    badgeColor: plugin.marketplaceStatus === 'AVAILABLE' ? 'info' : 'light',
    mark: displayName?.slice(0, 1)?.toUpperCase() || 'E',
    definition: 'Installed plugin manifest',
    meta: [
      { label: 'Category', value: plugin.category || 'uncategorized' },
      { label: 'Version', value: plugin.version ? `v${plugin.version}` : 'unknown' },
      { label: 'Auth', value: plugin.policy?.authentication || 'none' }
    ],
    chips: capabilities.length > 0 ? capabilities : signals,
    search: [
      plugin.name,
      plugin.displayName,
      plugin.description,
      plugin.category,
      plugin.marketplaceStatus,
      plugin.version,
      plugin.policy?.authentication,
      ...capabilities,
      ...signals,
      ...(plugin.keywords || [])
    ].filter(Boolean).join(' ')
  };
}

function matchesCatalogItem(item, query) {
  if (!query) return true;
  return item.search.toLowerCase().includes(query.toLowerCase());
}

function CapabilityFilterButton({ filter, active, onClick }) {
  return (
    <button
      type="button"
      className={`capability-filter-button${active ? ' is-active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span>
        <strong>{filter.label}</strong>
        <small>{filter.hint}</small>
      </span>
      <Badge color={active ? 'success' : 'light'}>{filter.count}</Badge>
    </button>
  );
}

function CapabilityListRow({ item, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`capability-list-row capability-list-row-${item.type}${selected ? ' is-selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className={`capability-row-mark capability-row-mark-${item.type}`} aria-hidden="true">
        {item.mark}
      </span>
      <span className="capability-list-row-main">
        <span className="capability-list-row-title">
          <strong>{item.title}</strong>
          <Badge color={item.badgeColor}>{item.badge}</Badge>
        </span>
        <span className="capability-list-row-description">{item.description}</span>
        <span className="capability-row-meta">
          <span>{item.label}</span>
          {item.meta.slice(0, 2).map((entry) => <span key={entry.label}>{entry.value}</span>)}
        </span>
      </span>
    </button>
  );
}

function CapabilityDetail({ item }) {
  if (!item) {
    return (
      <EmptyState
        title="No capability selected"
        description="Select a skill or extension to inspect its purpose and metadata."
      />
    );
  }

  return (
    <div className="capability-detail-body">
      <div className="capability-detail-hero">
        <div className={`capability-row-mark capability-row-mark-${item.type}`} aria-hidden="true">
          {item.mark}
        </div>
        <div>
          <span className="eyebrow">{item.label}</span>
          <h2>{item.title}</h2>
          <p>{item.description}</p>
        </div>
        <Badge color={item.badgeColor}>{item.badge}</Badge>
      </div>

      <div className="capability-definition">
        <span>Codex meaning</span>
        <strong>{item.definition}</strong>
      </div>

      <div className="capability-detail-grid">
        {item.meta.map((entry) => (
          <div className="capability-detail-item" key={entry.label}>
            <span>{entry.label}</span>
            <strong>{entry.value}</strong>
          </div>
        ))}
      </div>

      {item.chips.length > 0 && (
        <div className="capability-detail-chips">
          {item.chips.slice(0, 8).map((chip) => <span className="chip" key={chip}>{chip}</span>)}
          {item.chips.length > 8 && <span className="chip">+{item.chips.length - 8}</span>}
        </div>
      )}
    </div>
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

function formatConfidence(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '0%';
  return `${Math.round(numericValue * 100)}%`;
}

function SkillCandidateQueue({ candidates, loading, error }) {
  if (error) {
    return <InlineError message={error} />;
  }

  if (loading && candidates.length === 0) {
    return (
      <div className="skill-candidate-empty">
        <strong>Scanning local signals</strong>
        <small>Candidate queue will appear after repeated non-telemetry patterns are detected.</small>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="skill-candidate-empty">
        <strong>No candidates yet</strong>
        <small>Repeated workflow gaps will be listed here before any SKILL.md is created.</small>
      </div>
    );
  }

  return (
    <div className="skill-candidate-list">
      {candidates.slice(0, 4).map((candidate) => (
        <article className="skill-candidate-card" key={candidate.id}>
          <header>
            <div>
              <span className="eyebrow">{candidate.status}</span>
              <h3>{candidate.title}</h3>
            </div>
            <Badge color={candidate.confidence >= 0.78 ? 'success' : 'light'}>
              {formatConfidence(candidate.confidence)}
            </Badge>
          </header>
          <p>{candidate.description}</p>
          <div className="skill-candidate-meta">
            <span>{formatCompact(candidate.evidenceCount)} signals</span>
            <span>{candidate.name}</span>
            <span>{formatDate(candidate.updatedAt)}</span>
          </div>
        </article>
      ))}
      {candidates.length > 4 && (
        <span className="skill-candidate-more">+{candidates.length - 4} more candidates</span>
      )}
    </div>
  );
}

function SkillAutonomyPanel({ data, loading, error }) {
  const candidates = data?.candidates || [];
  const stats = data?.stats || {};
  const daemon = data?.daemon || {};
  const isWatching = daemon.status === 'watching';

  return (
    <section className="panel wide skill-autonomy-panel">
      <div className="skill-autonomy-heading">
        <div className="capabilities-summary-icon">
          <FilePlus2 size={18} aria-hidden="true" />
        </div>
        <div>
          <span className="eyebrow">Autonomous growth</span>
          <div className="skill-autonomy-title-row">
            <h2>Skill candidate daemon</h2>
            <Badge color={isWatching ? 'success' : 'light'}>{isWatching ? 'watching' : 'idle'}</Badge>
          </div>
          <p>Repeated local signals become candidate skills. This daemon does not write skill files automatically.</p>
        </div>
      </div>

      <div className="skill-autonomy-flow" aria-label="Autonomous skill lifecycle">
        <div>
          <span>1</span>
          <strong>Gap detected</strong>
          <small>A repeated workflow or missing rule becomes visible during work.</small>
        </div>
        <div>
          <span>2</span>
          <strong>Skill drafted</strong>
          <small>Codex prepares a focused SKILL.md with trigger rules and lean guidance.</small>
        </div>
        <div>
          <span>3</span>
          <strong>Catalog updated</strong>
          <small>The new skill becomes discoverable from this capability library.</small>
        </div>
      </div>

      <div className="skill-candidate-queue">
        <div className="skill-candidate-queue-header">
          <div>
            <span className="eyebrow">Candidate queue</span>
            <strong>{formatCompact(stats.candidates || 0)} open candidates</strong>
          </div>
          <div className="skill-candidate-stats">
            <Badge color="light">{formatCompact(stats.signals || 0)} signals</Badge>
            <Badge color="light">{formatCompact(stats.highConfidence || 0)} high</Badge>
          </div>
        </div>
        <SkillCandidateQueue candidates={candidates} loading={loading} error={error} />
        <div className="skill-autonomy-note">
          <span>Boundary</span>
          <strong>{daemon.mode || 'read-only'} / {daemon.writesSkills ? 'writes skills' : 'candidate only'}</strong>
          <small>Promotion to a real skill still runs through Codex file edits and review.</small>
        </div>
      </div>
    </section>
  );
}

export default function CapabilitiesPage() {
  const { data, loading, error } = useCapabilities();
  const { data: skillCandidates, loading: skillCandidatesLoading, error: skillCandidatesError } = useSkillCandidates();
  const [query, setQuery] = useState('');
  const [activeType, setActiveType] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const stats = data?.stats || {};

  const catalogItems = useMemo(
    () => [
      ...(data?.skills || []).map(toSkillItem),
      ...(data?.plugins || []).map(toPluginItem)
    ],
    [data?.plugins, data?.skills]
  );

  const visibleItems = useMemo(
    () => catalogItems.filter((item) => (
      (activeType === 'all' || item.type === activeType) && matchesCatalogItem(item, query)
    )),
    [activeType, catalogItems, query]
  );

  const selectedItem = useMemo(
    () => visibleItems.find((item) => item.id === selectedId) || visibleItems[0] || null,
    [selectedId, visibleItems]
  );

  const filters = useMemo(
    () => [
      { id: 'all', label: 'All', hint: 'Skills + extensions', count: catalogItems.length },
      { id: 'skill', label: 'Skills', hint: 'Reusable instructions', count: (data?.skills || []).length },
      { id: 'extension', label: 'Extensions', hint: 'Plugin manifests', count: (data?.plugins || []).length }
    ],
    [catalogItems.length, data?.plugins, data?.skills]
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

      <SkillAutonomyPanel data={skillCandidates} loading={skillCandidatesLoading} error={skillCandidatesError} />

      <div className="capability-workbench wide">
        <aside className="panel capability-filter-panel">
          <div className="panel-header capability-section-header">
            <div>
              <span className="eyebrow">Catalog</span>
              <h2>Browse</h2>
              <p>Filter by Codex capability type.</p>
            </div>
          </div>
          <div className="capability-filter-group">
            {filters.map((filter) => (
              <CapabilityFilterButton
                filter={filter}
                active={activeType === filter.id}
                onClick={() => setActiveType(filter.id)}
                key={filter.id}
              />
            ))}
          </div>
        </aside>

        <section className="panel capability-catalog-panel">
          <div className="panel-header capability-section-header">
            <div>
              <span className="eyebrow">Catalog</span>
              <h2>{activeType === 'all' ? 'All capabilities' : filters.find((filter) => filter.id === activeType)?.label}</h2>
              <p>{visibleItems.length} visible items</p>
            </div>
            <Badge color="light">{visibleItems.length}</Badge>
          </div>
          {visibleItems.length === 0 ? (
            <EmptyState title="No capabilities" description="No skill or extension records matched the current filter." />
          ) : (
            <div className="capability-catalog-list">
              {visibleItems.map((item) => (
                <CapabilityListRow
                  item={item}
                  selected={selectedItem?.id === item.id}
                  onSelect={() => setSelectedId(item.id)}
                  key={item.id}
                />
              ))}
            </div>
          )}
        </section>

        <section className="panel capability-detail-panel">
          <div className="panel-header capability-section-header">
            <div>
              <span className="eyebrow">Inspector</span>
              <h2>Selected capability</h2>
              <p>Purpose, type, and source signals.</p>
            </div>
          </div>
          <CapabilityDetail item={selectedItem} />
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
