import type Database from 'better-sqlite3';
import type { RefiningSend, RefiningReceive } from '../shared/ipc';

// ponytail: one txn per state change. Refining loss is expected + absorbed —
// party_ledger metal credit at receipt matches SENT weight (settles the debit).
// metal_ledger honestly shows shop lost `sent - received` mg of metal (business cost).

function nextSlipNo(db: Database.Database): string {
  const key = 'refining_next_no';
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  const n = row ? parseInt(row.value, 10) : 1;
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, String(n + 1));
  return `RF-${String(n).padStart(4, '0')}`;
}

// ── SEND ───────────────────────────────────────────────────────────────
export function sendRefiningLot(db: Database.Database, p: RefiningSend): { id: number; slipNo: string } {
  return db.transaction(() => {
    const party = db.prepare('SELECT id FROM parties WHERE id = ?').get(p.refinerPartyId);
    if (!party) throw new Error(`party ${p.refinerPartyId} not found`);

    const slipNo = nextSlipNo(db);
    const ts = Math.floor(Date.now() / 1000);

    const row = db.prepare(
      `INSERT INTO refining_lots (slip_no, ts, refiner_party_id,
                                  sent_category, sent_stamp, sent_weight_mg, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    ).get(slipNo, ts, p.refinerPartyId, p.sentCategory, p.sentStamp, p.sentWeightMg, p.notes) as { id: number };

    // shop metal out
    db.prepare(
      `INSERT INTO metal_ledger (ts, ref_type, ref_id, party_id, category, stamp, debit_mg, credit_mg, note)
       VALUES (?, 'refining_send', ?, ?, ?, ?, 0, ?, ?)`,
    ).run(ts, row.id, p.refinerPartyId, p.sentCategory, p.sentStamp, p.sentWeightMg, `refining ${slipNo}`);

    // refiner owes shop the metal
    db.prepare(
      `INSERT INTO party_ledger (ts, party_id, ref_type, ref_id, kind, category, stamp, debit, credit, note)
       VALUES (?, ?, 'refining_send', ?, 'metal', ?, ?, ?, 0, ?)`,
    ).run(ts, p.refinerPartyId, row.id, p.sentCategory, p.sentStamp, p.sentWeightMg, `refining ${slipNo}`);

    return { id: row.id, slipNo };
  })();
}

// ── RECEIVE ────────────────────────────────────────────────────────────
export function receiveRefiningLot(db: Database.Database, p: RefiningReceive): {
  id: number; lossMg: number; chargesBalancePaise: number;
} {
  return db.transaction(() => {
    const lot = db.prepare('SELECT * FROM refining_lots WHERE id = ?').get(p.id) as any;
    if (!lot) throw new Error(`refining lot ${p.id} not found`);
    if (lot.status !== 'sent') throw new Error(`lot ${lot.slip_no} is already ${lot.status}`);

    const ts = Math.floor(Date.now() / 1000);
    const lossMg = lot.sent_weight_mg - p.receivedWeightMg;
    const chargesBalance = p.chargesPaise - p.paidCashPaise;

    db.prepare(
      `UPDATE refining_lots SET
         received_category = ?, received_stamp = ?, received_weight_mg = ?,
         loss_mg = ?,
         charges_paise = ?, paid_cash_paise = ?, charges_balance_paise = ?,
         status = 'received', received_at = ?
       WHERE id = ?`,
    ).run(
      p.receivedCategory, p.receivedStamp, p.receivedWeightMg,
      lossMg,
      p.chargesPaise, p.paidCashPaise, chargesBalance,
      ts, p.id,
    );

    // shop metal in (only what actually came back — the loss is the shop's cost)
    if (p.receivedWeightMg > 0) {
      db.prepare(
        `INSERT INTO metal_ledger (ts, ref_type, ref_id, party_id, category, stamp, debit_mg, credit_mg, note)
         VALUES (?, 'refining_receive', ?, ?, ?, ?, ?, 0, ?)`,
      ).run(ts, lot.id, lot.refiner_party_id, p.receivedCategory, p.receivedStamp, p.receivedWeightMg, `refining ${lot.slip_no}`);
    }

    // settle refiner's metal debt for the SENT amount (expected loss is absorbed)
    db.prepare(
      `INSERT INTO party_ledger (ts, party_id, ref_type, ref_id, kind, category, stamp, debit, credit, note)
       VALUES (?, ?, 'refining_receive', ?, 'metal', ?, ?, 0, ?, ?)`,
    ).run(
      ts, lot.refiner_party_id, lot.id,
      lot.sent_category, lot.sent_stamp, lot.sent_weight_mg,
      `refining ${lot.slip_no}${lossMg > 0 ? ` (loss ${(lossMg / 1000).toFixed(3)}g)` : ''}`,
    );

    // charges: cash paid now, remainder owed
    if (p.paidCashPaise > 0) {
      db.prepare(
        `INSERT INTO cash_ledger (ts, ref_type, ref_id, party_id, debit_paise, credit_paise, note)
         VALUES (?, 'refining_charges', ?, ?, 0, ?, ?)`,
      ).run(ts, lot.id, lot.refiner_party_id, p.paidCashPaise, `refining ${lot.slip_no}`);
    }
    if (chargesBalance !== 0) {
      db.prepare(
        `INSERT INTO party_ledger (ts, party_id, ref_type, ref_id, kind, debit, credit, note)
         VALUES (?, ?, 'refining_charges', ?, 'cash', 0, ?, ?)`,
      ).run(ts, lot.refiner_party_id, lot.id, chargesBalance, `refining charges ${lot.slip_no}`);
    }

    return { id: lot.id, lossMg, chargesBalancePaise: chargesBalance };
  })();
}

// ── CANCEL ─────────────────────────────────────────────────────────────
export function cancelRefiningLot(db: Database.Database, id: number): { id: number } {
  return db.transaction(() => {
    const lot = db.prepare('SELECT * FROM refining_lots WHERE id = ?').get(id) as any;
    if (!lot) throw new Error(`refining lot ${id} not found`);
    if (lot.status !== 'sent') throw new Error(`lot ${lot.slip_no} is ${lot.status}, cannot cancel`);
    const ts = Math.floor(Date.now() / 1000);

    // contra: put shop metal back
    db.prepare(
      `INSERT INTO metal_ledger (ts, ref_type, ref_id, party_id, category, stamp, debit_mg, credit_mg, note, reverses_id)
       VALUES (?, 'refining_cancel', ?, ?, ?, ?, ?, 0, ?,
               (SELECT id FROM metal_ledger WHERE ref_type='refining_send' AND ref_id=? LIMIT 1))`,
    ).run(
      ts, lot.id, lot.refiner_party_id,
      lot.sent_category, lot.sent_stamp, lot.sent_weight_mg,
      `cancel refining ${lot.slip_no}`, lot.id,
    );
    // clear refiner's metal debt
    db.prepare(
      `INSERT INTO party_ledger (ts, party_id, ref_type, ref_id, kind, category, stamp, debit, credit, note, reverses_id)
       VALUES (?, ?, 'refining_cancel', ?, 'metal', ?, ?, 0, ?, ?,
               (SELECT id FROM party_ledger WHERE ref_type='refining_send' AND ref_id=? LIMIT 1))`,
    ).run(
      ts, lot.refiner_party_id, lot.id,
      lot.sent_category, lot.sent_stamp, lot.sent_weight_mg,
      `cancel refining ${lot.slip_no}`, lot.id,
    );

    db.prepare('UPDATE refining_lots SET status = ?, received_at = ? WHERE id = ?').run('cancelled', ts, lot.id);
    return { id: lot.id };
  })();
}
