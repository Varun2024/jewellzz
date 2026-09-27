-- 0004: karigars master + issue/receipt slips + karigar_ledger
-- ponytail: separate karigars table (per PRD). Karigar-specific metal + cash balances live in karigar_ledger
-- (append-only, same discipline as party_ledger). Shop-level metal_ledger + cash_ledger still get the physical
-- movement rows with ref_type='karigar_*' so shop totals stay complete.

CREATE TABLE karigars (
  id                    INTEGER PRIMARY KEY,
  name                  TEXT    NOT NULL,
  phone                 TEXT,
  address               TEXT    NOT NULL DEFAULT '',
  default_labour_mode   TEXT    NOT NULL DEFAULT 'per_gram' CHECK (default_labour_mode IN ('pct','per_gram','per_pcs')),
  default_labour_value  INTEGER NOT NULL DEFAULT 0,   -- basis points if pct, paise otherwise
  notes                 TEXT    NOT NULL DEFAULT '',
  created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at            INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX karigars_name_idx ON karigars(name);

-- FTS5 mirror for karigars
CREATE VIRTUAL TABLE karigars_fts USING fts5(
  name, phone,
  content='karigars', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER karigars_ai AFTER INSERT ON karigars BEGIN
  INSERT INTO karigars_fts(rowid, name, phone) VALUES (new.id, new.name, coalesce(new.phone,''));
END;
CREATE TRIGGER karigars_ad AFTER DELETE ON karigars BEGIN
  INSERT INTO karigars_fts(karigars_fts, rowid, name, phone) VALUES ('delete', old.id, old.name, coalesce(old.phone,''));
END;
CREATE TRIGGER karigars_au AFTER UPDATE ON karigars BEGIN
  INSERT INTO karigars_fts(karigars_fts, rowid, name, phone) VALUES ('delete', old.id, old.name, coalesce(old.phone,''));
  INSERT INTO karigars_fts(rowid, name, phone) VALUES (new.id, new.name, coalesce(new.phone,''));
END;

-- Issue slip: shop gives metal to karigar for work.
CREATE TABLE karigar_issues (
  id            INTEGER PRIMARY KEY,
  slip_no       TEXT    NOT NULL UNIQUE,
  ts            INTEGER NOT NULL DEFAULT (unixepoch()),
  karigar_id    INTEGER NOT NULL REFERENCES karigars(id),
  purpose       TEXT    NOT NULL DEFAULT '',
  notes         TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX ki_karigar_idx ON karigar_issues(karigar_id);
CREATE INDEX ki_ts_idx ON karigar_issues(ts);

CREATE TABLE karigar_issue_items (
  id         INTEGER PRIMARY KEY,
  issue_id   INTEGER NOT NULL REFERENCES karigar_issues(id) ON DELETE CASCADE,
  category   TEXT    NOT NULL CHECK (category IN ('gold','silver','stone','artificial')),
  stamp      TEXT    NOT NULL DEFAULT '',
  weight_mg  INTEGER NOT NULL CHECK (weight_mg > 0),
  note       TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX kii_issue_idx ON karigar_issue_items(issue_id);

-- Receipt slip: karigar returns finished goods + wastage + labour claim.
CREATE TABLE karigar_receipts (
  id                 INTEGER PRIMARY KEY,
  slip_no            TEXT    NOT NULL UNIQUE,
  ts                 INTEGER NOT NULL DEFAULT (unixepoch()),
  karigar_id         INTEGER NOT NULL REFERENCES karigars(id),
  related_issue_id   INTEGER REFERENCES karigar_issues(id),
  labour_paise       INTEGER NOT NULL DEFAULT 0,
  notes              TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX kr_karigar_idx ON karigar_receipts(karigar_id);
CREATE INDEX kr_ts_idx ON karigar_receipts(ts);

CREATE TABLE karigar_receipt_items (
  id            INTEGER PRIMARY KEY,
  receipt_id    INTEGER NOT NULL REFERENCES karigar_receipts(id) ON DELETE CASCADE,
  item_id       INTEGER REFERENCES items(id),        -- if returning as a stocked item
  category      TEXT    NOT NULL CHECK (category IN ('gold','silver','stone','artificial')),
  stamp         TEXT    NOT NULL DEFAULT '',
  qty           INTEGER NOT NULL DEFAULT 0,          -- pcs of stocked item, if any
  weight_mg     INTEGER NOT NULL DEFAULT 0,          -- pure metal returned
  wastage_mg    INTEGER NOT NULL DEFAULT 0,          -- metal lost in work
  note          TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX kri_receipt_idx ON karigar_receipt_items(receipt_id);

-- Karigar ledger: metal (per category+stamp bucket) and cash (labour payable) per karigar.
-- Same append-only discipline; balance = SUM(debit)-SUM(credit).
-- Convention:
--   metal debit = karigar owes shop metal (issue → shop lent metal)
--   metal credit = karigar returned metal (receipt/wastage settles)
--   cash debit = karigar owes shop (over-payment; rare)
--   cash credit = shop owes karigar (labour claim)
CREATE TABLE karigar_ledger (
  id            INTEGER PRIMARY KEY,
  ts            INTEGER NOT NULL DEFAULT (unixepoch()),
  karigar_id    INTEGER NOT NULL REFERENCES karigars(id),
  ref_type      TEXT    NOT NULL,
  ref_id        INTEGER,
  kind          TEXT    NOT NULL CHECK (kind IN ('cash','metal')),
  category      TEXT,
  stamp         TEXT,
  debit         INTEGER NOT NULL DEFAULT 0,
  credit        INTEGER NOT NULL DEFAULT 0,
  note          TEXT    NOT NULL DEFAULT '',
  reverses_id   INTEGER REFERENCES karigar_ledger(id)
);
CREATE INDEX kl_karigar_idx ON karigar_ledger(karigar_id);
CREATE INDEX kl_ts_idx ON karigar_ledger(ts);
