import type Database from 'better-sqlite3';
import { app, dialog, protocol, net } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// ponytail: photos live at %APPDATA%/jewelzz/photos/<uuid>.<ext>.
// DB stores only the basename; renderer loads via photo:// custom protocol.

export function photosDir(): string {
  const dir = path.join(app.getPath('userData'), 'photos');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Register once on app.whenReady(). Handles photo://<filename> → file on disk.
export function registerPhotoProtocol(): void {
  protocol.handle('photo', (req) => {
    const url = new URL(req.url);
    // photo://x/foo.jpg  → hostname='x', pathname='/foo.jpg'
    // photo://foo.jpg    → hostname='foo.jpg', pathname='/'
    const raw = decodeURIComponent(url.hostname + url.pathname).replace(/^\/+/, '');
    const filename = path.basename(raw); // strip any traversal attempt
    const file = path.join(photosDir(), filename);
    return net.fetch(pathToFileURL(file).toString());
  });
}

// ── ADD (opens native file picker, copies chosen files) ────────────────
export async function addPhotos(db: Database.Database, itemId: number): Promise<{ added: number }> {
  const item = db.prepare('SELECT id FROM items WHERE id = ?').get(itemId);
  if (!item) throw new Error(`item ${itemId} not found`);

  const res = await dialog.showOpenDialog({
    title: 'Choose photo(s)',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }],
  });
  if (res.canceled || res.filePaths.length === 0) return { added: 0 };

  const dir = photosDir();
  const insert = db.prepare(
    `INSERT INTO item_photos (item_id, filename, position) VALUES (?, ?, ?)`,
  );
  const nextPos = (db.prepare(
    `SELECT COALESCE(MAX(position), -1) + 1 AS n FROM item_photos WHERE item_id = ?`,
  ).get(itemId) as { n: number }).n;

  db.transaction(() => {
    let pos = nextPos;
    for (const src of res.filePaths) {
      const ext = path.extname(src).toLowerCase() || '.jpg';
      const filename = `${randomUUID()}${ext}`;
      fs.copyFileSync(src, path.join(dir, filename));
      insert.run(itemId, filename, pos++);
    }
  })();

  return { added: res.filePaths.length };
}

// ── LIST for an item, or grid view of all items with primary photo ─────
export function listItemPhotos(db: Database.Database, itemId: number): any[] {
  return db.prepare(
    `SELECT id, filename, caption, position, created_at as createdAt
     FROM item_photos WHERE item_id = ? ORDER BY position, id`,
  ).all(itemId);
}

export function deletePhoto(db: Database.Database, id: number): { ok: boolean } {
  const row = db.prepare('SELECT filename FROM item_photos WHERE id = ?').get(id) as { filename: string } | undefined;
  if (!row) return { ok: false };
  db.prepare('DELETE FROM item_photos WHERE id = ?').run(id);
  try { fs.unlinkSync(path.join(photosDir(), row.filename)); } catch { /* file may already be gone */ }
  return { ok: true };
}

export function setPrimaryPhoto(db: Database.Database, id: number): { ok: boolean } {
  const row = db.prepare('SELECT item_id FROM item_photos WHERE id = ?').get(id) as { item_id: number } | undefined;
  if (!row) return { ok: false };
  db.transaction(() => {
    // shift others +1 then set this to 0 — simplest correct approach
    db.prepare(
      `UPDATE item_photos SET position = position + 1 WHERE item_id = ? AND id != ?`,
    ).run(row.item_id, id);
    db.prepare(`UPDATE item_photos SET position = 0 WHERE id = ?`).run(id);
  })();
  return { ok: true };
}

// Catalog grid — one item per row, primary photo filename (if any), tags, collections.
export function catalogGrid(db: Database.Database, opts: { q?: string; collectionId?: number } = {}): any[] {
  const clauses: string[] = [];
  const args: any[] = [];
  if (opts.q && opts.q.trim()) {
    clauses.push('(i.name LIKE ? OR i.sku LIKE ? OR i.tags LIKE ?)');
    const like = `%${opts.q.trim()}%`;
    args.push(like, like, like);
  }
  if (opts.collectionId) {
    clauses.push('EXISTS (SELECT 1 FROM item_collections ic WHERE ic.item_id = i.id AND ic.collection_id = ?)');
    args.push(opts.collectionId);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(
    `SELECT i.id, i.sku, i.name, i.category, i.stamp, i.unit, i.tags,
            i.stock_qty as stockQty, i.stock_wt_mg as stockWtMg,
            (SELECT filename FROM item_photos WHERE item_id = i.id ORDER BY position, id LIMIT 1) AS primaryPhoto,
            (SELECT COUNT(*) FROM item_photos WHERE item_id = i.id) AS photoCount,
            (SELECT GROUP_CONCAT(c.name, ', ') FROM collections c
             JOIN item_collections ic ON ic.collection_id = c.id WHERE ic.item_id = i.id) AS collectionNames
     FROM items i
     ${where}
     ORDER BY i.name`,
  ).all(...args);
}
