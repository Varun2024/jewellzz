import type { IpcMain } from 'electron';
import { getDb } from '../db';
import { postPurchase } from '../txn';
import { CH, PurchaseInput, LedgerRange } from '../../shared/ipc';
import { on, audit } from './_shared';

export function register(ipc: IpcMain): void {
  on(ipc, CH.purchasePost, PurchaseInput, (p) => {
    const posted = postPurchase(getDb(), p);
    audit('purchase', posted.id, 'post', null, posted);
    return posted;
  });

  on(ipc, CH.purchasesList, LedgerRange, (r) => {
    const db = getDb();
    const clauses: string[] = [];
    const args: any[] = [];
    if (r.fromTs) { clauses.push('ts >= ?'); args.push(r.fromTs); }
    if (r.toTs)   { clauses.push('ts <= ?'); args.push(r.toTs); }
    if (r.partyId) { clauses.push('party_id = ?'); args.push(r.partyId); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return db
      .prepare(
        `SELECT p.id, p.ref_no as refNo, p.ts, p.party_id as partyId, pa.name as partyName,
                p.subtotal_paise as subtotalPaise, p.cgst_paise as cgstPaise, p.sgst_paise as sgstPaise,
                p.igst_paise as igstPaise, p.total_paise as totalPaise, p.balance_paise as balancePaise
         FROM purchases p JOIN parties pa ON pa.id = p.party_id
         ${where}
         ORDER BY p.ts DESC LIMIT 500`,
      )
      .all(...args);
  });
}
