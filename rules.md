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

## Identity — the prohibition list

Identity comes from what we refuse to do. If a feature can't be built without breaking one of these, discuss it first, don't just do it.

- **No box shadows.** Ever. Depth comes from hairline borders (`1px solid var(--rule)`) and surface colour shifts (`--paper` → `--paper-2` → `--paper-3`). If it needs a shadow, it doesn't belong.
- **No second accent colour.** Gold is the only saturated colour we own. Semantic colours (`--rose-500` danger, `--moss-600` success, `--amber-500` warn) exist only for status, never for decoration.
- **No gradients.** Flat surfaces, hairlines, and the parchment palette. The one exception is the first-launch hint bar's paper-to-sand fade, which reads as physical paper, not a designed effect.
- **Border radius ceiling is 6px.** `--r-sm 3px`, `--r-md 4px`, `--r-lg 6px`. Nothing rounder. No pills, no full-circle chips except status dots.
- **No emoji anywhere.** Icons only. The rare arrow (`▲` / `▼` in the rate ticker) is fine because it's a mathematical glyph, not decoration.
- **Fraunces italic on all section labels, screen titles, tab titles, and the TOTAL amount.** Never Inter for these. Fraunces italic IS the brand signature at the type layer.
- **Numbers are always mono, always tabular, always right-aligned in tables.** Roboto Mono with `tnum` + `zero` OpenType features. No exceptions — currency + weights must line up like an actual ledger book.
- **The gold gem appears at every emotional moment.** Sale-post success (the Weighing), backup success (flash-gold), first-login (ambient Weighing on Home), day-close. If a moment matters, the gem shows up. If the gem doesn't fit, question whether the moment matters.
- **Voice, not corporate SaaS.** Button labels, empty states, status text, and loading text carry the ledger metaphor. `Weigh & print`, not `Post & print`. `Seal the day`, not `Backup now`. `Close the counter`, not `Sign out`. If a string reads like every other SaaS, it needs to be rewritten before it ships.
- **The Weighing is sacred.** The signature animation runs *only* on sale-post success. Do not put it on backup, on login, or on anything else — its impact comes from being reserved for the primary emotional beat.
- **No modal dialogs on the sale screen.** Inline expansions only. Modals are allowed elsewhere (Bell, Catalog detail) but never in the counter's critical path.

## When to break these rules

- Prototype a feature outside the sale hot path? Raw SQL through the migrator is fine — no ORM needed.
- Reporting query on ledgers? Read-only view queries can join freely.
- Never break: append-only ledgers, integer money/weight, FK-on, single transaction per sale.
- Identity rules above: never break silently. If you break one, add a `ponytail:` comment naming which rule and why.
