-- 0007: refining lots
-- ponytail: single-lot in/out. Shop sends impure/scrap → refiner returns purified metal + records loss.
-- The refiner is any party (usually role='supplier'). Refining loss is expected + absorbed by the shop —
-- party_ledger metal credit at receipt equals the SENT weight (zeroes karigar-style debit),
-- and metal_ledger honestly reflects the shop's real balance (sent > received = net loss visible).

CREATE TABLE refining_lots (
  id                    INTEGER PRIMARY KEY,
  slip_no               TEXT    NOT NULL UNIQUE,
  ts                    INTEGER NOT NULL DEFAULT (unixepoch()),
  refiner_party_id      INTEGER NOT NULL REFERENCES parties(id),

  sent_category         TEXT    NOT NULL CHECK (sent_category IN ('gold','silver')),
  sent_stamp            TEXT    NOT NULL DEFAULT '',
  sent_weight_mg        INTEGER NOT NULL CHECK (sent_weight_mg > 0),

  received_category     TEXT,
  received_stamp        TEXT,
  received_weight_mg    INTEGER NOT NULL DEFAULT 0,
  loss_mg               INTEGER NOT NULL DEFAULT 0,

  charges_paise         INTEGER NOT NULL DEFAULT 0,
  paid_cash_paise       INTEGER NOT NULL DEFAULT 0,
  charges_balance_paise INTEGER NOT NULL DEFAULT 0,

  status                TEXT    NOT NULL DEFAULT 'sent'
                          CHECK (status IN ('sent','received','cancelled')),
  received_at           INTEGER,
  notes                 TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX refining_party_idx ON refining_lots(refiner_party_id);
CREATE INDEX refining_ts_idx    ON refining_lots(ts);
CREATE INDEX refining_status_idx ON refining_lots(status);
