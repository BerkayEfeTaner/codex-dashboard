export function PageHeader({ title, subtitle, action, status }) {
  return (
    <div className="page-header">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="page-header-actions">
        {status ? <span className={`status ${status.tone || 'ok'}`}>{status.label}</span> : null}
        {action}
      </div>
    </div>
  );
}
