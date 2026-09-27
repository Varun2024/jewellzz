# Phases

> Purpose: MVP is Phases 0–2. Everything else is post-launch. Each phase has an explicit trigger to advance.

## Phase 0 — Scaffold & masters

- [x] Vite + React + TS + Electron shell boots (build green; launch pending on-machine verify)
- [x] better-sqlite3 wired, WAL mode, FK on
- [x] Schema for: `companies`, `settings`, `parties`, `items`, `audit_log` (metals + item_categories dropped — category+stamp on `items` covers it, per client)
- [x] SQL-file migrator + seed script (no drizzle-kit; sql files + `_migrations` table)
- [x] Backup harness: manual "Backup now" IPC + daily cron 02:00 + shutdown copy + retention 14
- [x] Restore script (`scripts/restore.ts`)
- [x] Tailwind + base layout with sidebar (shadcn deferred; not needed for scaffold)
- [ ] Masters CRUD screens — pushed to Phase 1 (only list IPCs exist so far; forms come with inventory UI)

**Trigger to advance:** app launches, IPC ping returns, seed data visible via master list IPCs. Restore drill runs on Node 22 / VS-equipped machine (or defer until CLI need arises).

## Phase 1 — Inventory + stock

- [x] Items list, add, edit (SKU, category, unit, stamp, HSN, GST %, labour, wastage, opening stock)
- [x] Parties CRUD (opening cash + opening metal)
- [x] Stock register view + click-through adjustment form
- [x] FTS5 search across items and parties, wired to top bar with `/` shortcut
- [x] Stock adjustment (loss/gain) with reason + history + audit
- [ ] Hand-test on dev machine (add 20+ items, verify search + adjust)

**Trigger to advance:** hand-test passes, no crashes on rapid entry.

## Phase 2 — Sale + purchase + ledgers (MVP finish line)

- [x] Cash + metal + party ledger tables (append-only, contra-reversal ready)
- [x] Sale screen: keyboard-first, multi-item, GST split (CGST+SGST / IGST auto), old-gold, cash/bank/old-gold payment split, F9 post+print
- [x] Sale post = one SQLite txn (line math + stock decrement + ledger writes + bill number + audit)
- [x] Purchase screen (supplier + lines + cash/bank payment)
- [x] A5 GST invoice PDF via pdfkit, opens in default viewer to print
- [x] Sales + purchase register CSV export (Excel opens directly)
- [ ] Hand-test end-to-end on dev machine (post 3 sales, 1 purchase, verify ledgers, print an invoice, export CSV, backup, restore drill)

**Trigger to advance:** hand-test passes. Shop can open.

**→ Ship to production here. Everything below is post-launch.**

## Phase 3+ (post-launch, priority order)

3. [x] Karigar module (issue/receive/ledger + labour payment)
4. [x] GST reports (GSTR-1 per-(invoice,rate) B2B/B2C, GSTR-3B summary, HSN summary — inline views + CSV exports)
5. [ ] Approval, repair, order
6. [ ] Refining
7. [ ] Tagging + cataloging
8. [ ] Multi-company + user roles
9. [ ] E-way bill JSON export
10. [ ] Bill format editor

## Skipped forever (unless explicitly revived)

- LAN/multi-user
- Cloud sync
- Mobile app
- Direct GSP portal API integration
- Tally/Busy handoff (Jewelzz is book of record)
