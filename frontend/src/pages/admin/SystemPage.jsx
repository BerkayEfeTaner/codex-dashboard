import { useState } from 'react';
import { Button } from 'reactstrap';
import { Cpu, Download, FileJson } from 'lucide-react';
import { fetchDiagnosticReport } from '../../api/client.js';
import { Detail } from '../../components/ui/Detail.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { InlineError } from '../../components/ui/InlineError.jsx';
import { formatBytes, formatDate } from '../../utils/format.js';

export default function SystemPage({ summary }) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const sourceFiles = summary?.system?.sourceFiles || [];
  const dataSources = sourceFiles;

  async function handleExportReport() {
    setIsExporting(true);
    setExportError('');

    try {
      const report = await fetchDiagnosticReport();
      const generatedAt = report.report?.generatedAt || new Date().toISOString();
      const safeTimestamp = generatedAt.slice(0, 19).replace(/[:T]/g, '-');
      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `codex-diagnostic-report-${safeTimestamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error.message);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="page-grid two-col">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>System</h2>
            <p>{summary?.system?.codexHome || '-'}</p>
          </div>
          <Cpu size={22} aria-hidden="true" />
        </div>
        <div className="detail-list">
          <Detail label="Node" value={summary?.system?.node} />
          <Detail label="Platform" value={summary?.system?.platform} />
          <Detail label="Model" value={summary?.system?.activeModel} />
          <Detail label="Approval" value={summary?.system?.activeApprovalMode} />
        </div>
      </section>

      <section className="panel diagnostic-report-panel">
        <div className="panel-header">
          <div>
            <h2>Diagnostic Report</h2>
            <p>Export a capped read-only JSON package for support, audits, and release checks.</p>
          </div>
          <FileJson size={22} aria-hidden="true" />
        </div>
        <div className="detail-list">
          <Detail label="Format" value="JSON v1" />
          <Detail label="Scope" value="Health, config, inventory, activity, sources, risks" />
          <Detail label="Mutation" value="Read-only" />
        </div>
        {exportError ? <InlineError title="Report export failed" message={exportError} /> : null}
        <div className="diagnostic-actions">
          <Button color="primary" type="button" onClick={handleExportReport} disabled={isExporting}>
            <span className="button-content">
              <Download size={16} aria-hidden="true" />
              {isExporting ? 'Exporting...' : 'Export JSON'}
            </span>
          </Button>
        </div>
      </section>

      <section className="panel">
        <h2>Data Sources</h2>
        <div className="compact-list">
          {dataSources.length === 0 ? (
            <EmptyState title="No data sources" description="No configured source files were reported." />
          ) : (
            dataSources.map((file) => (
              <div className="compact-row" key={file.name}>
                <strong>{file.name}</strong>
                <span>{file.exists ? `${formatBytes(file.size)} / ${formatDate(file.modifiedAt)}` : 'missing'}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
