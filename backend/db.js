const Database = require('better-sqlite3');
const path = require('path');
const { CODEX_DIR } = require('./constants');
const { canReadPath } = require('./utils');

function checkSqliteAvailability(fileName) {
  const filePath = path.join(CODEX_DIR, fileName);
  const exists = require('fs').existsSync(filePath);
  
  if (!exists) {
    return { name: fileName, path: filePath, exists: false, available: false, error: 'missing' };
  }

  const readable = canReadPath(filePath);
  const stat = require('fs').statSync(filePath);
  const fileInfo = {
    name: fileName,
    path: filePath,
    exists: true,
    readable,
    size: stat.size,
    modifiedAt: stat.mtime.toISOString()
  };

  if (!readable) {
    return { ...fileInfo, available: false, error: 'unreadable' };
  }

  try {
    const db = new Database(filePath, { readonly: true, fileMustExist: true });
    db.prepare('SELECT name FROM sqlite_master LIMIT 1').get();
    db.close();
    return { ...fileInfo, available: true, error: null };
  } catch (error) {
    return { ...fileInfo, available: false, error: error.message };
  }
}

function openReadonlyDatabase(fileName) {
  const filePath = path.join(CODEX_DIR, fileName);
  if (!require('fs').existsSync(filePath)) return null;
  try {
    return new Database(filePath, { readonly: true, fileMustExist: true });
  } catch {
    return null;
  }
}

module.exports = {
  checkSqliteAvailability,
  openReadonlyDatabase
};
