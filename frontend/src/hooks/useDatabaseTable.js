import { useCallback } from 'react';
import { fetchDatabaseTable } from '../api/client.js';
import { useEndpoint } from './useEndpoint.js';

const emptyTable = {
  database: '',
  table: '',
  columns: [],
  rowCount: 0,
  rows: [],
  limit: 25,
  offset: 0,
  source: null,
  refreshedAt: null
};

export function useDatabaseTable(name, table, options) {
  const limit = options?.limit ?? 25;
  const offset = options?.offset ?? 0;

  const fetcher = useCallback(() => {
    if (!name || !table) return Promise.resolve(emptyTable);
    return fetchDatabaseTable(name, table, { limit, offset });
  }, [name, table, limit, offset]);

  return useEndpoint(fetcher, emptyTable);
}
