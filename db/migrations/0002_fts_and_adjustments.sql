-- 0002: FTS5 search + stock adjustments
-- ponytail: FTS5 is contentless-external — no data duplication, triggers keep index in sync.

CREATE VIRTUAL TABLE items_fts USING fts5(
  name, sku, stamp, hsn, category,
  content='items', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER items_ai AFTER INSERT ON items BEGIN
  INSERT INTO items_fts(rowid, name, sku, stamp, hsn, category)
  VALUES (new.id, new.name, new.sku, coalesce(new.stamp,''), new.hsn, new.category);
END;

CREATE TRIGGER items_ad AFTER DELETE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, name, sku, stamp, hsn, category)
  VALUES ('delete', old.id, old.name, old.sku, coalesce(old.stamp,''), old.hsn, old.category);
END;

CREATE TRIGGER items_au AFTER UPDATE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, name, sku, stamp, hsn, category)
  VALUES ('delete', old.id, old.name, old.sku, coalesce(old.stamp,''), old.hsn, old.category);
  INSERT INTO items_fts(rowid, name, sku, stamp, hsn, category)
  VALUES (new.id, new.name, new.sku, coalesce(new.stamp,''), new.hsn, new.category);
END;

-- backfill any existing seed rows
INSERT INTO items_fts(rowid, name, sku, stamp, hsn, category)
SELECT id, name, sku, coalesce(stamp,''), hsn, category FROM items;

CREATE VIRTUAL TABLE parties_fts USING fts5(
  name, phone, gstin,
  content='parties', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER parties_ai AFTER INSERT ON parties BEGIN
  INSERT INTO parties_fts(rowid, name, phone, gstin)
  VALUES (new.id, new.name, coalesce(new.phone,''), coalesce(new.gstin,''));
END;

CREATE TRIGGER parties_ad AFTER DELETE ON parties BEGIN
  INSERT INTO parties_fts(parties_fts, rowid, name, phone, gstin)
  VALUES ('delete', old.id, old.name, coalesce(old.phone,''), coalesce(old.gstin,''));
END;

CREATE TRIGGER parties_au AFTER UPDATE ON parties BEGIN
  INSERT INTO parties_fts(parties_fts, rowid, name, phone, gstin)
  VALUES ('delete', old.id, old.name, coalesce(old.phone,''), coalesce(old.gstin,''));
  INSERT INTO parties_fts(rowid, name, phone, gstin)
  VALUES (new.id, new.name, coalesce(new.phone,''), coalesce(new.gstin,''));
END;

INSERT INTO parties_fts(rowid, name, phone, gstin)
SELECT id, name, coalesce(phone,''), coalesce(gstin,'') FROM parties;

CREATE TABLE stock_adjustments (
  id          INTEGER PRIMARY KEY,
  ts          INTEGER NOT NULL DEFAULT (unixepoch()),
  item_id     INTEGER NOT NULL REFERENCES items(id),
  delta_qty   INTEGER NOT NULL DEFAULT 0,   -- +/- pcs
  delta_wt_mg INTEGER NOT NULL DEFAULT 0,   -- +/- milligrams
  reason      TEXT    NOT NULL,
  actor       TEXT    NOT NULL DEFAULT 'system'
);
CREATE INDEX stock_adj_item_idx ON stock_adjustments(item_id);
CREATE INDEX stock_adj_ts_idx ON stock_adjustments(ts);
