import { useMemo, useState } from 'react';
import { Badge, Button } from 'reactstrap';
import { EmptyState } from '../components/EmptyState.jsx';
import { InlineError } from '../components/InlineError.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { useDatabases } from '../hooks/useDatabases.js';
import { useDatabaseTable } from '../hooks/useDatabaseTable.js';
import { formatBytes, formatDate } from '../utils/format.js';

export default function DatabasesPage() {
  const tableLimit = 25;
  const [selected, setSelected] = useState(null);
  const [tableOffset, setTableOffset] = useState(0);
  const { data: databases = [], loading, error } = useDatabases();
  const firstTable = useMemo(() => {
    const database = databases.find((db) => db.tables?.length > 0);
    const table = database?.tables?.[0];
    return database && table ? { database: database.name, table: table.name } : null;
  }, [databases]);
  const activeSelection = selected || firstTable;
  const tableState = useDatabaseTable(activeSelection?.database, activeSelection?.table, { limit: tableLimit, offset: tableOffset });
  const tableDetail = tableState.data;
  const visibleColumns = (tableDetail?.columns || []).slice(0, 6);
  const rowCount = tableDetail?.rowCount || 0;
  const pageStart = rowCount === 0 ? 0 : tableOffset + 1;
  const pageEnd = Math.min(tableOffset + tableLimit, rowCount);
  const hasNextPage = tableOffset + tableLimit < rowCount;

  return (
    <div className="page-grid database-layout">
      <section className="panel database-list-panel">
        <PageHeader title="Databases" subtitle={loading ? 'Loading databases...' : `${databases.length} local SQLite sources`} />
        <InlineError message={error} />
        {databases.length === 0 ? (
          <EmptyState title="No databases found" description="No Codex dashboard databases were discovered." />
        ) : (
          <div className="database-grid">
            {databases.map((db) => (
              <article className="database-card" key={db.name}>
                <div className="panel-header">
                  <div>
                    <h3>{db.name}</h3>
                    <p>{db.exists ? `${formatBytes(db.size)} / ${formatDate(db.modifiedAt)}` : 'Missing'}</p>
                  </div>
                  <Badge className={db.exists ? 'status ok' : 'status warn'} pill>
                    {db.exists ? 'online' : 'missing'}
                  </Badge>
                </div>
                <div className="compact-list">
                  {(db.tables || []).slice(0, 8).map((table) => {
                    const isSelected = activeSelection?.database === db.name && activeSelection?.table === table.name;
                    return (
                      <button
                        className={`compact-row table-select-row ${isSelected ? 'selected' : ''}`}
                        key={table.name}
                        type="button"
                        onClick={() => {
                          setSelected({ database: db.name, table: table.name });
                          setTableOffset(0);
                        }}
                      >
                        <strong>{table.name}</strong>
                        <span>{table.count ?? '-'} rows / {table.columns.length} columns</span>
                      </button>
                    );
                  })}
                  {db.error && <div className="compact-row"><strong>Error</strong><span>{db.error}</span></div>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel table-detail-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Table preview</span>
            <h2>{activeSelection?.table || 'No table selected'}</h2>
            {activeSelection?.database && <p>{activeSelection.database}</p>}
          </div>
          {tableDetail?.rowCount != null && <Badge color="light">{tableDetail.rowCount} rows</Badge>}
        </div>
        <InlineError message={tableState.error} />
        {!activeSelection ? (
          <EmptyState title="No table available" description="A readable database table is required for preview." />
        ) : (
          <div className="data-preview">
            <div className="data-preview-header">
              {visibleColumns.map((column) => <strong key={column.name}>{column.name}</strong>)}
            </div>
            {(tableDetail?.rows || []).slice(0, 12).map((row, index) => (
              <div className="data-preview-row" key={`${activeSelection.database}-${activeSelection.table}-${index}`}>
                {visibleColumns.map((column) => (
                  <span key={column.name}>{String(row[column.name] ?? '')}</span>
                ))}
              </div>
            ))}
            {(tableDetail?.rows || []).length === 0 && (
              <EmptyState title={tableState.loading ? 'Loading rows' : 'No rows'} description="This table has no rows in the current page." />
            )}
          </div>
        )}
        <div className="pager-actions">
          <Button
            color="light"
            disabled={tableState.loading || tableOffset === 0}
            onClick={() => setTableOffset(Math.max(0, tableOffset - tableLimit))}
          >
            Previous
          </Button>
          <span>{pageStart}-{pageEnd} / {rowCount}</span>
          <Button
            color="light"
            disabled={tableState.loading || !hasNextPage}
            onClick={() => setTableOffset(tableOffset + tableLimit)}
          >
            Next
          </Button>
        </div>
      </section>
    </div>
  );
}
