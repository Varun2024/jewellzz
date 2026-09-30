import type { IpcMain } from 'electron';
import { z } from 'zod';
import { getDb } from '../db';
import { currentActor } from '../auth';
import { CH, ItemInput, StockAdjustInput, type Item } from '../../shared/ipc';
import { camelize } from '../mappers';
import { on, audit } from './_shared';

export function register(ipc: IpcMain): void {
  on(ipc, CH.itemsList, null, () =>
    getDb().prepare('SELECT * FROM items ORDER BY name').all().map((r) => camelize<Item>(r)),
  );

  on(ipc, CH.itemsCreate, ItemInput, (p) => {
    const row = getDb()
      .prepare(
        `INSERT INTO items (sku, name, category, unit, stamp, hsn, gst_bp,
                            labour_mode, labour_value, wastage_mode, wastage_value,
                            stock_qty, stock_wt_mg)
         VALUES (@sku, @name, @category, @unit, @stamp, @hsn, @gstBp,
                 @labourMode, @labourValue, @wastageMode, @wastageValue,
                 @stockQty, @stockWtMg)
         RETURNING *`,
      )
      .get({ ...p, stamp: p.stamp ?? null });
    const out = camelize<Item>(row);
    audit('item', out.id, 'insert', null, out);
    return out;
  });

  on(
    ipc,
    CH.itemsUpdate,
    ItemInput.innerType().extend({ id: z.number().int() }),
    (p) => {
      const db = getDb();
      const before = db.prepare('SELECT * FROM items WHERE id = ?').get(p.id);
      if (!before) throw new Error(`item ${p.id} not found`);
      const row = db
        .prepare(
          `UPDATE items SET
             sku=@sku, name=@name, category=@category, unit=@unit, stamp=@stamp, hsn=@hsn,
             gst_bp=@gstBp,
             labour_mode=@labourMode, labour_value=@labourValue,
             wastage_mode=@wastageMode, wastage_value=@wastageValue,
             stock_qty=@stockQty, stock_wt_mg=@stockWtMg,
             updated_at=unixepoch()
           WHERE id=@id RETURNING *`,
        )
        .get({ ...p, stamp: p.stamp ?? null });
      audit('item', p.id, 'update', before, row);
      return camelize<Item>(row);
    },
  );

  on(ipc, CH.itemsDelete, z.object({ id: z.number().int() }), ({ id }) => {
    const db = getDb();
    const before = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    if (!before) return { ok: false };
    db.prepare('DELETE FROM items WHERE id = ?').run(id);
    audit('item', id, 'delete', before, null);
    return { ok: true };
  });

  on(ipc, CH.stockAdjust, StockAdjustInput, (p) => {
    const db = getDb();
    return db.transaction(() => {
      const before = db.prepare('SELECT * FROM items WHERE id = ?').get(p.itemId);
      if (!before) throw new Error(`item ${p.itemId} not found`);
      db.prepare(
        `INSERT INTO stock_adjustments (item_id, delta_qty, delta_wt_mg, reason, actor)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(p.itemId, p.deltaQty, p.deltaWtMg, p.reason, currentActor());
      db.prepare(
        `UPDATE items SET stock_qty = stock_qty + ?, stock_wt_mg = stock_wt_mg + ?, updated_at = unixepoch()
         WHERE id = ?`,
      ).run(p.deltaQty, p.deltaWtMg, p.itemId);
      const after = db.prepare('SELECT * FROM items WHERE id = ?').get(p.itemId);
      audit('item', p.itemId, 'stock_adjust', before, after);
      return camelize<Item>(after);
    })();
  });

  on(ipc, CH.stockAdjustments, z.object({ itemId: z.number().int() }), ({ itemId }) => {
    return getDb()
      .prepare(
        `SELECT id, ts, delta_qty as deltaQty, delta_wt_mg as deltaWtMg, reason, actor
         FROM stock_adjustments WHERE item_id = ? ORDER BY ts DESC LIMIT 100`,
      )
      .all(itemId);
  });
}
