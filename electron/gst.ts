import type Database from 'better-sqlite3';
import { app, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { LedgerRange } from '../shared/ipc';

// ponytail: GST is a report over existing data. No schema change.
// GSTR-1 rows are per (invoice, rate) so a bill with mixed GST rates produces multiple rows.
// GSTR-3B is a single summary block. HSN summary groups sale_items by hsn+rate.

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
function rup(paise: number): string { return (paise / 100).toFixed(2); }
function ratePct(bp: number): number { return bp / 100; }

function rangeArgs(r: LedgerRange): { where: string; args: any[] } {
  const clauses: string[] = ['1=1'];
  const args: any[] = [];
  if (r.fromTs) { clauses.push('s.ts >= ?'); args.push(r.fromTs); }
  if (r.toTs)   { clauses.push('s.ts <= ?'); args.push(r.toTs); }
  return { where: clauses.join(' AND '), args };
}

// ─── GSTR-1 (outward supplies) ─────────────────────────────────────────
export type Gstr1Row = {
  billNo: string;
  ts: number;
  buyerGstin: string;
  buyerName: string;
  buyerState: string;
  invoiceValuePaise: number;
  ratePct: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  invoiceType: 'B2B' | 'B2C';
  interstate: boolean;
};

export function computeGstr1(db: Database.Database, r: LedgerRange): Gstr1Row[] {
  const { where, args } = rangeArgs(r);
  // one row per (sale, gst_bp): a mixed-rate invoice yields multiple rows.
  const rows = db.prepare(
    `SELECT s.id as saleId, s.bill_no as billNo, s.ts, s.total_paise as invoiceValuePaise,
            s.interstate, s.party_state as buyerState,
            p.name as buyerName, p.gstin as buyerGstin,
            si.gst_bp,
            SUM(si.taxable_paise) as taxablePaise,
            SUM(si.cgst_paise)    as cgstPaise,
            SUM(si.sgst_paise)    as sgstPaise,
            SUM(si.igst_paise)    as igstPaise
     FROM sales s
     JOIN parties p ON p.id = s.party_id
     JOIN sale_items si ON si.sale_id = s.id
     WHERE ${where}
     GROUP BY s.id, si.gst_bp
     ORDER BY s.ts, s.id, si.gst_bp`,
  ).all(...args) as any[];

  return rows.map((row) => ({
    billNo: row.billNo,
    ts: row.ts,
    buyerGstin: row.buyerGstin ?? '',
    buyerName: row.buyerName,
    buyerState: row.buyerState,
    invoiceValuePaise: row.invoiceValuePaise,
    ratePct: ratePct(row.gst_bp),
    taxablePaise: row.taxablePaise,
    cgstPaise: row.cgstPaise,
    sgstPaise: row.sgstPaise,
    igstPaise: row.igstPaise,
    invoiceType: row.buyerGstin ? 'B2B' as const : 'B2C' as const,
    interstate: !!row.interstate,
  }));
}

export function writeGstr1Csv(db: Database.Database, r: LedgerRange): { path: string } {
  const rows = computeGstr1(db, r);
  const header = [
    'GSTIN/UIN of Recipient', 'Receiver Name', 'Invoice Number', 'Invoice date',
    'Invoice Value', 'Place Of Supply', 'Reverse Charge', 'Applicable % of Tax Rate',
    'Invoice Type', 'E-Commerce GSTIN', 'Rate', 'Taxable Value',
    'Cess Amount', 'CGST', 'SGST', 'IGST',
  ];
  const lines = [header.map(esc).join(',')];
  for (const row of rows) {
    lines.push([
      row.buyerGstin,
      row.buyerName,
      row.billNo,
      new Date(row.ts * 1000).toISOString().slice(0, 10),
      rup(row.invoiceValuePaise),
      row.buyerState,
      'N',
      '',
      row.invoiceType === 'B2B' ? 'Regular B2B' : 'B2C (Small)',
      '',
      row.ratePct.toFixed(2),
      rup(row.taxablePaise),
      '0.00',
      rup(row.cgstPaise),
      rup(row.sgstPaise),
      rup(row.igstPaise),
    ].map(esc).join(','));
  }

  const file = path.join(exportsDir(), `gstr1-${Date.now()}.csv`);
  fs.writeFileSync(file, lines.join('\r\n') + '\r\n', 'utf8');
  shell.openPath(file).catch(() => {});
  return { path: file };
}

// ─── GSTR-3B (summary) ─────────────────────────────────────────────────
export type Gstr3bSummary = {
  outward: {
    taxablePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    totalPaise: number;
  };
  outwardB2B: {
    taxablePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    count: number;
  };
  outwardB2C: {
    taxablePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    count: number;
  };
  inwardITC: {
    taxablePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
  };
};

export function computeGstr3b(db: Database.Database, r: LedgerRange): Gstr3bSummary {
  const { where, args } = rangeArgs(r);

  const outwardTotals = db.prepare(
    `SELECT COALESCE(SUM(s.subtotal_paise),0) as taxablePaise,
            COALESCE(SUM(s.cgst_paise),0)     as cgstPaise,
            COALESCE(SUM(s.sgst_paise),0)     as sgstPaise,
            COALESCE(SUM(s.igst_paise),0)     as igstPaise,
            COALESCE(SUM(s.total_paise),0)    as totalPaise
     FROM sales s WHERE ${where}`,
  ).get(...args) as any;

  const b2b = db.prepare(
    `SELECT COALESCE(SUM(s.subtotal_paise),0) as taxablePaise,
            COALESCE(SUM(s.cgst_paise),0)     as cgstPaise,
            COALESCE(SUM(s.sgst_paise),0)     as sgstPaise,
            COALESCE(SUM(s.igst_paise),0)     as igstPaise,
            COUNT(*) as count
     FROM sales s JOIN parties p ON p.id = s.party_id
     WHERE ${where} AND p.gstin IS NOT NULL AND length(p.gstin) > 0`,
  ).get(...args) as any;

  const b2c = db.prepare(
    `SELECT COALESCE(SUM(s.subtotal_paise),0) as taxablePaise,
            COALESCE(SUM(s.cgst_paise),0)     as cgstPaise,
            COALESCE(SUM(s.sgst_paise),0)     as sgstPaise,
            COALESCE(SUM(s.igst_paise),0)     as igstPaise,
            COUNT(*) as count
     FROM sales s JOIN parties p ON p.id = s.party_id
     WHERE ${where} AND (p.gstin IS NULL OR length(p.gstin) = 0)`,
  ).get(...args) as any;

  // inward = purchase taxes eligible for ITC
  const inwardWhere = where.replace(/s\.ts/g, 'p.ts');
  const inward = db.prepare(
    `SELECT COALESCE(SUM(p.subtotal_paise),0) as taxablePaise,
            COALESCE(SUM(p.cgst_paise),0)     as cgstPaise,
            COALESCE(SUM(p.sgst_paise),0)     as sgstPaise,
            COALESCE(SUM(p.igst_paise),0)     as igstPaise
     FROM purchases p WHERE ${inwardWhere}`,
  ).get(...args) as any;

  return { outward: outwardTotals, outwardB2B: b2b, outwardB2C: b2c, inwardITC: inward };
}

export function writeGstr3bCsv(db: Database.Database, r: LedgerRange): { path: string } {
  const s = computeGstr3b(db, r);
  const lines: string[] = [];
  lines.push(['Section', 'Description', 'Taxable', 'CGST', 'SGST', 'IGST'].map(esc).join(','));
  lines.push(['3.1 (a)', 'Outward taxable supplies (total)',
    rup(s.outward.taxablePaise), rup(s.outward.cgstPaise), rup(s.outward.sgstPaise), rup(s.outward.igstPaise)].map(esc).join(','));
  lines.push(['3.1 (a) B2B', `Outward B2B (${s.outwardB2B.count} inv)`,
    rup(s.outwardB2B.taxablePaise), rup(s.outwardB2B.cgstPaise), rup(s.outwardB2B.sgstPaise), rup(s.outwardB2B.igstPaise)].map(esc).join(','));
  lines.push(['3.1 (a) B2C', `Outward B2C (${s.outwardB2C.count} inv)`,
    rup(s.outwardB2C.taxablePaise), rup(s.outwardB2C.cgstPaise), rup(s.outwardB2C.sgstPaise), rup(s.outwardB2C.igstPaise)].map(esc).join(','));
  lines.push(['4 ITC', 'Input tax credit (from purchases)',
    rup(s.inwardITC.taxablePaise), rup(s.inwardITC.cgstPaise), rup(s.inwardITC.sgstPaise), rup(s.inwardITC.igstPaise)].map(esc).join(','));

  const file = path.join(exportsDir(), `gstr3b-${Date.now()}.csv`);
  fs.writeFileSync(file, lines.join('\r\n') + '\r\n', 'utf8');
  shell.openPath(file).catch(() => {});
  return { path: file };
}

// ─── HSN summary ────────────────────────────────────────────────────────
export type HsnRow = {
  hsn: string;
  ratePct: number;
  uqc: string;          // Unit Quantity Code (GMS/CTS/PCS)
  totalQty: number;     // pcs
  totalWeightG: number; // grams
  totalValuePaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
};

function uqcFor(unit: string): string {
  if (unit === 'gms') return 'GMS';
  if (unit === 'carat') return 'CTS';
  return 'PCS';
}

export function computeHsnSummary(db: Database.Database, r: LedgerRange): HsnRow[] {
  const { where, args } = rangeArgs(r);
  const rows = db.prepare(
    `SELECT si.hsn, si.gst_bp, si.unit,
            SUM(si.qty)          as totalQty,
            SUM(si.weight_mg)    as totalWeightMg,
            SUM(si.total_paise)  as totalValuePaise,
            SUM(si.taxable_paise) as taxablePaise,
            SUM(si.cgst_paise)   as cgstPaise,
            SUM(si.sgst_paise)   as sgstPaise,
            SUM(si.igst_paise)   as igstPaise
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE ${where}
     GROUP BY si.hsn, si.gst_bp, si.unit
     ORDER BY si.hsn, si.gst_bp`,
  ).all(...args) as any[];

  return rows.map((row) => ({
    hsn: row.hsn || '',
    ratePct: ratePct(row.gst_bp),
    uqc: uqcFor(row.unit),
    totalQty: row.totalQty ?? 0,
    totalWeightG: (row.totalWeightMg ?? 0) / 1000,
    totalValuePaise: row.totalValuePaise ?? 0,
    taxablePaise: row.taxablePaise ?? 0,
    cgstPaise: row.cgstPaise ?? 0,
    sgstPaise: row.sgstPaise ?? 0,
    igstPaise: row.igstPaise ?? 0,
  }));
}

export function writeHsnCsv(db: Database.Database, r: LedgerRange): { path: string } {
  const rows = computeHsnSummary(db, r);
  const header = ['HSN', 'UQC', 'Total Qty', 'Total Weight (g)', 'Rate', 'Total Value', 'Taxable', 'CGST', 'SGST', 'IGST'];
  const lines = [header.map(esc).join(',')];
  for (const row of rows) {
    lines.push([
      row.hsn, row.uqc, String(row.totalQty), row.totalWeightG.toFixed(3),
      row.ratePct.toFixed(2), rup(row.totalValuePaise), rup(row.taxablePaise),
      rup(row.cgstPaise), rup(row.sgstPaise), rup(row.igstPaise),
    ].map(esc).join(','));
  }

  const file = path.join(exportsDir(), `hsn-${Date.now()}.csv`);
  fs.writeFileSync(file, lines.join('\r\n') + '\r\n', 'utf8');
  shell.openPath(file).catch(() => {});
  return { path: file };
}
