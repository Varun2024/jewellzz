-- 0003: sales, purchases, and the three ledgers
-- ponytail: ledgers are append-only. Money in paise, weight in mg. Every sale/purchase runs as one txn.

-- ─── sales ─────────────────────────────────────────────────────────────
CREATE TABLE sales (
  id                INTEGER PRIMARY KEY,
  bill_no           TEXT    NOT NULL UNIQUE,
  ts                INTEGER NOT NULL DEFAULT (unixepoch()),
  party_id          INTEGER NOT NULL REFERENCES parties(id),
  party_state       TEXT    NOT NULL DEFAULT '',
  interstate        INTEGER NOT NULL DEFAULT 0,  -- 0/1
  subtotal_paise    INTEGER NOT NULL DEFAULT 0,  -- sum of line taxable
  cgst_paise        INTEGER NOT NULL DEFAULT 0,
  sgst_paise        INTEGER NOT NULL DEFAULT 0,
  igst_paise        INTEGER NOT NULL DEFAULT 0,
  discount_paise    INTEGER NOT NULL DEFAULT 0,
  round_off_paise   INTEGER NOT NULL DEFAULT 0,
  total_paise       INTEGER NOT NULL,
  paid_cash_paise   INTEGER NOT NULL DEFAULT 0,
  paid_bank_paise   INTEGER NOT NULL DEFAULT 0,
  old_gold_value_paise INTEGER NOT NULL DEFAULT 0,  -- old gold credited toward payment
  balance_paise     INTEGER NOT NULL DEFAULT 0,     -- what party still owes (can be negative if advance)
  notes             TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX sales_ts_idx ON sales(ts);
CREATE INDEX sales_party_idx ON sales(party_id);

CREATE TABLE sale_items (
  id             INTEGER PRIMARY KEY,
  sale_id        INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  item_id        INTEGER NOT NULL REFERENCES items(id),
  description    TEXT    NOT NULL,
  category       TEXT    NOT NULL,     -- snapshot
  unit           TEXT    NOT NULL,     -- gms/carat/pcs
  stamp          TEXT,                 -- snapshot
  hsn            TEXT    NOT NULL DEFAULT '',
  qty            INTEGER NOT NULL DEFAULT 0,     -- pcs
  weight_mg      INTEGER NOT NULL DEFAULT 0,     -- always mg (canonical)
  rate_paise     INTEGER NOT NULL DEFAULT 0,     -- per gram (gold/silver), per carat (stone), or per pcs
  making_mode    TEXT    NOT NULL,
  making_value   INTEGER NOT NULL DEFAULT 0,
  making_paise   INTEGER NOT NULL DEFAULT 0,     -- computed
  wastage_mode   TEXT    NOT NULL,
  wastage_value  INTEGER NOT NULL DEFAULT 0,
  wastage_paise  INTEGER NOT NULL DEFAULT 0,     -- computed (metal-money on wastage weight)
  taxable_paise  INTEGER NOT NULL DEFAULT 0,     -- metal + making + wastage
  gst_bp         INTEGER NOT NULL DEFAULT 300,
  cgst_paise     INTEGER NOT NULL DEFAULT 0,
  sgst_paise     INTEGER NOT NULL DEFAULT 0,
  igst_paise     INTEGER NOT NULL DEFAULT 0,
  total_paise    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX sale_items_sale_idx ON sale_items(sale_id);
CREATE INDEX sale_items_item_idx ON sale_items(item_id);

CREATE TABLE sale_payments (
  id           INTEGER PRIMARY KEY,
  sale_id      INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  kind         TEXT    NOT NULL CHECK (kind IN ('cash','bank','old_gold')),
  amount_paise INTEGER NOT NULL DEFAULT 0,
  -- old-gold specifics (null for cash/bank)
  metal_category TEXT,
  metal_stamp    TEXT,
  metal_weight_mg INTEGER,
  metal_rate_paise INTEGER,
  note         TEXT NOT NULL DEFAULT ''
);
CREATE INDEX sale_pay_sale_idx ON sale_payments(sale_id);

-- ─── purchases ────────────────────────────────────────────────────────
CREATE TABLE purchases (
  id                INTEGER PRIMARY KEY,
  ref_no            TEXT    NOT NULL,   -- supplier's invoice #
  ts                INTEGER NOT NULL DEFAULT (unixepoch()),
  party_id          INTEGER NOT NULL REFERENCES parties(id),
  party_state       TEXT    NOT NULL DEFAULT '',
  interstate        INTEGER NOT NULL DEFAULT 0,
  subtotal_paise    INTEGER NOT NULL DEFAULT 0,
  cgst_paise        INTEGER NOT NULL DEFAULT 0,
  sgst_paise        INTEGER NOT NULL DEFAULT 0,
  igst_paise        INTEGER NOT NULL DEFAULT 0,
  total_paise       INTEGER NOT NULL,
  paid_cash_paise   INTEGER NOT NULL DEFAULT 0,
  paid_bank_paise   INTEGER NOT NULL DEFAULT 0,
  balance_paise     INTEGER NOT NULL DEFAULT 0,
  notes             TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX purchases_ts_idx ON purchases(ts);
CREATE INDEX purchases_party_idx ON purchases(party_id);

CREATE TABLE purchase_items (
  id             INTEGER PRIMARY KEY,
  purchase_id    INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  item_id        INTEGER NOT NULL REFERENCES items(id),
  description    TEXT    NOT NULL,
  category       TEXT    NOT NULL,
  unit           TEXT    NOT NULL,
  stamp          TEXT,
  hsn            TEXT    NOT NULL DEFAULT '',
  qty            INTEGER NOT NULL DEFAULT 0,
  weight_mg      INTEGER NOT NULL DEFAULT 0,
  rate_paise     INTEGER NOT NULL DEFAULT 0,
  taxable_paise  INTEGER NOT NULL DEFAULT 0,
  gst_bp         INTEGER NOT NULL DEFAULT 300,
  cgst_paise     INTEGER NOT NULL DEFAULT 0,
  sgst_paise     INTEGER NOT NULL DEFAULT 0,
  igst_paise     INTEGER NOT NULL DEFAULT 0,
  total_paise    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX purchase_items_p_idx ON purchase_items(purchase_id);

-- ─── ledgers ──────────────────────────────────────────────────────────
-- Append-only. Reversals via new contra rows referencing `reverses_id`.

CREATE TABLE cash_ledger (
  id            INTEGER PRIMARY KEY,
  ts            INTEGER NOT NULL DEFAULT (unixepoch()),
  ref_type      TEXT    NOT NULL,   -- sale/purchase/opening/adjustment
  ref_id        INTEGER,
  party_id      INTEGER,
  debit_paise   INTEGER NOT NULL DEFAULT 0,   -- money into shop cash box
  credit_paise  INTEGER NOT NULL DEFAULT 0,   -- money out
  note          TEXT    NOT NULL DEFAULT '',
  reverses_id   INTEGER REFERENCES cash_ledger(id)
);
CREATE INDEX cash_ts_idx ON cash_ledger(ts);
CREATE INDEX cash_party_idx ON cash_ledger(party_id);

CREATE TABLE metal_ledger (
  id            INTEGER PRIMARY KEY,
  ts            INTEGER NOT NULL DEFAULT (unixepoch()),
  ref_type      TEXT    NOT NULL,
  ref_id        INTEGER,
  party_id      INTEGER,
  category      TEXT    NOT NULL,   -- gold/silver/stone/artificial
  stamp         TEXT    NOT NULL DEFAULT '', -- '' for non gold/silver
  debit_mg      INTEGER NOT NULL DEFAULT 0,   -- metal into shop
  credit_mg     INTEGER NOT NULL DEFAULT 0,   -- metal out
  note          TEXT    NOT NULL DEFAULT '',
  reverses_id   INTEGER REFERENCES metal_ledger(id)
);
CREATE INDEX metal_ts_idx ON metal_ledger(ts);
CREATE INDEX metal_bucket_idx ON metal_ledger(category, stamp);

CREATE TABLE party_ledger (
  id            INTEGER PRIMARY KEY,
  ts            INTEGER NOT NULL DEFAULT (unixepoch()),
  party_id      INTEGER NOT NULL REFERENCES parties(id),
  ref_type      TEXT    NOT NULL,
  ref_id        INTEGER,
  kind          TEXT    NOT NULL CHECK (kind IN ('cash','metal')),
  category      TEXT,
  stamp         TEXT,
  debit         INTEGER NOT NULL DEFAULT 0,   -- party owes shop (paise if cash / mg if metal)
  credit        INTEGER NOT NULL DEFAULT 0,   -- shop owes party
  note          TEXT    NOT NULL DEFAULT '',
  reverses_id   INTEGER REFERENCES party_ledger(id)
);
CREATE INDEX pl_party_idx ON party_ledger(party_id);
CREATE INDEX pl_ts_idx ON party_ledger(ts);
