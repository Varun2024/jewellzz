import type Database from 'better-sqlite3';
import type {
  ApprovalInput, ApprovalResolve,
  RepairInput, RepairDeliver, RepairStatusUpdate,
  OrderInput, OrderAdvance, OrderStatusUpdate,
} from '../shared/ipc';

// ponytail: every state-change is one txn. Ledger writes only on cash movements
// (advance received, delivery paid). Approval touches items.stock; repair and order don't.

function nextSlipNo(db: Database.Database, prefix: string, key: string): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  const n = row ? parseInt(row.value, 10) : 1;
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, String(n + 1));
  return `${prefix}${String(n).padStart(4, '0')}`;
}

// ── APPROVAL ────────────────────────────────────────────────────────────
export function createApproval(db: Database.Database, p: ApprovalInput): { id: number; slipNo: string } {
  return db.transaction(() => {
    const party = db.prepare('SELECT id FROM parties WHERE id = ?').get(p.partyId);
    if (!party) throw new Error(`party ${p.partyId} not found`);
    const slipNo = nextSlipNo(db, 'AP-', 'approval_next_no');
    const ts = Math.floor(Date.now() / 1000);
    const row = db.prepare(
      `INSERT INTO approvals (slip_no, ts, party_id, promised_return_date, notes)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
    ).get(slipNo, ts, p.partyId, p.promisedReturnDate, p.notes) as { id: number };

    const insertLine = db.prepare(
      `INSERT INTO approval_items (approval_id, item_id, category, stamp, qty, weight_mg, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const decStock = db.prepare(
      `UPDATE items SET stock_qty = stock_qty - ?, stock_wt_mg = stock_wt_mg - ?, updated_at = unixepoch()
       WHERE id = ?`,
    );

    for (const l of p.lines) {
      insertLine.run(row.id, l.itemId, l.category, l.stamp ?? null, l.qty, l.weightMg, l.note);
      decStock.run(l.qty, l.weightMg, l.itemId);
    }
    return { id: row.id, slipNo };
  })();
}

export function resolveApproval(db: Database.Database, p: ApprovalResolve): { id: number; status: string } {
  return db.transaction(() => {
    const app = db.prepare('SELECT * FROM approvals WHERE id = ?').get(p.id) as any;
    if (!app) throw new Error(`approval ${p.id} not found`);
    if (app.status !== 'open') throw new Error(`approval ${app.slip_no} already ${app.status}`);
    const ts = Math.floor(Date.now() / 1000);

    // returned or cancelled → restore stock; sold → stock stays out (a Sale should be posted separately)
    if (p.status === 'returned' || p.status === 'cancelled') {
      const lines = db.prepare('SELECT * FROM approval_items WHERE approval_id = ?').all(p.id) as any[];
      const incStock = db.prepare(
        `UPDATE items SET stock_qty = stock_qty + ?, stock_wt_mg = stock_wt_mg + ?, updated_at = unixepoch()
         WHERE id = ?`,
      );
      for (const l of lines) incStock.run(l.qty, l.weight_mg, l.item_id);
    }

    db.prepare(
      `UPDATE approvals SET status = ?, resolved_at = ?, resolved_sale_id = ? WHERE id = ?`,
    ).run(p.status, ts, p.resolvedSaleId ?? null, p.id);

    return { id: p.id, status: p.status };
  })();
}

// ── REPAIR ──────────────────────────────────────────────────────────────
export function createRepair(db: Database.Database, p: RepairInput): { id: number; slipNo: string } {
  return db.transaction(() => {
    const party = db.prepare('SELECT id FROM parties WHERE id = ?').get(p.partyId);
    if (!party) throw new Error(`party ${p.partyId} not found`);
    const slipNo = nextSlipNo(db, 'RP-', 'repair_next_no');
    const ts = Math.floor(Date.now() / 1000);
    const total = p.additionPaise + p.labourPaise;
    const row = db.prepare(
      `INSERT INTO repairs (slip_no, ts, party_id, description,
                            customer_material_category, customer_material_stamp, customer_material_weight_mg,
                            karigar_id, addition_paise, labour_paise, total_paise, balance_paise,
                            promised_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    ).get(
      slipNo, ts, p.partyId, p.description,
      p.customerMaterialCategory ?? null, p.customerMaterialStamp ?? null, p.customerMaterialWeightMg,
      p.karigarId ?? null, p.additionPaise, p.labourPaise, total, total,
      p.promisedDate, p.notes,
    ) as { id: number };
    return { id: row.id, slipNo };
  })();
}

export function updateRepairStatus(db: Database.Database, p: RepairStatusUpdate): { id: number; status: string } {
  const cur = db.prepare('SELECT status, slip_no FROM repairs WHERE id = ?').get(p.id) as any;
  if (!cur) throw new Error(`repair ${p.id} not found`);
  if (cur.status === 'delivered' || cur.status === 'cancelled') {
    throw new Error(`repair ${cur.slip_no} is ${cur.status}, no further changes`);
  }
  db.prepare('UPDATE repairs SET status = ? WHERE id = ?').run(p.status, p.id);
  return { id: p.id, status: p.status };
}

export function deliverRepair(db: Database.Database, p: RepairDeliver): { id: number; balancePaise: number } {
  return db.transaction(() => {
    const r = db.prepare('SELECT * FROM repairs WHERE id = ?').get(p.id) as any;
    if (!r) throw new Error(`repair ${p.id} not found`);
    if (r.status === 'delivered') throw new Error(`repair ${r.slip_no} already delivered`);
    if (r.status === 'cancelled') throw new Error(`repair ${r.slip_no} cancelled`);

    const ts = Math.floor(Date.now() / 1000);
    const balance = r.total_paise - p.paidCashPaise - p.paidBankPaise;

    db.prepare(
      `UPDATE repairs SET status = 'delivered', delivered_at = ?,
                          paid_cash_paise = ?, paid_bank_paise = ?, balance_paise = ?
       WHERE id = ?`,
    ).run(ts, p.paidCashPaise, p.paidBankPaise, balance, p.id);

    if (p.paidCashPaise > 0) {
      db.prepare(
        `INSERT INTO cash_ledger (ts, ref_type, ref_id, party_id, debit_paise, credit_paise, note)
         VALUES (?, 'repair', ?, ?, ?, 0, ?)`,
      ).run(ts, r.id, r.party_id, p.paidCashPaise, `repair ${r.slip_no}`);
    }

    // party owes remaining balance
    if (balance !== 0) {
      db.prepare(
        `INSERT INTO party_ledger (ts, party_id, ref_type, ref_id, kind, debit, credit, note)
         VALUES (?, ?, 'repair', ?, 'cash', ?, ?, ?)`,
      ).run(
        ts, r.party_id, r.id,
        balance > 0 ? balance : 0,
        balance < 0 ? -balance : 0,
        `repair ${r.slip_no}`,
      );
    }

    return { id: p.id, balancePaise: balance };
  })();
}

// ── ORDER ──────────────────────────────────────────────────────────────
export function createOrder(db: Database.Database, p: OrderInput): { id: number; slipNo: string } {
  return db.transaction(() => {
    const party = db.prepare('SELECT id FROM parties WHERE id = ?').get(p.partyId);
    if (!party) throw new Error(`party ${p.partyId} not found`);
    const slipNo = nextSlipNo(db, 'OR-', 'order_next_no');
    const ts = Math.floor(Date.now() / 1000);
    const row = db.prepare(
      `INSERT INTO orders (slip_no, ts, party_id, spec, estimated_paise, karigar_id, promised_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    ).get(slipNo, ts, p.partyId, p.spec, p.estimatedPaise, p.karigarId ?? null, p.promisedDate, p.notes) as { id: number };
    return { id: row.id, slipNo };
  })();
}

export function receiveOrderAdvance(db: Database.Database, p: OrderAdvance): { id: number; advanceTotalPaise: number } {
  return db.transaction(() => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(p.id) as any;
    if (!o) throw new Error(`order ${p.id} not found`);
    if (o.status === 'delivered' || o.status === 'cancelled') {
      throw new Error(`order ${o.slip_no} is ${o.status}`);
    }
    const ts = Math.floor(Date.now() / 1000);
    const newAdvance = o.advance_paise + p.amountPaise;
    db.prepare('UPDATE orders SET advance_paise = ? WHERE id = ?').run(newAdvance, p.id);

    // shop cash in
    db.prepare(
      `INSERT INTO cash_ledger (ts, ref_type, ref_id, party_id, debit_paise, credit_paise, note)
       VALUES (?, 'order_advance', ?, ?, ?, 0, ?)`,
    ).run(ts, o.id, o.party_id, p.amountPaise, `advance ${o.slip_no}`);

    // party paid ahead — party_ledger credit (shop holds their money)
    db.prepare(
      `INSERT INTO party_ledger (ts, party_id, ref_type, ref_id, kind, debit, credit, note)
       VALUES (?, ?, 'order_advance', ?, 'cash', 0, ?, ?)`,
    ).run(ts, o.party_id, o.id, p.amountPaise, `advance ${o.slip_no}`);

    return { id: p.id, advanceTotalPaise: newAdvance };
  })();
}

export function updateOrderStatus(db: Database.Database, p: OrderStatusUpdate): { id: number; status: string } {
  const cur = db.prepare('SELECT status, slip_no FROM orders WHERE id = ?').get(p.id) as any;
  if (!cur) throw new Error(`order ${p.id} not found`);
  if (cur.status === 'delivered' || cur.status === 'cancelled') {
    throw new Error(`order ${cur.slip_no} is ${cur.status}, no further changes`);
  }
  const ts = Math.floor(Date.now() / 1000);
  if (p.status === 'delivered' || p.status === 'cancelled') {
    db.prepare('UPDATE orders SET status = ?, delivered_at = ? WHERE id = ?').run(p.status, ts, p.id);
  } else {
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(p.status, p.id);
  }
  return { id: p.id, status: p.status };
}
