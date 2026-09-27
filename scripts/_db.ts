import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Same path Electron uses for userData on Windows: %APPDATA%\jewelzz
// On other platforms, standard app-data locations.
export function cliDbPath(): string {
  const appName = 'jewelzz';
  const dir =
    process.platform === 'win32'
      ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), appName)
      : process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library', 'Application Support', appName)
        : path.join(os.homedir(), '.config', appName);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'jewelzz.db');
}

export function openCliDb(): Database.Database {
  const db = new Database(cliDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}
