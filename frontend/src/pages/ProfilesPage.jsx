import { useEffect, useState } from 'react';
import { Badge, Input } from 'reactstrap';
import { previewConfigChange } from '../api/client.js';
import { EmptyState } from '../components/EmptyState.jsx';
import { InlineError } from '../components/InlineError.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { useProfiles } from '../hooks/useProfiles.js';

function ConfigPreview({ preview, error }) {
  if (error) {
    return <InlineError title="Preview unavailable" message={error} />;
  }

  if (!preview) {
    return <EmptyState title="No preview" description="Select a profile to build a config preview." />;
  }

  const checks = preview.validation?.checks || [];
  const changes = preview.changes || [];

  return (
    <div className="config-preview">
      <div className="config-preview-summary">
        <div>
          <span>Current</span>
          <strong>{preview.current?.activeProfileId || '-'}</strong>
        </div>
        <div>
          <span>Proposed</span>
          <strong>{preview.proposed?.activeProfileId || '-'}</strong>
        </div>
        <div>
          <span>Apply</span>
          <strong>{preview.apply?.available ? 'Available' : 'Blocked'}</strong>
        </div>
      </div>

      <div className="config-checks">
        {checks.map((check) => (
          <Badge color={check.ok ? 'success' : 'danger'} key={check.id}>
            {check.label}
          </Badge>
        ))}
      </div>

      {changes.length === 0 ? (
        <EmptyState title="No changes" description="The selected draft matches the current config." />
      ) : (
        <div className="detail-list">
          {changes.map((change) => (
            <div key={change.type}>
              <span>{change.label}</span>
              <strong>
                {change.before || '-'}
                {' -> '}
                {change.after || '-'}
              </strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProfilesPage() {
  const { data, loading, error } = useProfiles();
  const profiles = data?.profiles || [];
  const activeProfileId = data?.activeProfile?.id || null;
  const [draftActiveProfileId, setDraftActiveProfileId] = useState('');
  const selectedProfileId = draftActiveProfileId || activeProfileId || profiles[0]?.id || '';
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      if (!selectedProfileId) return;
      setPreviewError('');

      try {
        const payload = await previewConfigChange({ activeProfileId: selectedProfileId });
        if (!cancelled) setPreview(payload);
      } catch (err) {
        if (!cancelled) setPreviewError(err.message);
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [selectedProfileId]);

  return (
    <div className="page-grid profiles-page">
      <PageHeader
        title="Profiles"
        subtitle={loading ? 'Loading profile config' : `${profiles.length} configured profiles`}
        status={data?.source?.readable ? { label: 'Config readable', tone: 'ok' } : { label: 'Config unavailable', tone: 'warn' }}
      />
      <InlineError title="Profiles unavailable" message={error} />

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Configured</span>
            <h2>Profiles</h2>
          </div>
          <Badge color="light">{profiles.length}</Badge>
        </div>
        {profiles.length === 0 ? (
          <EmptyState title="No profiles found" description="No Codex profiles were found in the active config." />
        ) : (
          <div className="table-list">
            {profiles.map((profile) => (
              <article className="table-row" key={profile.id}>
                <strong>{profile.name}{profile.id === activeProfileId ? ' (active)' : ''}</strong>
                <span>{profile.model}</span>
                <span>{profile.reasoningEffort}</span>
                <span>{profile.approvalMode}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Preview</span>
            <h2>Active profile draft</h2>
          </div>
          <Badge color="warning">No apply</Badge>
        </div>
        <div className="config-control">
          <label htmlFor="active-profile-preview">Active profile</label>
          <Input
            id="active-profile-preview"
            type="select"
            value={selectedProfileId}
            onChange={(event) => setDraftActiveProfileId(event.target.value)}
          >
            {profiles.map((profile) => (
              <option value={profile.id} key={profile.id}>{profile.name}</option>
            ))}
          </Input>
        </div>
        <ConfigPreview preview={preview} error={previewError} />
      </section>
    </div>
  );
}
