import { Badge } from 'reactstrap';
import { AlertTriangle, ClipboardCheck, FileCheck2, Route, ShieldCheck, TestTube2 } from 'lucide-react';
import { Detail } from '../components/Detail.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { InlineError } from '../components/InlineError.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { useReleaseHealth } from '../hooks/useReleaseHealth.js';
import { formatCompact, formatDate } from '../utils/format.js';

function toneForStatus(status) {
  if (status === 'configured') return 'success';
  if (status === 'missing') return 'warning';
  return 'secondary';
}

function getReadinessStatus(readiness) {
  const tone = readiness === 'ready' ? 'ok' : readiness === 'blocked' ? 'warn' : 'idle';
  return { label: readiness || 'unknown', tone };
}

function CheckCard({ check }) {
  return (
    <article className="release-check-card">
      <div>
        <strong>{check.label}</strong>
        <span>{check.scope}</span>
      </div>
      <Badge color={toneForStatus(check.status)}>{check.status}</Badge>
      <code>{check.command}</code>
      <small>{check.detail}</small>
    </article>
  );
}

function TestSetupPanel({ title, setup }) {
  const runners = setup?.runners?.length ? setup.runners.join(', ') : 'none';
  const files = setup?.testFiles || [];

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{setup?.configured ? 'Runner detected' : 'Runner missing'}</p>
        </div>
        <TestTube2 size={18} aria-hidden="true" />
      </div>
      <div className="detail-list">
        <Detail label="Test script" value={setup?.script} />
        <Detail label="Runners" value={runners} />
        <Detail label="Test files" value={formatCompact(setup?.testFileCount || 0)} />
      </div>
      {files.length === 0 ? (
        <EmptyState title="No test files" description="No *.test or *.spec files were found in this project area." />
      ) : (
        <div className="compact-list">
          {files.slice(0, 8).map((file) => (
            <div className="compact-row" key={file}>
              <strong>{file}</strong>
              <span>tracked</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SourceGrid({ source }) {
  const rows = Object.values(source || {});

  return (
    <div className="source-grid">
      {rows.map((item) => (
        <div key={item.path || item.label || item.name}>
          <span>{item.label || item.name}</span>
          <strong>{item.path}</strong>
          <small>{item.exists ? `available / ${formatDate(item.modifiedAt)}` : 'missing'}</small>
        </div>
      ))}
    </div>
  );
}

export default function ReleasePage() {
  const { data, loading, error } = useReleaseHealth();
  const release = data?.release || {};
  const testCoverage = data?.testCoverage || {};
  const checks = data?.checks || [];
  const gaps = testCoverage.gaps || [];

  return (
    <div className="page-grid release-page">
      <PageHeader
        title="Release"
        subtitle={loading ? 'Loading release health...' : `Refreshed ${formatDate(data?.refreshedAt)}`}
        status={getReadinessStatus(release.readiness)}
      />
      <InlineError title="Release health error" message={error} />

      <section className="stat-grid">
        <StatCard label="Readiness Score" value={`${release.score || 0}/100`} icon={ShieldCheck} />
        <StatCard label="Checks" value={formatCompact(checks.length)} icon={ClipboardCheck} />
        <StatCard label="Test Files" value={formatCompact(testCoverage.totals?.testFiles || 0)} icon={TestTube2} />
        <StatCard label="Smoke Endpoints" value={formatCompact(data?.smoke?.endpointCount || 0)} icon={Route} />
      </section>

      <section className="panel wide">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Verification</span>
            <h2>Release checks</h2>
          </div>
          <Badge color="light">{checks.filter((check) => check.status === 'configured').length} configured</Badge>
        </div>
        <div className="release-check-grid">
          {checks.map((check) => (
            <CheckCard check={check} key={check.id} />
          ))}
        </div>
      </section>

      <TestSetupPanel title="Backend Tests" setup={testCoverage.backend} />
      <TestSetupPanel title="Frontend Tests" setup={testCoverage.frontend} />

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Coverage Gaps</h2>
            <p>Items that should become real tests before production hardening.</p>
          </div>
          <AlertTriangle size={18} aria-hidden="true" />
        </div>
        {gaps.length === 0 ? (
          <EmptyState title="No gaps reported" description="Configured checks did not report any current release gaps." />
        ) : (
          <div className="compact-list">
            {gaps.map((gap) => (
              <div className="compact-row" key={gap}>
                <strong>{gap}</strong>
                <span>gap</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Smoke Coverage</h2>
            <p>API endpoints asserted by the backend smoke script.</p>
          </div>
          <FileCheck2 size={18} aria-hidden="true" />
        </div>
        <div className="chips">
          {(data?.smoke?.endpoints || []).map((endpoint) => (
            <span className="chip" key={endpoint}>{endpoint}</span>
          ))}
        </div>
      </section>

      <section className="panel wide">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Sources</span>
            <h2>Release health inputs</h2>
          </div>
          <ClipboardCheck size={18} aria-hidden="true" />
        </div>
        <SourceGrid source={data?.source} />
      </section>
    </div>
  );
}
