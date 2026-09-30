import type { IpcMain } from 'electron';
import { z } from 'zod';
import { getDb } from './db';
import { runBackupNow } from './backup';
import { postSale, postPurchase } from './txn';
import { postKarigarIssue, postKarigarReceipt, payKarigar, listKarigarBalances, readKarigarLedger } from './karigar';
import {
  createApproval, resolveApproval,
  createRepair, updateRepairStatus, deliverRepair,
  createOrder, receiveOrderAdvance, updateOrderStatus,
} from './pipelines';
import { sendRefiningLot, receiveRefiningLot, cancelRefiningLot } from './refining';
import { addPhotos, listItemPhotos, deletePhoto, setPrimaryPhoto, catalogGrid } from './photos';
import { printLabels } from './labels';
import { printSaleInvoice } from './print';
import {
  whoami, login, logout, listActiveUsers, listAllUsers,
  createUser, setUserPin, deactivateUser, assertRole, currentActor,
} from './auth';
import {
  CH,
  PartyInput,
  ItemInput,
  StockAdjustInput,
  SearchInput,
  SaleInput,
  PurchaseInput,
  LedgerRange,
  KarigarInput,
  KarigarIssueInput,
  KarigarReceiptInput,
  KarigarPayInput,
  MetalRateInput,
  ApprovalInput, ApprovalResolve,
  RepairInput, RepairDeliver, RepairStatusUpdate,
  OrderInput, OrderAdvance, OrderStatusUpdate,
  RefiningSend, RefiningReceive,
  type Party,
  type Item,
  type SearchHit,
} from '../shared/ipc';

// Channels that skip the auth gate (login flow, whoami before user picks account, cheap health probe).
const OPEN_CHANNELS: ReadonlySet<string> = new Set([
  'auth.list', 'auth.whoami', 'auth.login', 'app.ping',
]);

// Small helper: wrap a handler with zod validation + role gate.
function on<S extends z.ZodTypeAny, R>(
  ipc: IpcMain,
  channel: string,
  schema: S | null,
  fn: (input: z.infer<S>) => R,
): void {
  ipc.handle(channel, (_e, payload) => {
    if (!OPEN_CHANNELS.has(channel)) assertRole(channel);
    const input = schema ? schema.parse(payload) : (payload as z.infer<S>);
    return fn(input);
  });
}

function audit(
  entity: string,
  entityId: number | null,
  action: string,
  before: unknown,
  after: unknown,
): void {
  getDb()
    .prepare(
      `INSERT INTO audit_log (actor, entity, entity_id, action, before, after)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      currentActor(),
      entity,
      entityId,
      action,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
    );
}

// Rows come back with snake_case columns; map to camelCase for the API surface.
function mapParty(r: any): Party {
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    gstin: r.gstin,
    phone: r.phone,
    address: r.address,
    stateCode: r.state_code,
    openingCash: r.opening_cash,
    openingMetalMg: r.opening_metal_mg,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapItem(r: any): Item {
  return {
    id: r.id,
    sku: r.sku,
    name: r.name,
    category: r.category,
    unit: r.unit,
    stamp: r.stamp,
    hsn: r.hsn,
    gstBp: r.gst_bp,
    labourMode: r.labour_mode,
    labourValue: r.labour_value,
    wastageMode: r.wastage_mode,
    wastageValue: r.wastage_value,
    stockQty: r.stock_qty,
    stockWtMg: r.stock_wt_mg,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// Escape a user query for FTS5 so operator characters don't blow up the parser.
function toFtsQuery(q: string): string {
  const cleaned = q
    .trim()
    .replace(/["*()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (cleaned.length === 0) return '""';
  // prefix match on each token so typing feels live
  return cleaned.map((t) => `"${t}"*`).join(' ');
}

export function registerIpc(ipc: IpcMain): void {
  // ───────── auth (must come before role-gated channels)
  on(ipc, CH.authListUsers, null, () => listActiveUsers(getDb()));
  on(ipc, CH.authWhoami, null, () => whoami());
  on(
    ipc,
    CH.authLogin,
    z.object({ userId: z.number().int(), pin: z.string().min(4).max(8) }),
    ({ userId, pin }) => login(getDb(), userId, pin),
  );
  on(ipc, CH.authLogout, null, () => { logout(); return { ok: true }; });

  on(ipc, 'users.list' as string, null, () => listAllUsers(getDb()));
  on(
    ipc,
    CH.usersCreate,
    z.object({ name: z.string().min(1).max(60), role: z.enum(['owner', 'counter']), pin: z.string().regex(/^\d{4,8}$/) }),
    (p) => {
      const r = createUser(getDb(), p);
      audit('user', r.id, 'create', null, { name: p.name, role: p.role });
      return r;
    },
  );
  on(
    ipc,
    CH.usersSetPin,
    z.object({ id: z.number().int(), pin: z.string().regex(/^\d{4,8}$/) }),
    ({ id, pin }) => { setUserPin(getDb(), id, pin); audit('user', id, 'pin_change', null, null); return { ok: true }; },
  );
  on(
    ipc,
    CH.usersDeactivate,
    z.object({ id: z.number().int() }),
    ({ id }) => { deactivateUser(getDb(), id); audit('user', id, 'deactivate', null, null); return { ok: true }; },
  );

  // ───────── health + backup
  on(ipc, CH.ping, null, () => ({ ok: true, ts: Date.now() }));
  on(ipc, CH.backupNow, null, () => runBackupNow());

  // ───────── parties
  on(ipc, CH.partiesList, null, () => {
    return getDb().prepare('SELECT * FROM parties ORDER BY name').all().map(mapParty);
  });

  on(ipc, CH.partiesCreate, PartyInput, (p) => {
    const db = getDb();
    const row = db
      .prepare(
        `INSERT INTO parties (name, role, gstin, phone, address, state_code, opening_cash, opening_metal_mg)
         VALUES (@name, @role, @gstin, @phone, @address, @stateCode, @openingCash, @openingMetalMg)
         RETURNING *`,
      )
      .get({
        ...p,
        gstin: p.gstin ?? null,
        phone: p.phone ?? null,
      });
    audit('party', (row as any).id, 'insert', null, row);
    return mapParty(row);
  });

  on(
    ipc,
    CH.partiesUpdate,
    PartyInput.extend({ id: z.number().int() }),
    (p) => {
      const db = getDb();
      const before = db.prepare('SELECT * FROM parties WHERE id = ?').get(p.id);
      if (!before) throw new Error(`party ${p.id} not found`);
      const row = db
        .prepare(
          `UPDATE parties SET
             name=@name, role=@role, gstin=@gstin, phone=@phone,
             address=@address, state_code=@stateCode,
             opening_cash=@openingCash, opening_metal_mg=@openingMetalMg,
             updated_at=unixepoch()
           WHERE id=@id RETURNING *`,
        )
        .get({ ...p, gstin: p.gstin ?? null, phone: p.phone ?? null });
      audit('party', p.id, 'update', before, row);
      return mapParty(row);
    },
  );

  on(ipc, CH.partiesDelete, z.object({ id: z.number().int() }), ({ id }) => {
    const db = getDb();
    const before = db.prepare('SELECT * FROM parties WHERE id = ?').get(id);
    if (!before) return { ok: false };
    db.prepare('DELETE FROM parties WHERE id = ?').run(id);
    audit('party', id, 'delete', before, null);
    return { ok: true };
  });

  // ───────── items
  on(ipc, CH.itemsList, null, () => {
    return getDb().prepare('SELECT * FROM items ORDER BY name').all().map(mapItem);
  });

  on(ipc, CH.itemsCreate, ItemInput, (p) => {
    const db = getDb();
    const row = db
      .prepare(
        `INSERT INTO items (sku, name, category, unit, stamp, hsn, gst_bp,
                            labour_mode, labour_value, wastage_mode, wastage_value,
                            stock_qty, stock_wt_mg)
         VALUES (@sku, @name, @category, @unit, @stamp, @hsn, @gstBp,
                 @labourMode, @labourValue, @wastageMode, @wastageValue,
                 @stockQty, @stockWtMg)
         RETURNING *`,
      )
      .get({ ...p, stamp: p.stamp ?? null });
    audit('item', (row as any).id, 'insert', null, row);
    return mapItem(row);
  });

  on(
    ipc,
    CH.itemsUpdate,
    ItemInput.innerType().extend({ id: z.number().int() }),
    (p) => {
      const db = getDb();
      const before = db.prepare('SELECT * FROM items WHERE id = ?').get(p.id);
      if (!before) throw new Error(`item ${p.id} not found`);
      const row = db
        .prepare(
          `UPDATE items SET
             sku=@sku, name=@name, category=@category, unit=@unit, stamp=@stamp, hsn=@hsn,
             gst_bp=@gstBp,
             labour_mode=@labourMode, labour_value=@labourValue,
             wastage_mode=@wastageMode, wastage_value=@wastageValue,
             stock_qty=@stockQty, stock_wt_mg=@stockWtMg,
             updated_at=unixepoch()
           WHERE id=@id RETURNING *`,
        )
        .get({ ...p, stamp: p.stamp ?? null });
      audit('item', p.id, 'update', before, row);
      return mapItem(row);
    },
  );

  on(ipc, CH.itemsDelete, z.object({ id: z.number().int() }), ({ id }) => {
    const db = getDb();
    const before = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    if (!before) return { ok: false };
    db.prepare('DELETE FROM items WHERE id = ?').run(id);
    audit('item', id, 'delete', before, null);
    return { ok: true };
  });

  // ───────── stock adjustments
  on(ipc, CH.stockAdjust, StockAdjustInput, (p) => {
    const db = getDb();
    return db.transaction(() => {
      const before = db.prepare('SELECT * FROM items WHERE id = ?').get(p.itemId);
      if (!before) throw new Error(`item ${p.itemId} not found`);
      db.prepare(
        `INSERT INTO stock_adjustments (item_id, delta_qty, delta_wt_mg, reason, actor)
         VALUES (?, ?, ?, ?, 'operator')`,
      ).run(p.itemId, p.deltaQty, p.deltaWtMg, p.reason);
      db.prepare(
        `UPDATE items SET stock_qty = stock_qty + ?, stock_wt_mg = stock_wt_mg + ?, updated_at = unixepoch()
         WHERE id = ?`,
      ).run(p.deltaQty, p.deltaWtMg, p.itemId);
      const after = db.prepare('SELECT * FROM items WHERE id = ?').get(p.itemId);
      audit('item', p.itemId, 'stock_adjust', before, after);
      return mapItem(after);
    })();
  });

  on(ipc, CH.stockAdjustments, z.object({ itemId: z.number().int() }), ({ itemId }) => {
    return getDb()
      .prepare(
        `SELECT id, ts, delta_qty as deltaQty, delta_wt_mg as deltaWtMg, reason, actor
         FROM stock_adjustments WHERE item_id = ? ORDER BY ts DESC LIMIT 100`,
      )
      .all(itemId);
  });

  // ───────── unified search (FTS5)
  on(ipc, CH.search, SearchInput, ({ q, scope, limit }): SearchHit[] => {
    const db = getDb();
    const query = toFtsQuery(q);
    const hits: SearchHit[] = [];

    if (scope === 'all' || scope === 'items') {
      const rows = db
        .prepare(
          `SELECT i.id, i.name, i.sku, i.category, i.stamp
           FROM items_fts f JOIN items i ON i.id = f.rowid
           WHERE items_fts MATCH ? ORDER BY rank LIMIT ?`,
        )
        .all(query, limit) as any[];
      for (const r of rows) hits.push({ kind: 'item', id: r.id, name: r.name, sku: r.sku, category: r.category, stamp: r.stamp });
    }

    if (scope === 'all' || scope === 'parties') {
      const rows = db
        .prepare(
          `SELECT p.id, p.name, p.role, p.phone
           FROM parties_fts f JOIN parties p ON p.id = f.rowid
           WHERE parties_fts MATCH ? ORDER BY rank LIMIT ?`,
        )
        .all(query, limit) as any[];
      for (const r of rows) hits.push({ kind: 'party', id: r.id, name: r.name, role: r.role, phone: r.phone });
    }

    return hits;
  });

  // ───────── company (masters bag)
  on(ipc, CH.companyGet, null, () => {
    return getDb().prepare('SELECT * FROM companies ORDER BY id LIMIT 1').get();
  });
  on(
    ipc,
    CH.companyUpdate,
    z.object({
      name: z.string().min(1),
      gstin: z.string().min(1),
      address: z.string().default(''),
      stateCode: z.string().default(''),
      phone: z.string().default(''),
    }),
    (c) => {
      const db = getDb();
      const existing = db.prepare('SELECT id FROM companies ORDER BY id LIMIT 1').get() as { id: number } | undefined;
      if (existing) {
        db.prepare(
          `UPDATE companies SET name=?, gstin=?, address=?, state_code=?, phone=?, updated_at=unixepoch() WHERE id=?`,
        ).run(c.name, c.gstin, c.address, c.stateCode, c.phone, existing.id);
        return { ok: true, id: existing.id };
      }
      const row = db.prepare(
        `INSERT INTO companies (name, gstin, address, state_code, phone) VALUES (?, ?, ?, ?, ?) RETURNING id`,
      ).get(c.name, c.gstin, c.address, c.stateCode, c.phone) as { id: number };
      return { ok: true, id: row.id };
    },
  );

  // ───────── sale
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

  on(ipc, CH.salePrint, z.object({ id: z.number().int() }), async ({ id }) => {
    return printSaleInvoice(getDb(), id);
  });

  // ───────── purchase
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

  // ───────── ledgers (running balances)
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
    // running balance per (category, stamp) bucket
    const bals = new Map<string, number>();
    return rows.map((r: any) => {
      const k = `${r.category}|${r.stamp}`;
      const b = (bals.get(k) ?? 0) + r.debitMg - r.creditMg;
      bals.set(k, b);
      return { ...r, balanceMg: b };
    });
  });

  on(ipc, CH.metalBuckets, null, () => {
    return getDb()
      .prepare(
        `SELECT category, stamp,
                SUM(debit_mg)  as debitMg,
                SUM(credit_mg) as creditMg,
                SUM(debit_mg) - SUM(credit_mg) as balanceMg
         FROM metal_ledger GROUP BY category, stamp ORDER BY category, stamp`,
      )
      .all();
  });

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

  // ───────── karigar
  const mapKarigar = (r: any) => ({
    id: r.id, name: r.name, phone: r.phone, address: r.address,
    defaultLabourMode: r.default_labour_mode, defaultLabourValue: r.default_labour_value,
    notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at,
  });
  on(ipc, CH.karigarsList, null, () => getDb().prepare('SELECT * FROM karigars ORDER BY name').all().map(mapKarigar));
  on(ipc, CH.karigarsCreate, KarigarInput, (k) => {
    const row = getDb().prepare(
      `INSERT INTO karigars (name, phone, address, default_labour_mode, default_labour_value, notes)
       VALUES (@name, @phone, @address, @defaultLabourMode, @defaultLabourValue, @notes) RETURNING *`,
    ).get({ ...k, phone: k.phone ?? null });
    audit('karigar', (row as any).id, 'insert', null, row);
    return mapKarigar(row);
  });
  on(ipc, CH.karigarsUpdate, KarigarInput.extend({ id: z.number().int() }), (k) => {
    const db = getDb();
    const before = db.prepare('SELECT * FROM karigars WHERE id = ?').get(k.id);
    if (!before) throw new Error(`karigar ${k.id} not found`);
    const row = db.prepare(
      `UPDATE karigars SET name=@name, phone=@phone, address=@address,
        default_labour_mode=@defaultLabourMode, default_labour_value=@defaultLabourValue,
        notes=@notes, updated_at=unixepoch()
       WHERE id=@id RETURNING *`,
    ).get({ ...k, phone: k.phone ?? null });
    audit('karigar', k.id, 'update', before, row);
    return mapKarigar(row);
  });
  on(ipc, CH.karigarsDelete, z.object({ id: z.number().int() }), ({ id }) => {
    const db = getDb();
    const before = db.prepare('SELECT * FROM karigars WHERE id = ?').get(id);
    if (!before) return { ok: false };
    db.prepare('DELETE FROM karigars WHERE id = ?').run(id);
    audit('karigar', id, 'delete', before, null);
    return { ok: true };
  });

  on(ipc, CH.karigarIssuePost, KarigarIssueInput, (p) => {
    const res = postKarigarIssue(getDb(), p);
    audit('karigar_issue', res.id, 'post', null, res);
    return res;
  });
  on(ipc, CH.karigarReceiptPost, KarigarReceiptInput, (p) => {
    const res = postKarigarReceipt(getDb(), p);
    audit('karigar_receipt', res.id, 'post', null, res);
    return res;
  });
  on(ipc, CH.karigarPay, KarigarPayInput, (p) => {
    const res = payKarigar(getDb(), p);
    audit('karigar_pay', res.id, 'post', null, res);
    return res;
  });

  on(ipc, CH.karigarIssuesList, z.object({ karigarId: z.number().int().optional() }).default({}), ({ karigarId }) => {
    const db = getDb();
    const clauses: string[] = []; const args: any[] = [];
    if (karigarId) { clauses.push('ki.karigar_id = ?'); args.push(karigarId); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return db.prepare(
      `SELECT ki.id, ki.slip_no as slipNo, ki.ts, ki.karigar_id as karigarId, k.name as karigarName,
              ki.purpose, ki.notes,
              (SELECT SUM(weight_mg) FROM karigar_issue_items WHERE issue_id = ki.id) AS totalMg
       FROM karigar_issues ki JOIN karigars k ON k.id = ki.karigar_id
       ${where} ORDER BY ki.ts DESC LIMIT 200`,
    ).all(...args);
  });

  on(ipc, CH.karigarReceiptsList, z.object({ karigarId: z.number().int().optional() }).default({}), ({ karigarId }) => {
    const db = getDb();
    const clauses: string[] = []; const args: any[] = [];
    if (karigarId) { clauses.push('kr.karigar_id = ?'); args.push(karigarId); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return db.prepare(
      `SELECT kr.id, kr.slip_no as slipNo, kr.ts, kr.karigar_id as karigarId, k.name as karigarName,
              kr.related_issue_id as relatedIssueId, kr.labour_paise as labourPaise, kr.notes,
              (SELECT SUM(weight_mg) FROM karigar_receipt_items WHERE receipt_id = kr.id) AS totalReceivedMg,
              (SELECT SUM(wastage_mg) FROM karigar_receipt_items WHERE receipt_id = kr.id) AS totalWastageMg
       FROM karigar_receipts kr JOIN karigars k ON k.id = kr.karigar_id
       ${where} ORDER BY kr.ts DESC LIMIT 200`,
    ).all(...args);
  });

  on(ipc, CH.karigarLedger, z.object({ karigarId: z.number().int() }), ({ karigarId }) => {
    return readKarigarLedger(getDb(), karigarId);
  });
  on(ipc, CH.karigarBalances, null, () => listKarigarBalances(getDb()));

  // ───────── metal rates (Settings)
  const mapRate = (r: any) => ({
    id: r.id, category: r.category, stamp: r.stamp,
    ratePaisePerG: r.rate_paise_per_g,
    updatedAt: r.updated_at, updatedBy: r.updated_by,
  });
  on(ipc, CH.ratesList, null, () => {
    return getDb().prepare(
      `SELECT * FROM metal_rates ORDER BY category, stamp`,
    ).all().map(mapRate);
  });
  on(ipc, CH.ratesUpsert, MetalRateInput, (p) => {
    const db = getDb();
    const existing = db.prepare(
      `SELECT * FROM metal_rates WHERE category = ? AND stamp = ?`,
    ).get(p.category, p.stamp);
    const row = db.prepare(
      `INSERT INTO metal_rates (category, stamp, rate_paise_per_g, updated_at, updated_by)
       VALUES (@category, @stamp, @ratePaisePerG, unixepoch(), 'operator')
       ON CONFLICT(category, stamp) DO UPDATE SET
         rate_paise_per_g = excluded.rate_paise_per_g,
         updated_at = unixepoch(),
         updated_by = 'operator'
       RETURNING *`,
    ).get(p);
    audit('metal_rate', (row as any).id, existing ? 'update' : 'insert', existing, row);
    return mapRate(row);
  });
  on(ipc, CH.ratesDelete, z.object({ id: z.number().int() }), ({ id }) => {
    const db = getDb();
    const before = db.prepare('SELECT * FROM metal_rates WHERE id = ?').get(id);
    if (!before) return { ok: false };
    db.prepare('DELETE FROM metal_rates WHERE id = ?').run(id);
    audit('metal_rate', id, 'delete', before, null);
    return { ok: true };
  });

  // ───────── approval / repair / order pipelines
  on(ipc, CH.approvalCreate, ApprovalInput, (p) => {
    const r = createApproval(getDb(), p);
    audit('approval', r.id, 'create', null, r);
    return r;
  });
  on(ipc, CH.approvalResolve, ApprovalResolve, (p) => {
    const r = resolveApproval(getDb(), p);
    audit('approval', p.id, `resolve:${p.status}`, null, r);
    return r;
  });
  on(ipc, CH.approvalsList, z.object({ status: z.string().optional() }).default({}), ({ status }) => {
    const db = getDb();
    const where = status ? 'WHERE a.status = ?' : '';
    const args = status ? [status] : [];
    return db.prepare(
      `SELECT a.id, a.slip_no as slipNo, a.ts, a.party_id as partyId, p.name as partyName,
              a.promised_return_date as promisedReturnDate, a.status, a.notes,
              a.resolved_at as resolvedAt, a.resolved_sale_id as resolvedSaleId,
              (SELECT COUNT(*) FROM approval_items WHERE approval_id = a.id) as itemCount,
              (SELECT SUM(qty) FROM approval_items WHERE approval_id = a.id) as totalQty,
              (SELECT SUM(weight_mg) FROM approval_items WHERE approval_id = a.id) as totalMg
       FROM approvals a JOIN parties p ON p.id = a.party_id
       ${where}
       ORDER BY a.ts DESC LIMIT 200`,
    ).all(...args);
  });

  on(ipc, CH.repairCreate, RepairInput, (p) => {
    const r = createRepair(getDb(), p);
    audit('repair', r.id, 'create', null, r);
    return r;
  });
  on(ipc, CH.repairStatus, RepairStatusUpdate, (p) => {
    const r = updateRepairStatus(getDb(), p);
    audit('repair', p.id, `status:${p.status}`, null, r);
    return r;
  });
  on(ipc, CH.repairDeliver, RepairDeliver, (p) => {
    const r = deliverRepair(getDb(), p);
    audit('repair', p.id, 'deliver', null, r);
    return r;
  });
  on(ipc, CH.repairsList, z.object({ status: z.string().optional() }).default({}), ({ status }) => {
    const db = getDb();
    const where = status ? 'WHERE r.status = ?' : '';
    const args = status ? [status] : [];
    return db.prepare(
      `SELECT r.id, r.slip_no as slipNo, r.ts, r.party_id as partyId, p.name as partyName,
              r.description, r.customer_material_category as customerMaterialCategory,
              r.customer_material_stamp as customerMaterialStamp,
              r.customer_material_weight_mg as customerMaterialWeightMg,
              r.karigar_id as karigarId, k.name as karigarName,
              r.addition_paise as additionPaise, r.labour_paise as labourPaise,
              r.total_paise as totalPaise, r.balance_paise as balancePaise,
              r.paid_cash_paise as paidCashPaise, r.paid_bank_paise as paidBankPaise,
              r.promised_date as promisedDate, r.status, r.delivered_at as deliveredAt, r.notes
       FROM repairs r
       JOIN parties p ON p.id = r.party_id
       LEFT JOIN karigars k ON k.id = r.karigar_id
       ${where}
       ORDER BY r.ts DESC LIMIT 200`,
    ).all(...args);
  });

  on(ipc, CH.orderCreate, OrderInput, (p) => {
    const r = createOrder(getDb(), p);
    audit('order', r.id, 'create', null, r);
    return r;
  });
  on(ipc, CH.orderAdvance, OrderAdvance, (p) => {
    const r = receiveOrderAdvance(getDb(), p);
    audit('order', p.id, 'advance', null, r);
    return r;
  });
  on(ipc, CH.orderStatus, OrderStatusUpdate, (p) => {
    const r = updateOrderStatus(getDb(), p);
    audit('order', p.id, `status:${p.status}`, null, r);
    return r;
  });
  on(ipc, CH.ordersList, z.object({ status: z.string().optional() }).default({}), ({ status }) => {
    const db = getDb();
    const where = status ? 'WHERE o.status = ?' : '';
    const args = status ? [status] : [];
    return db.prepare(
      `SELECT o.id, o.slip_no as slipNo, o.ts, o.party_id as partyId, p.name as partyName,
              o.spec, o.estimated_paise as estimatedPaise, o.advance_paise as advancePaise,
              o.karigar_id as karigarId, k.name as karigarName,
              o.promised_date as promisedDate, o.status, o.delivered_at as deliveredAt,
              o.resolved_sale_id as resolvedSaleId, o.notes
       FROM orders o
       JOIN parties p ON p.id = o.party_id
       LEFT JOIN karigars k ON k.id = o.karigar_id
       ${where}
       ORDER BY o.ts DESC LIMIT 200`,
    ).all(...args);
  });

  // ───────── refining
  on(ipc, CH.refiningSend, RefiningSend, (p) => {
    const r = sendRefiningLot(getDb(), p);
    audit('refining', r.id, 'send', null, r);
    return r;
  });
  on(ipc, CH.refiningReceive, RefiningReceive, (p) => {
    const r = receiveRefiningLot(getDb(), p);
    audit('refining', p.id, 'receive', null, r);
    return r;
  });
  on(ipc, CH.refiningCancel, z.object({ id: z.number().int() }), ({ id }) => {
    const r = cancelRefiningLot(getDb(), id);
    audit('refining', id, 'cancel', null, r);
    return r;
  });
  on(ipc, CH.refiningList, z.object({ status: z.string().optional() }).default({}), ({ status }) => {
    const db = getDb();
    const where = status ? 'WHERE r.status = ?' : '';
    const args = status ? [status] : [];
    return db.prepare(
      `SELECT r.id, r.slip_no as slipNo, r.ts, r.refiner_party_id as refinerPartyId, p.name as refinerName,
              r.sent_category as sentCategory, r.sent_stamp as sentStamp, r.sent_weight_mg as sentWeightMg,
              r.received_category as receivedCategory, r.received_stamp as receivedStamp,
              r.received_weight_mg as receivedWeightMg, r.loss_mg as lossMg,
              r.charges_paise as chargesPaise, r.paid_cash_paise as paidCashPaise,
              r.charges_balance_paise as chargesBalancePaise,
              r.status, r.received_at as receivedAt, r.notes
       FROM refining_lots r JOIN parties p ON p.id = r.refiner_party_id
       ${where}
       ORDER BY r.ts DESC LIMIT 200`,
    ).all(...args);
  });

  // ───────── catalog: photos + collections + tags + labels
  on(ipc, CH.photosList, z.object({ itemId: z.number().int() }), ({ itemId }) => {
    return listItemPhotos(getDb(), itemId);
  });
  on(ipc, CH.photosAdd, z.object({ itemId: z.number().int() }), async ({ itemId }) => {
    const r = await addPhotos(getDb(), itemId);
    audit('item_photo', itemId, 'add', null, r);
    return r;
  });
  on(ipc, CH.photosDelete, z.object({ id: z.number().int() }), ({ id }) => {
    const r = deletePhoto(getDb(), id);
    audit('item_photo', id, 'delete', null, r);
    return r;
  });
  on(ipc, CH.photosSetPrimary, z.object({ id: z.number().int() }), ({ id }) => {
    return setPrimaryPhoto(getDb(), id);
  });

  on(ipc, CH.catalogGrid, z.object({
    q: z.string().optional(),
    collectionId: z.number().int().optional(),
  }).default({}), (opts) => {
    return catalogGrid(getDb(), opts);
  });

  on(ipc, CH.collectionsList, null, () => {
    return getDb().prepare(
      `SELECT c.id, c.name, c.description, c.created_at as createdAt,
              (SELECT COUNT(*) FROM item_collections WHERE collection_id = c.id) AS itemCount
       FROM collections c ORDER BY c.name`,
    ).all();
  });
  on(ipc, CH.collectionsCreate, z.object({ name: z.string().min(1).max(80), description: z.string().default('') }), (p) => {
    const row = getDb().prepare(
      `INSERT INTO collections (name, description) VALUES (?, ?) RETURNING *`,
    ).get(p.name.trim(), p.description);
    audit('collection', (row as any).id, 'create', null, row);
    return row;
  });
  on(ipc, CH.collectionsDelete, z.object({ id: z.number().int() }), ({ id }) => {
    getDb().prepare('DELETE FROM collections WHERE id = ?').run(id);
    audit('collection', id, 'delete', null, null);
    return { ok: true };
  });

  on(ipc, CH.itemCollectionsGet, z.object({ itemId: z.number().int() }), ({ itemId }) => {
    return getDb().prepare(
      `SELECT c.id, c.name FROM collections c
       JOIN item_collections ic ON ic.collection_id = c.id WHERE ic.item_id = ? ORDER BY c.name`,
    ).all(itemId);
  });
  on(ipc, CH.itemCollectionsSet, z.object({ itemId: z.number().int(), collectionIds: z.array(z.number().int()) }), ({ itemId, collectionIds }) => {
    const db = getDb();
    db.transaction(() => {
      db.prepare('DELETE FROM item_collections WHERE item_id = ?').run(itemId);
      const insert = db.prepare('INSERT INTO item_collections (item_id, collection_id) VALUES (?, ?)');
      for (const cid of collectionIds) insert.run(itemId, cid);
    })();
    audit('item_collections', itemId, 'set', null, { collectionIds });
    return { ok: true };
  });

  on(ipc, CH.itemTagsSet, z.object({ itemId: z.number().int(), tags: z.string().max(500) }), ({ itemId, tags }) => {
    getDb().prepare('UPDATE items SET tags = ?, updated_at = unixepoch() WHERE id = ?').run(tags.trim(), itemId);
    audit('item', itemId, 'tags', null, { tags });
    return { ok: true };
  });

  on(ipc, CH.labelsPrint, z.object({
    itemIds: z.array(z.number().int()).min(1),
    copies: z.number().int().min(1).max(50).default(1),
  }), async (p) => {
    return printLabels(getDb(), p);
  });

  // ───────── dev smoke test
  on(ipc, CH.devSmoke, null, async () => {
    const { runSmokeTest } = await import('./smoke');
    return runSmokeTest();
  });

  // ───────── CSV exports (sales / purchase register)
  on(ipc, CH.exportSalesCsv, LedgerRange, async (r) => {
    const { writeCsvSales } = await import('./export');
    return writeCsvSales(getDb(), r);
  });
  on(ipc, CH.exportPurchasesCsv, LedgerRange, async (r) => {
    const { writeCsvPurchases } = await import('./export');
    return writeCsvPurchases(getDb(), r);
  });

  // ───────── GST reports
  on(ipc, CH.gstGstr1View, LedgerRange, async (r) => {
    const { computeGstr1 } = await import('./gst');
    return computeGstr1(getDb(), r);
  });
  on(ipc, CH.gstGstr1Csv, LedgerRange, async (r) => {
    const { writeGstr1Csv } = await import('./gst');
    return writeGstr1Csv(getDb(), r);
  });
  on(ipc, CH.gstGstr3bView, LedgerRange, async (r) => {
    const { computeGstr3b } = await import('./gst');
    return computeGstr3b(getDb(), r);
  });
  on(ipc, CH.gstGstr3bCsv, LedgerRange, async (r) => {
    const { writeGstr3bCsv } = await import('./gst');
    return writeGstr3bCsv(getDb(), r);
  });
  on(ipc, CH.gstHsnView, LedgerRange, async (r) => {
    const { computeHsnSummary } = await import('./gst');
    return computeHsnSummary(getDb(), r);
  });
  on(ipc, CH.gstHsnCsv, LedgerRange, async (r) => {
    const { writeHsnCsv } = await import('./gst');
    return writeHsnCsv(getDb(), r);
  });
}
