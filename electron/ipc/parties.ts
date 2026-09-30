import type { IpcMain } from 'electron';
import { z } from 'zod';
import { getDb } from '../db';
import { CH, PartyInput, type Party } from '../../shared/ipc';
import { camelize } from '../mappers';
import { on, audit } from './_shared';

export function register(ipc: IpcMain): void {
  on(ipc, CH.partiesList, null, () =>
    getDb().prepare('SELECT * FROM parties ORDER BY name').all().map((r) => camelize<Party>(r)),
  );

  on(ipc, CH.partiesCreate, PartyInput, (p) => {
    const row = getDb()
      .prepare(
        `INSERT INTO parties (name, role, gstin, phone, address, state_code, opening_cash, opening_metal_mg)
         VALUES (@name, @role, @gstin, @phone, @address, @stateCode, @openingCash, @openingMetalMg)
         RETURNING *`,
      )
      .get({ ...p, gstin: p.gstin ?? null, phone: p.phone ?? null });
    const out = camelize<Party>(row);
    audit('party', out.id, 'insert', null, out);
    return out;
  });

  on(
    ipc,
    CH.partiesUpdate,
    PartyInput.extend({ id: z.number().int() }),
    (p) => {
      const db = getDb();
      const before = db.prepare('SELECT * FROM parties WHERE id = ?').get(p.id);
      if (!before) throw new Error(`party ${p.id} not found`);
      const row = db
        .prepare(
          `UPDATE parties SET
             name=@name, role=@role, gstin=@gstin, phone=@phone,
             address=@address, state_code=@stateCode,
             opening_cash=@openingCash, opening_metal_mg=@openingMetalMg,
             updated_at=unixepoch()
           WHERE id=@id RETURNING *`,
        )
        .get({ ...p, gstin: p.gstin ?? null, phone: p.phone ?? null });
      audit('party', p.id, 'update', before, row);
      return camelize<Party>(row);
    },
  );

  on(ipc, CH.partiesDelete, z.object({ id: z.number().int() }), ({ id }) => {
    const db = getDb();
    const before = db.prepare('SELECT * FROM parties WHERE id = ?').get(id);
    if (!before) return { ok: false };
    db.prepare('DELETE FROM parties WHERE id = ?').run(id);
    audit('party', id, 'delete', before, null);
    return { ok: true };
  });
}
