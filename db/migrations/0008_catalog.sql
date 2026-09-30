-- 0008: catalog (photos, collections, tags)
-- ponytail: photos are stored as files at %APPDATA%/jewelzz/photos/<uuid>.<ext>.
-- DB holds only the filename + optional caption. Renderer loads via a custom photo:// protocol.

ALTER TABLE items ADD COLUMN tags TEXT NOT NULL DEFAULT '';

CREATE TABLE item_photos (
  id           INTEGER PRIMARY KEY,
  item_id      INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  filename     TEXT    NOT NULL,           -- basename only; joined with photos dir at read
  caption      TEXT    NOT NULL DEFAULT '',
  position     INTEGER NOT NULL DEFAULT 0, -- 0 = primary
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX item_photos_item_idx ON item_photos(item_id);

CREATE TABLE collections (
  id           INTEGER PRIMARY KEY,
  name         TEXT    NOT NULL UNIQUE,
  description  TEXT    NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE item_collections (
  item_id       INTEGER NOT NULL REFERENCES items(id)       ON DELETE CASCADE,
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, collection_id)
);
CREATE INDEX item_col_col_idx ON item_collections(collection_id);
