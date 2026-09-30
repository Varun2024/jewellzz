import type { IpcMain } from 'electron';
import { getDb } from '../db';
import { CH, SearchInput, type SearchHit } from '../../shared/ipc';
import { on, toFtsQuery } from './_shared';

export function register(ipc: IpcMain): void {
  on(ipc, CH.search, SearchInput, ({ q, scope, limit }): SearchHit[] => {
    const db = getDb();
    const query = toFtsQuery(q);
    const hits: SearchHit[] = [];

    if (scope === 'all' || scope === 'items') {
      const rows = db
        .prepare(
          `SELECT i.id, i.name, i.sku, i.category, i.stamp
           FROM items_fts f JOIN items i ON i.id = f.rowid
           WHERE items_fts MATCH ? ORDER BY rank LIMIT ?`,
        )
        .all(query, limit) as any[];
      for (const r of rows) hits.push({ kind: 'item', id: r.id, name: r.name, sku: r.sku, category: r.category, stamp: r.stamp });
    }

    if (scope === 'all' || scope === 'parties') {
      const rows = db
        .prepare(
          `SELECT p.id, p.name, p.role, p.phone
           FROM parties_fts f JOIN parties p ON p.id = f.rowid
           WHERE parties_fts MATCH ? ORDER BY rank LIMIT ?`,
        )
        .all(query, limit) as any[];
      for (const r of rows) hits.push({ kind: 'party', id: r.id, name: r.name, role: r.role, phone: r.phone });
    }

    return hits;
  });
}
