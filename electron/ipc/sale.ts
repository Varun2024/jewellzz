import type { IpcMain } from 'electron';
import { z } from 'zod';
import { getDb } from '../db';
import { postSale } from '../txn';
import { printSaleInvoice } from '../print';
import { CH, SaleInput, LedgerRange } from '../../shared/ipc';
import { on, audit } from './_shared';

export function register(ipc: IpcMain): void {
  on(ipc, CH.salePost, SaleInput, (s) => {
    const posted = postSale(getDb(), s);
    audit('sale', posted.id, 'post', null, posted);
    return posted;
  });

  on(ipc, CH.saleGet, z.object({ id: z.number().int() }), ({ id }) => {
    const db = getDb();
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (!sale) return null;
    const lines = db.prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id').all(id);
    const payments = db.prepare('SELECT * FROM sale_payments WHERE sale_id = ? ORDER BY id').all(id);
    return { sale, lines, payments };
  });

  on(ipc, CH.salesList, LedgerRange, (r) => {
    const db = getDb();
    const clauses: string[] = [];
    const args: any[] = [];
    if (r.fromTs) { clauses.push('ts >= ?'); args.push(r.fromTs); }
    if (r.toTs)   { clauses.push('ts <= ?'); args.push(r.toTs); }
    if (r.partyId) { clauses.push('party_id = ?'); args.push(r.partyId); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return db
      .prepare(
        `SELECT s.id, s.bill_no as billNo, s.ts, s.party_id as partyId, p.name as partyName,
                s.subtotal_paise as subtotalPaise, s.cgst_paise as cgstPaise, s.sgst_paise as sgstPaise,
                s.igst_paise as igstPaise, s.total_paise as totalPaise, s.balance_paise as balancePaise
         FROM sales s JOIN parties p ON p.id = s.party_id
         ${where}
         ORDER BY s.ts DESC LIMIT 500`,
      )
      .all(...args);
  });

  on(ipc, CH.salePrint, z.object({ id: z.number().int() }), async ({ id }) => printSaleInvoice(getDb(), id));
}
