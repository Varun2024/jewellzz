import type { IpcMain } from 'electron';
import { z } from 'zod';
import { getDb } from '../db';
import { currentActor } from '../auth';
import { CH, MetalRateInput, type MetalRate } from '../../shared/ipc';
import { camelize } from '../mappers';
import { on, audit } from './_shared';

export function register(ipc: IpcMain): void {
  on(ipc, CH.ratesList, null, () =>
    getDb().prepare(`SELECT * FROM metal_rates ORDER BY category, stamp`).all().map((r) => camelize<MetalRate>(r)),
  );

  on(ipc, CH.ratesUpsert, MetalRateInput, (p) => {
    const db = getDb();
    const actor = currentActor();
    const existing = db.prepare(`SELECT * FROM metal_rates WHERE category = ? AND stamp = ?`).get(p.category, p.stamp);
    const row = db.prepare(
      `INSERT INTO metal_rates (category, stamp, rate_paise_per_g, updated_at, updated_by)
       VALUES (@category, @stamp, @ratePaisePerG, unixepoch(), @actor)
       ON CONFLICT(category, stamp) DO UPDATE SET
         rate_paise_per_g = excluded.rate_paise_per_g,
         updated_at = unixepoch(),
         updated_by = excluded.updated_by
       RETURNING *`,
    ).get({ ...p, actor });
    const out = camelize<MetalRate>(row);
    audit('metal_rate', out.id, existing ? 'update' : 'insert', existing, out);
    return out;
  });

  on(ipc, CH.ratesDelete, z.object({ id: z.number().int() }), ({ id }) => {
    const db = getDb();
    const before = db.prepare('SELECT * FROM metal_rates WHERE id = ?').get(id);
    if (!before) return { ok: false };
    db.prepare('DELETE FROM metal_rates WHERE id = ?').run(id);
    audit('metal_rate', id, 'delete', before, null);
    return { ok: true };
  });
}
