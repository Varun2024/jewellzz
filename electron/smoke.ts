import type Database from 'better-sqlite3';
import { getDb } from './db';
import { postSale, postPurchase } from './txn';
import { postKarigarIssue, postKarigarReceipt, payKarigar } from './karigar';
import { runBackupNow } from './backup';
import { printSaleInvoice } from './print';
import { writeCsvSales, writeCsvPurchases } from './export';
import { computeGstr1, computeGstr3b, computeHsnSummary, writeGstr1Csv, writeGstr3bCsv, writeHsnCsv } from './gst';

// ponytail: one long script, each step wrapped in a step() helper.
// Idempotent-ish: uses unique names so re-runs don't collide.

export type SmokeStep = { name: string; ok: boolean; ms: number; detail?: string };

export async function runSmokeTest(): Promise<{ steps: SmokeStep[]; passed: number; failed: number }> {
  const db = getDb();
  const steps: SmokeStep[] = [];
  const run = 'S' + Math.floor(Date.now() / 1000).toString(36).toUpperCase();

  async function step(name: string, fn: () => any | Promise<any>) {
    const t0 = Date.now();
    try {
      const detail = await fn();
      steps.push({ name, ok: true, ms: Date.now() - t0, detail: detail ? String(detail) : undefined });
    } catch (e: any) {
      steps.push({ name, ok: false, ms: Date.now() - t0, detail: e?.message ?? String(e) });
    }
  }

  // ── company baseline
  await step('company: ensure state code set', () => {
    let c = db.prepare('SELECT id, state_code FROM companies ORDER BY id LIMIT 1').get() as any;
    if (!c) {
      db.prepare(`INSERT INTO companies (name, gstin, state_code) VALUES ('Jewelzz Demo Jewellers', '00AAAAA0000A1Z0', '27')`).run();
      c = db.prepare('SELECT id, state_code FROM companies ORDER BY id LIMIT 1').get();
      return `created company id=${c.id} state=${c.state_code}`;
    }
    if (!c.state_code || c.state_code === '00') {
      db.prepare('UPDATE companies SET state_code = ? WHERE id = ?').run('27', c.id);
      return 'set state=27';
    }
    return `state=${c.state_code}`;
  });

  // ── party creation (customer intra-state, customer inter-state, supplier)
  let customerId = 0, interCustomerId = 0, supplierId = 0;
  await step('party: create intrastate customer', () => {
    const co = db.prepare('SELECT state_code FROM companies LIMIT 1').get() as any;
    const r = db.prepare(
      `INSERT INTO parties (name, role, state_code, phone, address) VALUES (?, 'customer', ?, ?, ?) RETURNING id`,
    ).get(`Smoke Intra ${run}`, co.state_code, '9999900001', 'Test addr') as any;
    customerId = r.id;
    return `id=${customerId}`;
  });
  await step('party: create interstate customer', () => {
    const r = db.prepare(
      `INSERT INTO parties (name, role, state_code, phone) VALUES (?, 'customer', '29', ?) RETURNING id`,
    ).get(`Smoke Inter ${run}`, '9999900002') as any;
    interCustomerId = r.id;
    return `id=${interCustomerId}`;
  });
  await step('party: create supplier', () => {
    const co = db.prepare('SELECT state_code FROM companies LIMIT 1').get() as any;
    const r = db.prepare(
      `INSERT INTO parties (name, role, state_code) VALUES (?, 'supplier', ?) RETURNING id`,
    ).get(`Smoke Supplier ${run}`, co.state_code) as any;
    supplierId = r.id;
    return `id=${supplierId}`;
  });

  // ── item creation across all 4 categories
  const items: Record<string, number> = {};
  const mk = (sku: string, name: string, category: string, unit: string, stamp: string | null,
              labourMode: string, labourValue: number, wastageMode: string, wastageValue: number) => {
    const r = db.prepare(
      `INSERT INTO items (sku, name, category, unit, stamp, hsn, gst_bp,
                          labour_mode, labour_value, wastage_mode, wastage_value)
       VALUES (?, ?, ?, ?, ?, ?, 300, ?, ?, ?, ?) RETURNING id`,
    ).get(sku, name, category, unit, stamp, category === 'stone' ? '7102' : '7113',
          labourMode, labourValue, wastageMode, wastageValue) as any;
    return r.id;
  };
  await step('item: gold 22k', () => { items.gold = mk(`SM-G-${run}`, `Smoke Gold ${run}`, 'gold', 'gms', '22k', 'pct', 1200, 'pct', 200); return items.gold; });
  await step('item: silver 925', () => { items.silver = mk(`SM-S-${run}`, `Smoke Silver ${run}`, 'silver', 'gms', '925', 'per_gram', 5000, 'per_gram', 500); return items.silver; });
  await step('item: stone carat', () => { items.stone = mk(`SM-D-${run}`, `Smoke Stone ${run}`, 'stone', 'carat', null, 'per_pcs', 500000, 'per_pcs', 0); return items.stone; });
  await step('item: artificial pcs', () => { items.art = mk(`SM-A-${run}`, `Smoke Art ${run}`, 'artificial', 'pcs', null, 'per_pcs', 20000, 'per_pcs', 0); return items.art; });

  await step('item constraint: reject stamp on stone', () => {
    try {
      db.prepare(`INSERT INTO items (sku, name, category, unit, stamp, labour_mode, wastage_mode) VALUES ('BAD','x','stone','carat','22k','per_pcs','per_pcs')`).run();
      throw new Error('constraint should have blocked stamp on stone');
    } catch (e: any) {
      if (!/CHECK/.test(e.message)) throw e;
      return 'CHECK triggered';
    }
  });
  await step('item constraint: reject missing stamp on gold', () => {
    try {
      db.prepare(`INSERT INTO items (sku, name, category, unit, labour_mode, wastage_mode) VALUES ('BAD2','x','gold','gms','pct','pct')`).run();
      throw new Error('should have blocked missing stamp on gold');
    } catch (e: any) {
      if (!/CHECK/.test(e.message)) throw e;
      return 'CHECK triggered';
    }
  });

  // ── FTS5 search
  await step('search: FTS5 finds item by prefix', () => {
    const rows = db.prepare(
      `SELECT i.id FROM items_fts f JOIN items i ON i.id = f.rowid WHERE items_fts MATCH ? LIMIT 5`,
    ).all(`"Smoke"* "Gold"*`) as any[];
    if (rows.length === 0) throw new Error('no hits');
    return `${rows.length} hit(s)`;
  });
  await step('search: FTS5 finds party by prefix', () => {
    const rows = db.prepare(
      `SELECT p.id FROM parties_fts f JOIN parties p ON p.id = f.rowid WHERE parties_fts MATCH ? LIMIT 5`,
    ).all(`"Smoke"* "Intra"*`) as any[];
    if (rows.length === 0) throw new Error('no hits');
    return `${rows.length} hit(s)`;
  });

  // ── stock adjustment (populate opening stock for gold + silver)
  await step('stock: adjust gold +25g / +5 pcs', () => {
    db.transaction(() => {
      db.prepare(`INSERT INTO stock_adjustments (item_id, delta_qty, delta_wt_mg, reason, actor) VALUES (?, 5, 25000, 'smoke opening', 'smoke')`).run(items.gold);
      db.prepare(`UPDATE items SET stock_qty = stock_qty + 5, stock_wt_mg = stock_wt_mg + 25000 WHERE id = ?`).run(items.gold);
    })();
    const it = db.prepare('SELECT stock_qty, stock_wt_mg FROM items WHERE id = ?').get(items.gold) as any;
    if (it.stock_qty < 5 || it.stock_wt_mg < 25000) throw new Error(`unexpected stock ${JSON.stringify(it)}`);
    return `qty=${it.stock_qty} wt_mg=${it.stock_wt_mg}`;
  });
  await step('stock: adjust silver +100g / +10 pcs', () => {
    db.transaction(() => {
      db.prepare(`INSERT INTO stock_adjustments (item_id, delta_qty, delta_wt_mg, reason, actor) VALUES (?, 10, 100000, 'smoke opening', 'smoke')`).run(items.silver);
      db.prepare(`UPDATE items SET stock_qty = stock_qty + 10, stock_wt_mg = stock_wt_mg + 100000 WHERE id = ?`).run(items.silver);
    })();
    return 'ok';
  });

  // ── purchase (metal-in) + verify metal ledger + party balance
  let purchaseId = 0;
  await step('purchase: post gold purchase 50g @ 5500', async () => {
    const res = postPurchase(db, {
      partyId: supplierId,
      refNo: `PO-${run}`,
      notes: 'smoke purchase',
      paidCashPaise: 10000000,   // ₹1,00,000
      paidBankPaise: 0,
      lines: [{
        itemId: items.gold,
        description: 'Gold bar 22k',
        category: 'gold', unit: 'gms', stamp: '22k', hsn: '7113',
        qty: 1, weightMg: 50000, ratePaise: 550000, gstBp: 300,
      }],
    });
    purchaseId = res.id;
    // total = 50 * 5500 = 275000. +3% GST = 275000 * 0.03 = 8250. total = 283250. balance = 283250 - 100000 = 183250
    if (res.totalPaise !== 27500000 + 825000) throw new Error(`total mismatch: ${res.totalPaise}`);
    if (res.balancePaise !== res.totalPaise - 10000000) throw new Error(`balance mismatch: ${res.balancePaise}`);
    return `total=${res.totalPaise} bal=${res.balancePaise}`;
  });

  await step('metal ledger: gold-22k has +50000mg from purchase', () => {
    const row = db.prepare(
      `SELECT SUM(debit_mg) as inMg, SUM(credit_mg) as outMg FROM metal_ledger WHERE category='gold' AND stamp='22k'`,
    ).get() as any;
    const bal = (row.inMg ?? 0) - (row.outMg ?? 0);
    if (bal < 50000) throw new Error(`bal=${bal}mg (expected >=50000)`);
    return `net=${bal}mg`;
  });

  await step('items table: gold stock reflects purchase', () => {
    const it = db.prepare('SELECT stock_qty, stock_wt_mg FROM items WHERE id = ?').get(items.gold) as any;
    // opening 5/25g + purchase 1/50g = 6 qty / 75g
    if (it.stock_qty !== 6 || it.stock_wt_mg !== 75000) throw new Error(`stock ${JSON.stringify(it)}`);
    return `qty=${it.stock_qty} wt=${it.stock_wt_mg}mg`;
  });

  // ── sale (intra-state, multi-line, cash + bank + old-gold)
  let saleId = 0, billNo = '';
  await step('sale: post intra-state sale (gold + silver + stone) with cash+bank+old-gold', async () => {
    const res = postSale(db, {
      partyId: customerId,
      notes: 'smoke sale',
      discountPaise: 0,
      roundOffPaise: 0,
      lines: [
        {
          itemId: items.gold,
          description: 'Gold chain 22k',
          category: 'gold', unit: 'gms', stamp: '22k', hsn: '7113',
          qty: 1, weightMg: 10000, ratePaise: 600000,   // 10g @ ₹6000 = 60,000
          makingMode: 'pct', makingValue: 1200,          // 12% = 7200
          wastageMode: 'pct', wastageValue: 200,         // 2% = 1200
          gstBp: 300,
        },
        {
          itemId: items.silver,
          description: 'Silver ring 925',
          category: 'silver', unit: 'gms', stamp: '925', hsn: '7113',
          qty: 1, weightMg: 20000, ratePaise: 8000,      // 20g @ ₹80 = 1600
          makingMode: 'per_gram', makingValue: 5000,     // ₹50/g * 20g = 1000
          wastageMode: 'per_gram', wastageValue: 500,    // ₹5/g * 20g = 100
          gstBp: 300,
        },
        {
          itemId: items.stone,
          description: 'Solitaire 0.5ct',
          category: 'stone', unit: 'carat', stamp: null, hsn: '7102',
          qty: 1, weightMg: 100, ratePaise: 500000,      // 0.5ct * ₹5000/ct = 2500
          makingMode: 'per_pcs', makingValue: 50000,     // ₹500 * 1 = 500
          wastageMode: 'per_pcs', wastageValue: 0,
          gstBp: 300,
        },
      ],
      payments: [
        { kind: 'cash', amountPaise: 3000000 },
        { kind: 'bank', amountPaise: 3000000, note: 'UPI' },
        { kind: 'old_gold', metalCategory: 'gold', metalStamp: '22k', metalWeightMg: 2000, metalRatePaise: 550000 }, // 2g @ ₹5500 = 11000
      ],
    });
    saleId = res.id;
    billNo = res.billNo;
    // gold line: metal 60000 + making 7200 + wastage 1200 = 68400. gst = round(68400*0.03) = 2052
    // silver: 1600+1000+100=2700. gst=81.
    // stone: 2500+500+0=3000. gst=90.
    // subtotal = 68400+2700+3000 = 74100. gst_sum = 2223. total = 76323
    // paid = 30000 (cash) + 30000 (bank) + 11000 (old-gold) = 71000. balance = 5323
    if (res.totalPaise !== 7632300) throw new Error(`total=${res.totalPaise} expected 7632300`);
    if (res.balancePaise !== 532300) throw new Error(`balance=${res.balancePaise} expected 532300`);
    return `${res.billNo} total=${res.totalPaise} bal=${res.balancePaise}`;
  });

  await step('sale: cgst+sgst split (no igst) intra-state', () => {
    const s = db.prepare('SELECT cgst_paise, sgst_paise, igst_paise FROM sales WHERE id = ?').get(saleId) as any;
    if (s.igst_paise !== 0) throw new Error(`igst=${s.igst_paise}, expected 0`);
    if (s.cgst_paise + s.sgst_paise === 0) throw new Error('cgst+sgst is zero');
    return `cgst=${s.cgst_paise} sgst=${s.sgst_paise}`;
  });

  await step('cash ledger: sale added ₹30000 cash-in', () => {
    const row = db.prepare(
      `SELECT SUM(debit_paise) - SUM(credit_paise) as bal FROM cash_ledger WHERE ref_type='sale' AND ref_id=?`,
    ).get(saleId) as any;
    if (row.bal !== 3000000) throw new Error(`cash net=${row.bal} expected 3000000`);
    return `net=${row.bal}`;
  });

  await step('metal ledger: gold-22k credited 10g, debited 2g old-gold, silver-925 credited 20g, stone credited 0.5ct(=100mg)', () => {
    const g = db.prepare(`SELECT SUM(credit_mg) c, SUM(debit_mg) d FROM metal_ledger WHERE category='gold' AND stamp='22k' AND ref_id=?`).get(saleId) as any;
    if (g.c !== 10000) throw new Error(`gold out ${g.c}, expected 10000`);
    if (g.d !== 2000) throw new Error(`gold in ${g.d}, expected 2000`);
    const s = db.prepare(`SELECT SUM(credit_mg) c FROM metal_ledger WHERE category='silver' AND stamp='925' AND ref_id=?`).get(saleId) as any;
    if (s.c !== 20000) throw new Error(`silver out ${s.c}, expected 20000`);
    const st = db.prepare(`SELECT SUM(credit_mg) c FROM metal_ledger WHERE category='stone' AND ref_id=?`).get(saleId) as any;
    if (st.c !== 100) throw new Error(`stone out ${st.c}, expected 100`);
    return 'all buckets correct';
  });

  await step('party ledger: customer owes balance', () => {
    const row = db.prepare(
      `SELECT SUM(debit) - SUM(credit) as bal FROM party_ledger WHERE party_id=? AND kind='cash'`,
    ).get(customerId) as any;
    if (row.bal !== 532300) throw new Error(`party cash bal=${row.bal} expected 532300`);
    return `bal=${row.bal}`;
  });

  await step('items table: sale decremented gold stock', () => {
    const it = db.prepare('SELECT stock_qty, stock_wt_mg FROM items WHERE id = ?').get(items.gold) as any;
    // before sale: 6/75g, sold 1/10g → 5/65g
    if (it.stock_qty !== 5 || it.stock_wt_mg !== 65000) throw new Error(`stock ${JSON.stringify(it)}`);
    return `qty=${it.stock_qty} wt=${it.stock_wt_mg}mg`;
  });

  // ── interstate sale → IGST path
  await step('sale: post interstate sale (silver only)', async () => {
    const res = postSale(db, {
      partyId: interCustomerId,
      notes: 'smoke inter',
      discountPaise: 0,
      roundOffPaise: 0,
      lines: [{
        itemId: items.silver,
        description: 'Silver bracelet',
        category: 'silver', unit: 'gms', stamp: '925', hsn: '7113',
        qty: 1, weightMg: 10000, ratePaise: 8000,
        makingMode: 'per_gram', makingValue: 5000,
        wastageMode: 'per_gram', wastageValue: 500,
        gstBp: 300,
      }],
      payments: [],
    });
    const s = db.prepare('SELECT interstate, cgst_paise, sgst_paise, igst_paise FROM sales WHERE id = ?').get(res.id) as any;
    if (!s.interstate) throw new Error('interstate flag not set');
    if (s.igst_paise === 0) throw new Error('igst is zero');
    if (s.cgst_paise !== 0 || s.sgst_paise !== 0) throw new Error('cgst/sgst should be zero');
    return `igst=${s.igst_paise}`;
  });

  // ── karigar cycle: create, issue, receipt (settles + wastage + labour), pay
  let karigarId = 0, issueId = 0, receiptId = 0;
  await step('karigar: create', () => {
    const r = db.prepare(
      `INSERT INTO karigars (name, phone, default_labour_mode, default_labour_value)
       VALUES (?, ?, 'per_gram', 5000) RETURNING id`,
    ).get(`Smoke Karigar ${run}`, '9999900003') as any;
    karigarId = r.id;
    return `id=${karigarId}`;
  });

  await step('karigar: issue 20g gold-22k', () => {
    const r = postKarigarIssue(db, {
      karigarId,
      purpose: 'smoke test',
      notes: '',
      lines: [{ category: 'gold', stamp: '22k', weightMg: 20000, note: '' }],
    });
    issueId = r.id;
    return `${r.slipNo}`;
  });

  await step('karigar ledger: karigar owes 20g gold-22k', () => {
    const row = db.prepare(
      `SELECT SUM(debit)-SUM(credit) AS bal FROM karigar_ledger WHERE karigar_id=? AND kind='metal' AND category='gold' AND stamp='22k'`,
    ).get(karigarId) as any;
    if (row.bal !== 20000) throw new Error(`bal=${row.bal} expected 20000`);
    return `bal=${row.bal}mg`;
  });

  await step('metal ledger: shop metal -20g gold-22k from issue', () => {
    const row = db.prepare(
      `SELECT SUM(credit_mg) AS out FROM metal_ledger WHERE ref_type='karigar_issue' AND ref_id=? AND category='gold' AND stamp='22k'`,
    ).get(issueId) as any;
    if (row.out !== 20000) throw new Error(`out=${row.out} expected 20000`);
    return `out=${row.out}mg`;
  });

  await step('karigar: receive 19g finished + 1g wastage + ₹5000 labour', () => {
    const r = postKarigarReceipt(db, {
      karigarId,
      relatedIssueId: issueId,
      labourPaise: 500000,
      notes: '',
      lines: [{
        itemId: null,
        category: 'gold', stamp: '22k',
        qty: 0, weightMg: 19000, wastageMg: 1000, note: '',
      }],
    });
    receiptId = r.id;
    return `${r.slipNo}`;
  });

  await step('karigar ledger: metal debt now zero (received+wastage=issued)', () => {
    const row = db.prepare(
      `SELECT SUM(debit)-SUM(credit) AS bal FROM karigar_ledger WHERE karigar_id=? AND kind='metal' AND category='gold' AND stamp='22k'`,
    ).get(karigarId) as any;
    if (row.bal !== 0) throw new Error(`bal=${row.bal} expected 0`);
    return `bal=0`;
  });

  await step('karigar ledger: cash credit ₹5000 (shop owes labour)', () => {
    const row = db.prepare(
      `SELECT SUM(debit)-SUM(credit) AS bal FROM karigar_ledger WHERE karigar_id=? AND kind='cash'`,
    ).get(karigarId) as any;
    if (row.bal !== -500000) throw new Error(`bal=${row.bal} expected -500000`);
    return `bal=${row.bal}`;
  });

  await step('metal ledger: shop metal +19g gold-22k from receipt (wastage NOT re-credited)', () => {
    const row = db.prepare(
      `SELECT SUM(debit_mg) AS inMg FROM metal_ledger WHERE ref_type='karigar_receipt' AND ref_id=? AND category='gold' AND stamp='22k'`,
    ).get(receiptId) as any;
    if (row.inMg !== 19000) throw new Error(`in=${row.inMg} expected 19000`);
    return `in=${row.inMg}mg`;
  });

  await step('karigar: pay labour ₹5000, cash balance zero', () => {
    payKarigar(db, { karigarId, amountPaise: 500000, note: 'smoke pay' });
    const row = db.prepare(
      `SELECT SUM(debit)-SUM(credit) AS bal FROM karigar_ledger WHERE karigar_id=? AND kind='cash'`,
    ).get(karigarId) as any;
    if (row.bal !== 0) throw new Error(`bal=${row.bal} expected 0`);
    return 'settled';
  });

  await step('cash ledger: karigar_pay recorded ₹5000 out', () => {
    const row = db.prepare(
      `SELECT SUM(credit_paise) AS out FROM cash_ledger WHERE ref_type='karigar_pay'`,
    ).get() as any;
    if ((row.out ?? 0) < 500000) throw new Error(`out=${row.out} expected >=500000`);
    return `out=${row.out}`;
  });

  // ── print + exports + backup
  await step('print: A5 invoice PDF written', async () => {
    const r = await printSaleInvoice(db, saleId);
    if (!r.path.endsWith('.pdf')) throw new Error(`bad path ${r.path}`);
    return r.path;
  });

  await step('export: sales CSV', () => {
    const r = writeCsvSales(db, {});
    return r.path;
  });
  await step('export: purchases CSV', () => {
    const r = writeCsvPurchases(db, {});
    return r.path;
  });

  // ── GST reports across the smoke's own sales window
  await step('gst: GSTR-1 view returns rows including smoke sale', () => {
    const rows = computeGstr1(db, {});
    const hit = rows.find((r) => r.billNo === billNo);
    if (!hit) throw new Error('smoke sale missing from GSTR-1');
    // intrastate: cgst+sgst != 0, igst == 0
    if (hit.igstPaise !== 0) throw new Error(`igst=${hit.igstPaise}, expected 0`);
    if (hit.cgstPaise + hit.sgstPaise === 0) throw new Error('cgst+sgst is zero');
    return `${rows.length} rows total`;
  });
  await step('gst: GSTR-3B outward totals reconcile', () => {
    const s = computeGstr3b(db, {});
    // sum of taxable = subtotal_paise of all sales; sum of cgst+sgst+igst matches sales header sums
    const row = db.prepare(
      `SELECT COALESCE(SUM(subtotal_paise),0) as t, COALESCE(SUM(cgst_paise),0) as c,
              COALESCE(SUM(sgst_paise),0) as s, COALESCE(SUM(igst_paise),0) as i
       FROM sales`,
    ).get() as any;
    if (s.outward.taxablePaise !== row.t) throw new Error(`taxable mismatch: ${s.outward.taxablePaise} vs ${row.t}`);
    if (s.outward.cgstPaise !== row.c || s.outward.sgstPaise !== row.s || s.outward.igstPaise !== row.i) {
      throw new Error('gst breakdown mismatch');
    }
    return `taxable=${s.outward.taxablePaise} cgst=${s.outward.cgstPaise} sgst=${s.outward.sgstPaise} igst=${s.outward.igstPaise}`;
  });
  await step('gst: HSN summary rows exist for smoke sale lines', () => {
    const rows = computeHsnSummary(db, {});
    if (rows.length === 0) throw new Error('empty hsn summary');
    return `${rows.length} hsn rows`;
  });
  await step('gst: CSV exports write files', () => {
    const base = (p: string) => p.split(/[\\/]/).pop() ?? p;
    const a = writeGstr1Csv(db, {});
    const b = writeGstr3bCsv(db, {});
    const c = writeHsnCsv(db, {});
    return `${base(a.path)} · ${base(b.path)} · ${base(c.path)}`;
  });

  await step('backup: manual backup', async () => {
    const r = await runBackupNow();
    if (r.bytes < 1024) throw new Error(`suspiciously small: ${r.bytes}`);
    return `${(r.bytes / 1024).toFixed(1)}KiB`;
  });

  // ── final invariant: sum(subtotal+gst-discount+roundoff) equals sum(sales.total_paise)
  await step('invariant: sales totals reconcile', () => {
    const rows = db.prepare(
      `SELECT subtotal_paise+cgst_paise+sgst_paise+igst_paise-discount_paise+round_off_paise AS computed, total_paise FROM sales`,
    ).all() as any[];
    const mismatches = rows.filter((r) => r.computed !== r.total_paise);
    if (mismatches.length) throw new Error(`${mismatches.length} sales rows fail reconciliation`);
    return `${rows.length} sales ok`;
  });

  // ── cleanup smoke rows so re-runs stay clean
  await step('cleanup: remove smoke test rows', () => {
    const parties = [customerId, interCustomerId, supplierId].filter(Boolean);
    const itemIds = Object.values(items).filter(Boolean);
    const karigars = [karigarId].filter(Boolean);
    db.transaction(() => {
      db.prepare(`DELETE FROM sale_payments WHERE sale_id IN (SELECT id FROM sales WHERE party_id IN (${parties.join(',')}))`).run();
      db.prepare(`DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE party_id IN (${parties.join(',')}))`).run();
      db.prepare(`DELETE FROM sales WHERE party_id IN (${parties.join(',')})`).run();
      db.prepare(`DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE party_id IN (${parties.join(',')}))`).run();
      db.prepare(`DELETE FROM purchases WHERE party_id IN (${parties.join(',')})`).run();
      db.prepare(`DELETE FROM cash_ledger WHERE party_id IN (${parties.join(',')}) OR ref_type='karigar_pay'`).run();
      db.prepare(`DELETE FROM metal_ledger WHERE party_id IN (${parties.join(',')}) OR ref_type IN ('karigar_issue','karigar_receipt')`).run();
      db.prepare(`DELETE FROM party_ledger WHERE party_id IN (${parties.join(',')})`).run();
      db.prepare(`DELETE FROM stock_adjustments WHERE item_id IN (${itemIds.join(',')})`).run();
      if (karigars.length) {
        db.prepare(`DELETE FROM karigar_ledger WHERE karigar_id IN (${karigars.join(',')})`).run();
        db.prepare(`DELETE FROM karigar_receipt_items WHERE receipt_id IN (SELECT id FROM karigar_receipts WHERE karigar_id IN (${karigars.join(',')}))`).run();
        db.prepare(`DELETE FROM karigar_receipts WHERE karigar_id IN (${karigars.join(',')})`).run();
        db.prepare(`DELETE FROM karigar_issue_items WHERE issue_id IN (SELECT id FROM karigar_issues WHERE karigar_id IN (${karigars.join(',')}))`).run();
        db.prepare(`DELETE FROM karigar_issues WHERE karigar_id IN (${karigars.join(',')})`).run();
        db.prepare(`DELETE FROM karigars WHERE id IN (${karigars.join(',')})`).run();
      }
      db.prepare(`DELETE FROM parties WHERE id IN (${parties.join(',')})`).run();
      db.prepare(`DELETE FROM items WHERE id IN (${itemIds.join(',')})`).run();
    })();
    return `${parties.length} parties + ${itemIds.length} items + ${karigars.length} karigars removed`;
  });

  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.length - passed;
  return { steps, passed, failed };
}
