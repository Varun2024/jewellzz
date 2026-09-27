import type Database from 'better-sqlite3';
import type { SaleInput, PurchaseInput, SaleLineInput, PurchaseLineInput } from '../shared/ipc';

// ponytail: money math kept as ints throughout. `Math.round` at each division; MVP doesn't hit BigInt-scale amounts.

const GST_BP_DIV = 10000; // basis points → fraction

// ─── per-line math ─────────────────────────────────────────────────────
type LineComp = {
  metalPaise: number;
  makingPaise: number;
  wastagePaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
};

function mgPerUnit(unit: string): number {
  if (unit === 'gms') return 1000;
  if (unit === 'carat') return 200;
  return 0; // pcs — no weight math
}

function computeLine(l: SaleLineInput | PurchaseLineInput, interstate: boolean): LineComp {
  let metal: number;
  if (l.unit === 'pcs') {
    metal = Math.round(l.qty * l.ratePaise);
  } else {
    const div = mgPerUnit(l.unit);
    metal = Math.round((l.weightMg * l.ratePaise) / div);
  }

  const making = 'makingMode' in l ? applyCharge(l.makingMode, l.makingValue, metal, l.weightMg, l.qty) : 0;
  const wastage = 'wastageMode' in l ? applyCharge(l.wastageMode, l.wastageValue, metal, l.weightMg, l.qty) : 0;

  const taxable = metal + making + wastage;
  const gst = Math.round((taxable * l.gstBp) / GST_BP_DIV);
  const cgst = interstate ? 0 : Math.round(gst / 2);
  const sgst = interstate ? 0 : gst - cgst;
  const igst = interstate ? gst : 0;
  const total = taxable + cgst + sgst + igst;

  return {
    metalPaise: metal,
    makingPaise: making,
    wastagePaise: wastage,
    taxablePaise: taxable,
    cgstPaise: cgst,
    sgstPaise: sgst,
    igstPaise: igst,
    totalPaise: total,
  };
}

function applyCharge(mode: string, value: number, metalPaise: number, weightMg: number, qty: number): number {
  if (mode === 'pct') return Math.round((metalPaise * value) / GST_BP_DIV);
  if (mode === 'per_gram') return Math.round((value * weightMg) / 1000);
  if (mode === 'per_pcs') return value * qty;
  return 0;
}

// ─── SALE ───────────────────────────────────────────────────────────────
export function postSale(db: Database.Database, sale: SaleInput): { id: number; billNo: string; totalPaise: number; balancePaise: number } {
  return db.transaction(() => {
    // resolve company state + party state to decide interstate
    const company = db.prepare('SELECT state_code FROM companies LIMIT 1').get() as { state_code: string } | undefined;
    const party = db.prepare('SELECT state_code, name FROM parties WHERE id = ?').get(sale.partyId) as { state_code: string; name: string } | undefined;
    if (!party) throw new Error(`party ${sale.partyId} not found`);
    const interstate = !!(company && party.state_code && company.state_code !== party.state_code) ? 1 : 0;

    // compute line totals
    const comps = sale.lines.map((l) => computeLine(l, !!interstate));
    const subtotal = comps.reduce((s, c) => s + c.taxablePaise, 0);
    const cgst = comps.reduce((s, c) => s + c.cgstPaise, 0);
    const sgst = comps.reduce((s, c) => s + c.sgstPaise, 0);
    const igst = comps.reduce((s, c) => s + c.igstPaise, 0);
    const total = subtotal + cgst + sgst + igst - sale.discountPaise + sale.roundOffPaise;

    // payments
    let paidCash = 0, paidBank = 0, oldGoldValue = 0;
    for (const p of sale.payments) {
      if (p.kind === 'cash') paidCash += p.amountPaise;
      else if (p.kind === 'bank') paidBank += p.amountPaise;
      else if (p.kind === 'old_gold') oldGoldValue += Math.round((p.metalWeightMg * p.metalRatePaise) / 1000);
    }
    const balance = total - paidCash - paidBank - oldGoldValue;

    // bill number (monotonic from settings)
    const prefix = getSetting(db, 'bill_prefix', 'INV-');
    const next = parseInt(getSetting(db, 'bill_next_no', '1'), 10);
    const billNo = `${prefix}${String(next).padStart(4, '0')}`;
    setSetting(db, 'bill_next_no', String(next + 1));

    const ts = sale.ts ?? Math.floor(Date.now() / 1000);

    const saleRow = db.prepare(
      `INSERT INTO sales (bill_no, ts, party_id, party_state, interstate,
                          subtotal_paise, cgst_paise, sgst_paise, igst_paise,
                          discount_paise, round_off_paise, total_paise,
                          paid_cash_paise, paid_bank_paise, old_gold_value_paise,
                          balance_paise, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
    ).get(billNo, ts, sale.partyId, party.state_code, interstate,
          subtotal, cgst, sgst, igst,
          sale.discountPaise, sale.roundOffPaise, total,
          paidCash, paidBank, oldGoldValue,
          balance, sale.notes) as { id: number };

    // insert lines + update stock + write metal_ledger credits
    const insertLine = db.prepare(
      `INSERT INTO sale_items (sale_id, item_id, description, category, unit, stamp, hsn,
                               qty, weight_mg, rate_paise,
                               making_mode, making_value, making_paise,
                               wastage_mode, wastage_value, wastage_paise,
                               taxable_paise, gst_bp, cgst_paise, sgst_paise, igst_paise, total_paise)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const decStock = db.prepare(
      `UPDATE items SET stock_qty = stock_qty - ?, stock_wt_mg = stock_wt_mg - ?, updated_at = unixepoch()
       WHERE id = ?`);
    const insertMetal = db.prepare(
      `INSERT INTO metal_ledger (ts, ref_type, ref_id, party_id, category, stamp, debit_mg, credit_mg, note)
       VALUES (?, 'sale', ?, ?, ?, ?, 0, ?, ?)`);

    for (let i = 0; i < sale.lines.length; i++) {
      const l = sale.lines[i]; const c = comps[i];
      insertLine.run(saleRow.id, l.itemId, l.description, l.category, l.unit, l.stamp, l.hsn,
        l.qty, l.weightMg, l.ratePaise,
        l.makingMode, l.makingValue, c.makingPaise,
        l.wastageMode, l.wastageValue, c.wastagePaise,
        c.taxablePaise, l.gstBp, c.cgstPaise, c.sgstPaise, c.igstPaise, c.totalPaise);
      decStock.run(l.qty, l.weightMg, l.itemId);
      if (l.weightMg > 0 && (l.category === 'gold' || l.category === 'silver' || l.category === 'stone')) {
        insertMetal.run(ts, saleRow.id, sale.partyId, l.category, l.stamp ?? '', l.weightMg, `sale ${billNo}`);
      }
    }

    // sale_payments + cash_ledger + metal_ledger debits (old-gold)
    const insertPay = db.prepare(
      `INSERT INTO sale_payments (sale_id, kind, amount_paise,
                                  metal_category, metal_stamp, metal_weight_mg, metal_rate_paise, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertCash = db.prepare(
      `INSERT INTO cash_ledger (ts, ref_type, ref_id, party_id, debit_paise, credit_paise, note)
       VALUES (?, 'sale', ?, ?, ?, 0, ?)`);
    const insertOldMetal = db.prepare(
      `INSERT INTO metal_ledger (ts, ref_type, ref_id, party_id, category, stamp, debit_mg, credit_mg, note)
       VALUES (?, 'sale-old-gold', ?, ?, ?, ?, ?, 0, ?)`);

    for (const p of sale.payments) {
      if (p.kind === 'cash') {
        insertPay.run(saleRow.id, 'cash', p.amountPaise, null, null, null, null, '');
        if (p.amountPaise > 0) insertCash.run(ts, saleRow.id, sale.partyId, p.amountPaise, `cash for ${billNo}`);
      } else if (p.kind === 'bank') {
        insertPay.run(saleRow.id, 'bank', p.amountPaise, null, null, null, null, p.note ?? '');
      } else {
        const v = Math.round((p.metalWeightMg * p.metalRatePaise) / 1000);
        insertPay.run(saleRow.id, 'old_gold', v, p.metalCategory, p.metalStamp, p.metalWeightMg, p.metalRatePaise, '');
        insertOldMetal.run(ts, saleRow.id, sale.partyId, p.metalCategory, p.metalStamp, p.metalWeightMg, `old-gold for ${billNo}`);
      }
    }

    // party_ledger: net cash balance
    if (balance !== 0) {
      db.prepare(
        `INSERT INTO party_ledger (ts, party_id, ref_type, ref_id, kind, debit, credit, note)
         VALUES (?, ?, 'sale', ?, 'cash', ?, ?, ?)`,
      ).run(
        ts, sale.partyId, saleRow.id,
        balance > 0 ? balance : 0,
        balance < 0 ? -balance : 0,
        `balance for ${billNo}`,
      );
    }

    return { id: saleRow.id, billNo, totalPaise: total, balancePaise: balance };
  })();
}

// ─── PURCHASE ───────────────────────────────────────────────────────────
export function postPurchase(db: Database.Database, p: PurchaseInput): { id: number; refNo: string; totalPaise: number; balancePaise: number } {
  return db.transaction(() => {
    const company = db.prepare('SELECT state_code FROM companies LIMIT 1').get() as { state_code: string } | undefined;
    const party = db.prepare('SELECT state_code FROM parties WHERE id = ?').get(p.partyId) as { state_code: string } | undefined;
    if (!party) throw new Error(`party ${p.partyId} not found`);
    const interstate = !!(company && party.state_code && company.state_code !== party.state_code) ? 1 : 0;

    const comps = p.lines.map((l) => computeLine(l, !!interstate));
    const subtotal = comps.reduce((s, c) => s + c.taxablePaise, 0);
    const cgst = comps.reduce((s, c) => s + c.cgstPaise, 0);
    const sgst = comps.reduce((s, c) => s + c.sgstPaise, 0);
    const igst = comps.reduce((s, c) => s + c.igstPaise, 0);
    const total = subtotal + cgst + sgst + igst;
    const balance = total - p.paidCashPaise - p.paidBankPaise;
    const ts = p.ts ?? Math.floor(Date.now() / 1000);

    const row = db.prepare(
      `INSERT INTO purchases (ref_no, ts, party_id, party_state, interstate,
                              subtotal_paise, cgst_paise, sgst_paise, igst_paise,
                              total_paise, paid_cash_paise, paid_bank_paise, balance_paise, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
    ).get(p.refNo, ts, p.partyId, party.state_code, interstate,
          subtotal, cgst, sgst, igst,
          total, p.paidCashPaise, p.paidBankPaise, balance, p.notes) as { id: number };

    const insertLine = db.prepare(
      `INSERT INTO purchase_items (purchase_id, item_id, description, category, unit, stamp, hsn,
                                   qty, weight_mg, rate_paise, taxable_paise, gst_bp,
                                   cgst_paise, sgst_paise, igst_paise, total_paise)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const incStock = db.prepare(
      `UPDATE items SET stock_qty = stock_qty + ?, stock_wt_mg = stock_wt_mg + ?, updated_at = unixepoch()
       WHERE id = ?`);
    const insertMetal = db.prepare(
      `INSERT INTO metal_ledger (ts, ref_type, ref_id, party_id, category, stamp, debit_mg, credit_mg, note)
       VALUES (?, 'purchase', ?, ?, ?, ?, ?, 0, ?)`);

    for (let i = 0; i < p.lines.length; i++) {
      const l = p.lines[i]; const c = comps[i];
      insertLine.run(row.id, l.itemId, l.description, l.category, l.unit, l.stamp, l.hsn,
        l.qty, l.weightMg, l.ratePaise, c.taxablePaise, l.gstBp,
        c.cgstPaise, c.sgstPaise, c.igstPaise, c.totalPaise);
      incStock.run(l.qty, l.weightMg, l.itemId);
      if (l.weightMg > 0 && (l.category === 'gold' || l.category === 'silver' || l.category === 'stone')) {
        insertMetal.run(ts, row.id, p.partyId, l.category, l.stamp ?? '', l.weightMg, `purchase ${p.refNo}`);
      }
    }

    // cash paid → shop cash out (credit)
    if (p.paidCashPaise > 0) {
      db.prepare(
        `INSERT INTO cash_ledger (ts, ref_type, ref_id, party_id, debit_paise, credit_paise, note)
         VALUES (?, 'purchase', ?, ?, 0, ?, ?)`,
      ).run(ts, row.id, p.partyId, p.paidCashPaise, `cash to supplier`);
    }

    if (balance !== 0) {
      db.prepare(
        `INSERT INTO party_ledger (ts, party_id, ref_type, ref_id, kind, debit, credit, note)
         VALUES (?, ?, 'purchase', ?, 'cash', ?, ?, ?)`,
      ).run(
        ts, p.partyId, row.id,
        balance < 0 ? -balance : 0,   // if shop overpaid → party owes shop (rare)
        balance > 0 ? balance : 0,    // shop owes party
        `balance for purchase ${p.refNo}`,
      );
    }

    return { id: row.id, refNo: p.refNo, totalPaise: total, balancePaise: balance };
  })();
}

// ─── settings helpers ───────────────────────────────────────────────────
function getSetting(db: Database.Database, key: string, fallback: string): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}
function setSetting(db: Database.Database, key: string, value: string): void {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}
