import type Database from 'better-sqlite3';
import type { KarigarIssueInput, KarigarReceiptInput, KarigarPayInput } from '../shared/ipc';

// ponytail: each of these is one SQLite transaction. Writes to both the shop-level ledger (metal/cash)
// AND the karigar_ledger. Slip numbers come from settings counters.

function nextSlipNo(db: Database.Database, prefix: string, key: string): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  const n = row ? parseInt(row.value, 10) : 1;
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(n + 1));
  return `${prefix}${String(n).padStart(4, '0')}`;
}

// ── ISSUE: shop → karigar ───────────────────────────────────────────────
export function postKarigarIssue(db: Database.Database, p: KarigarIssueInput): { id: number; slipNo: string } {
  return db.transaction(() => {
    const kar = db.prepare('SELECT id FROM karigars WHERE id = ?').get(p.karigarId) as any;
    if (!kar) throw new Error(`karigar ${p.karigarId} not found`);

    const slipNo = nextSlipNo(db, 'KI-', 'karigar_issue_next_no');
    const ts = p.ts ?? Math.floor(Date.now() / 1000);
    const row = db.prepare(
      `INSERT INTO karigar_issues (slip_no, ts, karigar_id, purpose, notes)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
    ).get(slipNo, ts, p.karigarId, p.purpose, p.notes) as { id: number };

    const insertLine = db.prepare(
      `INSERT INTO karigar_issue_items (issue_id, category, stamp, weight_mg, note) VALUES (?, ?, ?, ?, ?)`,
    );
    const insertShopMetal = db.prepare(
      `INSERT INTO metal_ledger (ts, ref_type, ref_id, party_id, category, stamp, debit_mg, credit_mg, note)
       VALUES (?, 'karigar_issue', ?, NULL, ?, ?, 0, ?, ?)`,
    );
    const insertKarigarLine = db.prepare(
      `INSERT INTO karigar_ledger (ts, karigar_id, ref_type, ref_id, kind, category, stamp, debit, credit, note)
       VALUES (?, ?, 'karigar_issue', ?, 'metal', ?, ?, ?, 0, ?)`,
    );

    for (const l of p.lines) {
      insertLine.run(row.id, l.category, l.stamp, l.weightMg, l.note);
      insertShopMetal.run(ts, row.id, l.category, l.stamp, l.weightMg, `issue ${slipNo}`);
      insertKarigarLine.run(ts, p.karigarId, row.id, l.category, l.stamp, l.weightMg, `issue ${slipNo}`);
    }

    return { id: row.id, slipNo };
  })();
}

// ── RECEIPT: karigar → shop (finished goods + wastage + labour claim) ───
export function postKarigarReceipt(db: Database.Database, p: KarigarReceiptInput): { id: number; slipNo: string } {
  return db.transaction(() => {
    const kar = db.prepare('SELECT id FROM karigars WHERE id = ?').get(p.karigarId) as any;
    if (!kar) throw new Error(`karigar ${p.karigarId} not found`);
    if (p.relatedIssueId) {
      const iss = db.prepare('SELECT id FROM karigar_issues WHERE id = ? AND karigar_id = ?').get(p.relatedIssueId, p.karigarId);
      if (!iss) throw new Error(`issue ${p.relatedIssueId} not found for karigar ${p.karigarId}`);
    }

    const slipNo = nextSlipNo(db, 'KR-', 'karigar_receipt_next_no');
    const ts = p.ts ?? Math.floor(Date.now() / 1000);
    const row = db.prepare(
      `INSERT INTO karigar_receipts (slip_no, ts, karigar_id, related_issue_id, labour_paise, notes)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    ).get(slipNo, ts, p.karigarId, p.relatedIssueId ?? null, p.labourPaise, p.notes) as { id: number };

    const insertLine = db.prepare(
      `INSERT INTO karigar_receipt_items (receipt_id, item_id, category, stamp, qty, weight_mg, wastage_mg, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const updItem = db.prepare(
      `UPDATE items SET stock_qty = stock_qty + ?, stock_wt_mg = stock_wt_mg + ?, updated_at = unixepoch() WHERE id = ?`,
    );
    const insertShopMetal = db.prepare(
      `INSERT INTO metal_ledger (ts, ref_type, ref_id, party_id, category, stamp, debit_mg, credit_mg, note)
       VALUES (?, 'karigar_receipt', ?, NULL, ?, ?, ?, 0, ?)`,
    );
    const insertKarigarMetal = db.prepare(
      `INSERT INTO karigar_ledger (ts, karigar_id, ref_type, ref_id, kind, category, stamp, debit, credit, note)
       VALUES (?, ?, 'karigar_receipt', ?, 'metal', ?, ?, 0, ?, ?)`,
    );

    for (const l of p.lines) {
      insertLine.run(row.id, l.itemId ?? null, l.category, l.stamp, l.qty, l.weightMg, l.wastageMg, l.note);
      if (l.itemId && (l.qty > 0 || l.weightMg > 0)) {
        updItem.run(l.qty, l.weightMg, l.itemId);
      }
      if (l.weightMg > 0) {
        insertShopMetal.run(ts, row.id, l.category, l.stamp, l.weightMg, `receipt ${slipNo}`);
      }
      // karigar's obligation is settled by (received + wastage): wastage is metal consumed during work
      const settle = l.weightMg + l.wastageMg;
      if (settle > 0) {
        insertKarigarMetal.run(ts, p.karigarId, row.id, l.category, l.stamp, settle, `receipt ${slipNo}`);
      }
    }

    // labour claim: karigar_ledger cash credit (shop owes karigar)
    if (p.labourPaise > 0) {
      db.prepare(
        `INSERT INTO karigar_ledger (ts, karigar_id, ref_type, ref_id, kind, debit, credit, note)
         VALUES (?, ?, 'karigar_labour', ?, 'cash', 0, ?, ?)`,
      ).run(ts, p.karigarId, row.id, p.labourPaise, `labour for ${slipNo}`);
    }

    return { id: row.id, slipNo };
  })();
}

// ── PAY: shop pays karigar cash for labour ──────────────────────────────
export function payKarigar(db: Database.Database, p: KarigarPayInput): { id: number } {
  return db.transaction(() => {
    const kar = db.prepare('SELECT id FROM karigars WHERE id = ?').get(p.karigarId) as any;
    if (!kar) throw new Error(`karigar ${p.karigarId} not found`);
    const ts = Math.floor(Date.now() / 1000);

    // shop cash out
    db.prepare(
      `INSERT INTO cash_ledger (ts, ref_type, ref_id, party_id, debit_paise, credit_paise, note)
       VALUES (?, 'karigar_pay', NULL, NULL, 0, ?, ?)`,
    ).run(ts, p.amountPaise, p.note || 'labour payment');

    // karigar cash debit (settles what shop owed)
    const row = db.prepare(
      `INSERT INTO karigar_ledger (ts, karigar_id, ref_type, ref_id, kind, debit, credit, note)
       VALUES (?, ?, 'karigar_pay', NULL, 'cash', ?, 0, ?) RETURNING id`,
    ).get(ts, p.karigarId, p.amountPaise, p.note || 'labour payment') as { id: number };

    return { id: row.id };
  })();
}

// ── READS ───────────────────────────────────────────────────────────────
export function listKarigarBalances(db: Database.Database): any[] {
  // per-karigar cash balance (shop owes if negative-of-debit-minus-credit >0? we defined credit=shop owes)
  // net cash = SUM(debit) - SUM(credit). Negative = shop owes karigar.
  return db.prepare(
    `SELECT k.id, k.name, k.phone,
            COALESCE(SUM(CASE WHEN kl.kind='cash' THEN kl.debit-kl.credit END),0) AS cashBalance,
            COALESCE(SUM(CASE WHEN kl.kind='metal' THEN kl.debit-kl.credit END),0) AS metalBalanceMg
     FROM karigars k
     LEFT JOIN karigar_ledger kl ON kl.karigar_id = k.id
     GROUP BY k.id, k.name, k.phone
     ORDER BY k.name`,
  ).all();
}

export function readKarigarLedger(db: Database.Database, karigarId: number): any[] {
  const rows = db.prepare(
    `SELECT id, ts, ref_type as refType, ref_id as refId, kind,
            category, stamp, debit, credit, note
     FROM karigar_ledger WHERE karigar_id = ? ORDER BY ts, id`,
  ).all(karigarId) as any[];
  const bals = { cash: 0, metal: new Map<string, number>() };
  return rows.map((r: any) => {
    if (r.kind === 'cash') {
      bals.cash += r.debit - r.credit;
      return { ...r, balance: bals.cash };
    }
    const k = `${r.category ?? ''}|${r.stamp ?? ''}`;
    const b = (bals.metal.get(k) ?? 0) + r.debit - r.credit;
    bals.metal.set(k, b);
    return { ...r, balance: b };
  });
}
