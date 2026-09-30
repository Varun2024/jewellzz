import type { IpcMain } from 'electron';
import { z } from 'zod';
import { getDb } from '../db';
import {
  addPhotos, listItemPhotos, deletePhoto, setPrimaryPhoto, catalogGrid,
} from '../photos';
import { printLabels } from '../labels';
import { CH } from '../../shared/ipc';
import { on, audit } from './_shared';

export function register(ipc: IpcMain): void {
  // ── photos
  on(ipc, CH.photosList, z.object({ itemId: z.number().int() }), ({ itemId }) =>
    listItemPhotos(getDb(), itemId),
  );
  on(ipc, CH.photosAdd, z.object({ itemId: z.number().int() }), async ({ itemId }) => {
    const r = await addPhotos(getDb(), itemId);
    audit('item_photo', itemId, 'add', null, r);
    return r;
  });
  on(ipc, CH.photosDelete, z.object({ id: z.number().int() }), ({ id }) => {
    const r = deletePhoto(getDb(), id);
    audit('item_photo', id, 'delete', null, r);
    return r;
  });
  on(ipc, CH.photosSetPrimary, z.object({ id: z.number().int() }), ({ id }) =>
    setPrimaryPhoto(getDb(), id),
  );

  on(ipc, CH.catalogGrid, z.object({
    q: z.string().optional(),
    collectionId: z.number().int().optional(),
  }).default({}), (opts) => catalogGrid(getDb(), opts));

  // ── collections
  on(ipc, CH.collectionsList, null, () =>
    getDb().prepare(
      `SELECT c.id, c.name, c.description, c.created_at as createdAt,
              (SELECT COUNT(*) FROM item_collections WHERE collection_id = c.id) AS itemCount
       FROM collections c ORDER BY c.name`,
    ).all(),
  );
  on(ipc, CH.collectionsCreate, z.object({ name: z.string().min(1).max(80), description: z.string().default('') }), (p) => {
    const row = getDb().prepare(
      `INSERT INTO collections (name, description) VALUES (?, ?) RETURNING *`,
    ).get(p.name.trim(), p.description);
    audit('collection', (row as any).id, 'create', null, row);
    return row;
  });
  on(ipc, CH.collectionsDelete, z.object({ id: z.number().int() }), ({ id }) => {
    getDb().prepare('DELETE FROM collections WHERE id = ?').run(id);
    audit('collection', id, 'delete', null, null);
    return { ok: true };
  });

  on(ipc, CH.itemCollectionsGet, z.object({ itemId: z.number().int() }), ({ itemId }) =>
    getDb().prepare(
      `SELECT c.id, c.name FROM collections c
       JOIN item_collections ic ON ic.collection_id = c.id WHERE ic.item_id = ? ORDER BY c.name`,
    ).all(itemId),
  );
  on(ipc, CH.itemCollectionsSet, z.object({ itemId: z.number().int(), collectionIds: z.array(z.number().int()) }), ({ itemId, collectionIds }) => {
    const db = getDb();
    db.transaction(() => {
      db.prepare('DELETE FROM item_collections WHERE item_id = ?').run(itemId);
      const insert = db.prepare('INSERT INTO item_collections (item_id, collection_id) VALUES (?, ?)');
      for (const cid of collectionIds) insert.run(itemId, cid);
    })();
    audit('item_collections', itemId, 'set', null, { collectionIds });
    return { ok: true };
  });

  on(ipc, CH.itemTagsSet, z.object({ itemId: z.number().int(), tags: z.string().max(500) }), ({ itemId, tags }) => {
    getDb().prepare('UPDATE items SET tags = ?, updated_at = unixepoch() WHERE id = ?').run(tags.trim(), itemId);
    audit('item', itemId, 'tags', null, { tags });
    return { ok: true };
  });

  on(ipc, CH.labelsPrint, z.object({
    itemIds: z.array(z.number().int()).min(1),
    copies: z.number().int().min(1).max(50).default(1),
  }), async (p) => printLabels(getDb(), p));
}
