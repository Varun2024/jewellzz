import type { IpcMain } from 'electron';
import { z } from 'zod';
import { getDb } from '../db';
import {
  postKarigarIssue, postKarigarReceipt, payKarigar,
  listKarigarBalances, readKarigarLedger,
} from '../karigar';
import {
  CH,
  KarigarInput, KarigarIssueInput, KarigarReceiptInput, KarigarPayInput,
  type Karigar,
} from '../../shared/ipc';
import { camelize } from '../mappers';
import { on, audit } from './_shared';

export function register(ipc: IpcMain): void {
  on(ipc, CH.karigarsList, null, () =>
    getDb().prepare('SELECT * FROM karigars ORDER BY name').all().map((r) => camelize<Karigar>(r)),
  );

  on(ipc, CH.karigarsCreate, KarigarInput, (k) => {
    const row = getDb().prepare(
      `INSERT INTO karigars (name, phone, address, default_labour_mode, default_labour_value, notes)
       VALUES (@name, @phone, @address, @defaultLabourMode, @defaultLabourValue, @notes) RETURNING *`,
    ).get({ ...k, phone: k.phone ?? null });
    const out = camelize<Karigar>(row);
    audit('karigar', out.id, 'insert', null, out);
    return out;
  });

  on(ipc, CH.karigarsUpdate, KarigarInput.extend({ id: z.number().int() }), (k) => {
    const db = getDb();
    const before = db.prepare('SELECT * FROM karigars WHERE id = ?').get(k.id);
    if (!before) throw new Error(`karigar ${k.id} not found`);
    const row = db.prepare(
      `UPDATE karigars SET name=@name, phone=@phone, address=@address,
        default_labour_mode=@defaultLabourMode, default_labour_value=@defaultLabourValue,
        notes=@notes, updated_at=unixepoch()
       WHERE id=@id RETURNING *`,
    ).get({ ...k, phone: k.phone ?? null });
    audit('karigar', k.id, 'update', before, row);
    return camelize<Karigar>(row);
  });

  on(ipc, CH.karigarsDelete, z.object({ id: z.number().int() }), ({ id }) => {
    const db = getDb();
    const before = db.prepare('SELECT * FROM karigars WHERE id = ?').get(id);
    if (!before) return { ok: false };
    db.prepare('DELETE FROM karigars WHERE id = ?').run(id);
    audit('karigar', id, 'delete', before, null);
    return { ok: true };
  });

  on(ipc, CH.karigarIssuePost, KarigarIssueInput, (p) => {
    const res = postKarigarIssue(getDb(), p);
    audit('karigar_issue', res.id, 'post', null, res);
    return res;
  });

  on(ipc, CH.karigarReceiptPost, KarigarReceiptInput, (p) => {
    const res = postKarigarReceipt(getDb(), p);
    audit('karigar_receipt', res.id, 'post', null, res);
    return res;
  });

  on(ipc, CH.karigarPay, KarigarPayInput, (p) => {
    const res = payKarigar(getDb(), p);
    audit('karigar_pay', res.id, 'post', null, res);
    return res;
  });

  on(ipc, CH.karigarIssuesList, z.object({ karigarId: z.number().int().optional() }).default({}), ({ karigarId }) => {
    const db = getDb();
    const clauses: string[] = []; const args: any[] = [];
    if (karigarId) { clauses.push('ki.karigar_id = ?'); args.push(karigarId); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return db.prepare(
      `SELECT ki.id, ki.slip_no as slipNo, ki.ts, ki.karigar_id as karigarId, k.name as karigarName,
              ki.purpose, ki.notes,
              (SELECT SUM(weight_mg) FROM karigar_issue_items WHERE issue_id = ki.id) AS totalMg
       FROM karigar_issues ki JOIN karigars k ON k.id = ki.karigar_id
       ${where} ORDER BY ki.ts DESC LIMIT 200`,
    ).all(...args);
  });

  on(ipc, CH.karigarReceiptsList, z.object({ karigarId: z.number().int().optional() }).default({}), ({ karigarId }) => {
    const db = getDb();
    const clauses: string[] = []; const args: any[] = [];
    if (karigarId) { clauses.push('kr.karigar_id = ?'); args.push(karigarId); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return db.prepare(
      `SELECT kr.id, kr.slip_no as slipNo, kr.ts, kr.karigar_id as karigarId, k.name as karigarName,
              kr.related_issue_id as relatedIssueId, kr.labour_paise as labourPaise, kr.notes,
              (SELECT SUM(weight_mg) FROM karigar_receipt_items WHERE receipt_id = kr.id) AS totalReceivedMg,
              (SELECT SUM(wastage_mg) FROM karigar_receipt_items WHERE receipt_id = kr.id) AS totalWastageMg
       FROM karigar_receipts kr JOIN karigars k ON k.id = kr.karigar_id
       ${where} ORDER BY kr.ts DESC LIMIT 200`,
    ).all(...args);
  });

  on(ipc, CH.karigarLedger, z.object({ karigarId: z.number().int() }), ({ karigarId }) =>
    readKarigarLedger(getDb(), karigarId),
  );

  on(ipc, CH.karigarBalances, null, () => listKarigarBalances(getDb()));
}
