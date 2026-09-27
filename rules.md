# Project rules

> Purpose: Jewelzz-specific rules that extend global rules. Read once per session.

## Money & weight

- All monetary amounts stored as **integers in paise** (₹1 = 100). Never float.
- All weights stored as **integers in milligrams** (1 g = 1000). Never float.
- Display-layer conversion only. Never arithmetic on displayed strings.
- GST rates stored as basis points (300 = 3.00%).

## Ledgers

- Append-only. No UPDATE, no DELETE, ever. Reversal = new row with `reverses_id`.
- Every ledger-affecting operation runs inside one `db.transaction(() => {...})`.
- Balance queries always use indexed running-sum, never full scan.

## Sale posting

- Validate → transact → print. Never print before commit.
- If print fails after commit, surface a reprint action. Do not roll back.
- Bill number is issued *inside* the transaction from a monotonic counter table.

## Schema

- Drizzle migrations checked in. No hand-editing production DB.
- Every table has `created_at`, `updated_at` (except append-only ledgers, which only have `created_at`).
- Foreign keys ON. `PRAGMA foreign_keys = ON` at connection.
- WAL mode set at connection open.

## Hot path

- Sale post uses raw prepared statements, not Drizzle query builder. Measured, not vibes.
- Search uses FTS5. Never `LIKE '%x%'` on user-typed queries.

## UI

- Keyboard-first on sale, purchase, stock search. Every action must have a shortcut.
- No modal dialogs on the sale screen. Inline expansions only.
- Numeric inputs snap to money/weight precision on blur.

## Backup

- Daily auto-backup runs at app close and 02:00 local.
- Retention: 14 daily + 8 weekly. Prune older.
- "Backup now to USB" button copies latest to selected removable drive.

## When to break these rules

- Prototype a feature outside the sale hot path? Drizzle is fine.
- Reporting query on ledgers? Read-only view queries can join freely.
- Never break: append-only ledgers, integer money/weight, FK-on, single transaction per sale.
