import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { runMigrations, seedIfEmpty } from '../db/migrator';
import { ensureOwner } from './auth';

let db: Database.Database | null = null;

export function dbPath(): string {
  const dir = app.getPath('userData');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'jewelzz.db');
}

export function openDb(): Database.Database {
  if (db) return db;
  db = new Database(dbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  runMigrations(db);
  seedIfEmpty(db);
  ensureOwner(db);
  return db;
}

export function getDb(): Database.Database {
  if (!db) throw new Error('DB not open');
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
