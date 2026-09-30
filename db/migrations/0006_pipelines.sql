-- 0006: approval / repair / order pipelines
-- ponytail: each is a stateful slip. Ledger writes happen on advance-paid and delivery only.
-- Approvals also affect items stock (items physically leave the shop during approval).
-- Repairs never touch shop stock (customer material). Orders don't touch stock until delivery
-- and stock is consumed when the operator posts a real Sale for the delivered order.

-- ── APPROVAL ───────────────────────────────────────────────────────────
CREATE TABLE approvals (
  id                     INTEGER PRIMARY KEY,
  slip_no                TEXT    NOT NULL UNIQUE,
  ts                     INTEGER NOT NULL DEFAULT (unixepoch()),
  party_id               INTEGER NOT NULL REFERENCES parties(id),
  promised_return_date   TEXT    NOT NULL DEFAULT '',
  status                 TEXT    NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','sold','returned','cancelled')),
  resolved_at            INTEGER,
  resolved_sale_id       INTEGER REFERENCES sales(id),
  notes                  TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX approvals_party_idx ON approvals(party_id);
CREATE INDEX approvals_status_idx ON approvals(status);
CREATE INDEX approvals_ts_idx ON approvals(ts);

CREATE TABLE approval_items (
  id           INTEGER PRIMARY KEY,
  approval_id  INTEGER NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
  item_id      INTEGER NOT NULL REFERENCES items(id),
  category     TEXT    NOT NULL,
  stamp        TEXT,
  qty          INTEGER NOT NULL DEFAULT 0,
  weight_mg    INTEGER NOT NULL DEFAULT 0,
  note         TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX approval_items_a_idx ON approval_items(approval_id);

-- ── REPAIR ─────────────────────────────────────────────────────────────
CREATE TABLE repairs (
  id                     INTEGER PRIMARY KEY,
  slip_no                TEXT    NOT NULL UNIQUE,
  ts                     INTEGER NOT NULL DEFAULT (unixepoch()),
  party_id               INTEGER NOT NULL REFERENCES parties(id),
  description            TEXT    NOT NULL,
  customer_material_category TEXT,
  customer_material_stamp    TEXT,
  customer_material_weight_mg INTEGER NOT NULL DEFAULT 0,
  karigar_id             INTEGER REFERENCES karigars(id),
  addition_paise         INTEGER NOT NULL DEFAULT 0,
  labour_paise           INTEGER NOT NULL DEFAULT 0,
  total_paise            INTEGER NOT NULL DEFAULT 0,
  promised_date          TEXT    NOT NULL DEFAULT '',
  status                 TEXT    NOT NULL DEFAULT 'received'
                          CHECK (status IN ('received','in_progress','ready','delivered','cancelled')),
  delivered_at           INTEGER,
  paid_cash_paise        INTEGER NOT NULL DEFAULT 0,
  paid_bank_paise        INTEGER NOT NULL DEFAULT 0,
  balance_paise          INTEGER NOT NULL DEFAULT 0,
  notes                  TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX repairs_party_idx ON repairs(party_id);
CREATE INDEX repairs_status_idx ON repairs(status);
CREATE INDEX repairs_ts_idx ON repairs(ts);

-- ── ORDER ──────────────────────────────────────────────────────────────
CREATE TABLE orders (
  id                     INTEGER PRIMARY KEY,
  slip_no                TEXT    NOT NULL UNIQUE,
  ts                     INTEGER NOT NULL DEFAULT (unixepoch()),
  party_id               INTEGER NOT NULL REFERENCES parties(id),
  spec                   TEXT    NOT NULL,
  estimated_paise        INTEGER NOT NULL DEFAULT 0,
  advance_paise          INTEGER NOT NULL DEFAULT 0,
  karigar_id             INTEGER REFERENCES karigars(id),
  promised_date          TEXT    NOT NULL DEFAULT '',
  status                 TEXT    NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','in_progress','ready','delivered','cancelled')),
  delivered_at           INTEGER,
  resolved_sale_id       INTEGER REFERENCES sales(id),
  notes                  TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX orders_party_idx ON orders(party_id);
CREATE INDEX orders_status_idx ON orders(status);
CREATE INDEX orders_ts_idx ON orders(ts);
