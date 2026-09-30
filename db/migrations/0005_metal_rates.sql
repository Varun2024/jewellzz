-- 0005: daily metal rates per (category, stamp)
-- ponytail: rate is per-gram (paise). Stones and artificial priced per-line at sale time,
-- so this table is intentionally gold/silver only. History table skipped for MVP — audit_log
-- already captures rate changes since upserts go through an IPC handler.

CREATE TABLE metal_rates (
  id                INTEGER PRIMARY KEY,
  category          TEXT    NOT NULL CHECK (category IN ('gold','silver')),
  stamp             TEXT    NOT NULL,
  rate_paise_per_g  INTEGER NOT NULL CHECK (rate_paise_per_g > 0),
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_by        TEXT    NOT NULL DEFAULT 'operator',
  UNIQUE(category, stamp)
);
CREATE INDEX metal_rates_key ON metal_rates(category, stamp);

-- Seed defaults so the sale screen has something to auto-fill on day 1.
-- Operator can adjust in Settings anytime.
INSERT INTO metal_rates (category, stamp, rate_paise_per_g) VALUES
  ('gold',   '24k', 660000),   -- ₹6,600/g
  ('gold',   '22k', 605000),   -- ₹6,050/g
  ('gold',   '20k', 550000),   -- ₹5,500/g
  ('gold',   '18k', 495000),   -- ₹4,950/g
  ('silver', '999',   8500),   -- ₹85/g
  ('silver', '925',   7800);   -- ₹78/g
