import type Database from 'better-sqlite3';
import { app, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { LedgerRange } from '../shared/ipc';

// ponytail: CSV, not xlsx. Excel opens CSV fine and we skip a heavy dep.

function exportsDir(): string {
  const dir = path.join(app.getPath('userData'), 'exports');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function whereRange(r: LedgerRange, col = 'ts'): { where: string; args: any[] } {
  const clauses: string[] = []; const args: any[] = [];
  if (r.fromTs) { clauses.push(`${col} >= ?`); args.push(r.fromTs); }
  if (r.toTs)   { clauses.push(`${col} <= ?`); args.push(r.toTs); }
  if (r.partyId) { clauses.push('party_id = ?'); args.push(r.partyId); }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', args };
}

function toRupees(paise: number): string { return (paise / 100).toFixed(2); }

export function writeCsvSales(db: Database.Database, r: LedgerRange): { path: string } {
  const { where, args } = whereRange(r, 's.ts');
  const rows = db.prepare(
    `SELECT s.bill_no, s.ts, p.name AS party, p.gstin AS party_gstin, s.party_state,
            s.subtotal_paise, s.cgst_paise, s.sgst_paise, s.igst_paise,
            s.discount_paise, s.round_off_paise, s.total_paise,
            s.paid_cash_paise, s.paid_bank_paise, s.old_gold_value_paise, s.balance_paise
     FROM sales s JOIN parties p ON p.id = s.party_id
     ${where} ORDER BY s.ts`,
  ).all(...args) as any[];

  const header = [
    'Bill No', 'Date', 'Party', 'Party GSTIN', 'Party State',
    'Subtotal', 'CGST', 'SGST', 'IGST', 'Discount', 'Round Off', 'Total',
    'Paid Cash', 'Paid Bank', 'Old-gold', 'Balance',
  ];
  const lines = [header.map(esc).join(',')];
  for (const row of rows) {
    lines.push([
      row.bill_no,
      new Date(row.ts * 1000).toISOString(),
      row.party, row.party_gstin ?? '', row.party_state ?? '',
      toRupees(row.subtotal_paise), toRupees(row.cgst_paise), toRupees(row.sgst_paise), toRupees(row.igst_paise),
      toRupees(row.discount_paise), toRupees(row.round_off_paise), toRupees(row.total_paise),
      toRupees(row.paid_cash_paise), toRupees(row.paid_bank_paise), toRupees(row.old_gold_value_paise), toRupees(row.balance_paise),
    ].map(esc).join(','));
  }

  const file = path.join(exportsDir(), `sales-${Date.now()}.csv`);
  fs.writeFileSync(file, lines.join('\r\n') + '\r\n', 'utf8');
  shell.openPath(file).catch(() => {});
  return { path: file };
}

export function writeCsvPurchases(db: Database.Database, r: LedgerRange): { path: string } {
  const { where, args } = whereRange(r, 'p.ts');
  const rows = db.prepare(
    `SELECT p.ref_no, p.ts, pa.name AS party, pa.gstin AS party_gstin, p.party_state,
            p.subtotal_paise, p.cgst_paise, p.sgst_paise, p.igst_paise,
            p.total_paise, p.paid_cash_paise, p.paid_bank_paise, p.balance_paise
     FROM purchases p JOIN parties pa ON pa.id = p.party_id
     ${where} ORDER BY p.ts`,
  ).all(...args) as any[];

  const header = [
    'Ref No', 'Date', 'Party', 'Party GSTIN', 'Party State',
    'Subtotal', 'CGST', 'SGST', 'IGST', 'Total',
    'Paid Cash', 'Paid Bank', 'Balance',
  ];
  const lines = [header.map(esc).join(',')];
  for (const row of rows) {
    lines.push([
      row.ref_no,
      new Date(row.ts * 1000).toISOString(),
      row.party, row.party_gstin ?? '', row.party_state ?? '',
      toRupees(row.subtotal_paise), toRupees(row.cgst_paise), toRupees(row.sgst_paise), toRupees(row.igst_paise),
      toRupees(row.total_paise), toRupees(row.paid_cash_paise), toRupees(row.paid_bank_paise), toRupees(row.balance_paise),
    ].map(esc).join(','));
  }

  const file = path.join(exportsDir(), `purchases-${Date.now()}.csv`);
  fs.writeFileSync(file, lines.join('\r\n') + '\r\n', 'utf8');
  shell.openPath(file).catch(() => {});
  return { path: file };
}
