-- 0001: masters + audit
-- ponytail: one company row hardcoded for MVP. Multi-company post-launch.

CREATE TABLE companies (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,
  gstin       TEXT    NOT NULL,
  address     TEXT    NOT NULL DEFAULT '',
  state_code  TEXT    NOT NULL DEFAULT '',
  phone       TEXT    NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE parties (
  id            INTEGER PRIMARY KEY,
  name          TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('customer','supplier','both')),
  gstin         TEXT,
  phone         TEXT,
  address       TEXT    NOT NULL DEFAULT '',
  state_code    TEXT    NOT NULL DEFAULT '',
  opening_cash  INTEGER NOT NULL DEFAULT 0, -- paise
  opening_metal_mg INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX parties_name_idx ON parties(name);
CREATE INDEX parties_role_idx ON parties(role);

CREATE TABLE items (
  id             INTEGER PRIMARY KEY,
  sku            TEXT    NOT NULL UNIQUE,
  name           TEXT    NOT NULL,
  category       TEXT    NOT NULL CHECK (category IN ('gold','silver','stone','artificial')),
  unit           TEXT    NOT NULL CHECK (unit IN ('gms','carat','pcs')),
  stamp          TEXT,
  hsn            TEXT    NOT NULL DEFAULT '',
  gst_bp         INTEGER NOT NULL DEFAULT 300,  -- basis points; 300 = 3.00%
  labour_mode    TEXT    NOT NULL CHECK (labour_mode IN ('pct','per_gram','per_pcs')),
  labour_value   INTEGER NOT NULL DEFAULT 0,    -- basis points if pct, paise otherwise
  wastage_mode   TEXT    NOT NULL CHECK (wastage_mode IN ('pct','per_gram','per_pcs')),
  wastage_value  INTEGER NOT NULL DEFAULT 0,
  stock_qty      INTEGER NOT NULL DEFAULT 0,    -- pcs
  stock_wt_mg    INTEGER NOT NULL DEFAULT 0,    -- milligrams
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  -- stamp required for gold/silver, null for stone/artificial
  CHECK (
    (category IN ('gold','silver') AND stamp IS NOT NULL AND length(stamp) > 0)
    OR
    (category IN ('stone','artificial') AND stamp IS NULL)
  )
);
CREATE INDEX items_category_idx ON items(category);
CREATE INDEX items_name_idx ON items(name);

CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY,
  ts         INTEGER NOT NULL DEFAULT (unixepoch()),
  actor      TEXT    NOT NULL DEFAULT 'system',
  entity     TEXT    NOT NULL,
  entity_id  INTEGER,
  action     TEXT    NOT NULL, -- insert/update/delete/post/reverse
  before     TEXT,             -- JSON
  after      TEXT              -- JSON
);
CREATE INDEX audit_ts_idx ON audit_log(ts);
CREATE INDEX audit_entity_idx ON audit_log(entity, entity_id);
