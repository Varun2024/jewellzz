import type { IpcMain } from 'electron';
import { z } from 'zod';
import { getDb } from '../db';
import { CH } from '../../shared/ipc';
import { on } from './_shared';

export function register(ipc: IpcMain): void {
  on(ipc, CH.companyGet, null, () =>
    getDb().prepare('SELECT * FROM companies ORDER BY id LIMIT 1').get(),
  );

  on(
    ipc,
    CH.companyUpdate,
    z.object({
      name: z.string().min(1),
      gstin: z.string().min(1),
      address: z.string().default(''),
      stateCode: z.string().default(''),
      phone: z.string().default(''),
    }),
    (c) => {
      const db = getDb();
      const existing = db.prepare('SELECT id FROM companies ORDER BY id LIMIT 1').get() as { id: number } | undefined;
      if (existing) {
        db.prepare(
          `UPDATE companies SET name=?, gstin=?, address=?, state_code=?, phone=?, updated_at=unixepoch() WHERE id=?`,
        ).run(c.name, c.gstin, c.address, c.stateCode, c.phone, existing.id);
        return { ok: true, id: existing.id };
      }
      const row = db.prepare(
        `INSERT INTO companies (name, gstin, address, state_code, phone) VALUES (?, ?, ?, ?, ?) RETURNING id`,
      ).get(c.name, c.gstin, c.address, c.stateCode, c.phone) as { id: number };
      return { ok: true, id: row.id };
    },
  );
}
