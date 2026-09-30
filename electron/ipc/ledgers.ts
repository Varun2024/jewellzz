import type { IpcMain } from 'electron';
import { getDb } from '../db';
import { CH, LedgerRange } from '../../shared/ipc';
import { on } from './_shared';

export function register(ipc: IpcMain): void {
  on(ipc, CH.ledgerCash, LedgerRange, (r) => {
    const db = getDb();
    const clauses: string[] = [];
    const args: any[] = [];
    if (r.fromTs) { clauses.push('ts >= ?'); args.push(r.fromTs); }
    if (r.toTs)   { clauses.push('ts <= ?'); args.push(r.toTs); }
    if (r.partyId) { clauses.push('party_id = ?'); args.push(r.partyId); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT id, ts, ref_type as refType, ref_id as refId, party_id as partyId,
                debit_paise as debitPaise, credit_paise as creditPaise, note
         FROM cash_ledger ${where} ORDER BY ts, id`,
      )
      .all(...args) as any[];
    let bal = 0;
    return rows.map((r: any) => {
      bal += r.debitPaise - r.creditPaise;
      return { ...r, balancePaise: bal };
    });
  });

  on(ipc, CH.ledgerMetal, LedgerRange, (r) => {
    const db = getDb();
    const clauses: string[] = [];
    const args: any[] = [];
    if (r.fromTs) { clauses.push('ts >= ?'); args.push(r.fromTs); }
    if (r.toTs)   { clauses.push('ts <= ?'); args.push(r.toTs); }
    if (r.partyId) { clauses.push('party_id = ?'); args.push(r.partyId); }
    if (r.category) { clauses.push('category = ?'); args.push(r.category); }
    if (r.stamp !== undefined) { clauses.push('stamp = ?'); args.push(r.stamp); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT id, ts, ref_type as refType, ref_id as refId, party_id as partyId,
                category, stamp, debit_mg as debitMg, credit_mg as creditMg, note
         FROM metal_ledger ${where} ORDER BY ts, id`,
      )
      .all(...args) as any[];
    const bals = new Map<string, number>();
    return rows.map((r: any) => {
      const k = `${r.category}|${r.stamp}`;
      const b = (bals.get(k) ?? 0) + r.debitMg - r.creditMg;
      bals.set(k, b);
      return { ...r, balanceMg: b };
    });
  });

  on(ipc, CH.metalBuckets, null, () =>
    getDb()
      .prepare(
        `SELECT category, stamp,
                SUM(debit_mg)  as debitMg,
                SUM(credit_mg) as creditMg,
                SUM(debit_mg) - SUM(credit_mg) as balanceMg
         FROM metal_ledger GROUP BY category, stamp ORDER BY category, stamp`,
      )
      .all(),
  );

  on(ipc, CH.ledgerParty, LedgerRange, (r) => {
    if (!r.partyId) throw new Error('partyId required');
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, ts, ref_type as refType, ref_id as refId, kind,
                category, stamp, debit, credit, note
         FROM party_ledger WHERE party_id = ?
         ${r.fromTs ? 'AND ts >= ?' : ''} ${r.toTs ? 'AND ts <= ?' : ''}
         ORDER BY ts, id`,
      )
      .all(...[r.partyId, r.fromTs, r.toTs].filter((v) => v !== undefined)) as any[];
    const bals = { cash: 0, metal: new Map<string, number>() };
    return rows.map((row: any) => {
      if (row.kind === 'cash') {
        bals.cash += row.debit - row.credit;
        return { ...row, balance: bals.cash };
      }
      const k = `${row.category ?? ''}|${row.stamp ?? ''}`;
      const b = (bals.metal.get(k) ?? 0) + row.debit - row.credit;
      bals.metal.set(k, b);
      return { ...row, balance: b };
    });
  });
}
