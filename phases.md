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
4b. [x] Settings + metal rates (Company details + daily gold/silver rates per stamp; auto-fill on sale + purchase; live status bar)
5. [x] Approval, repair, order — 3-tab Jobs screen (Kanban icon); stateful slips with status pipelines; approvals affect stock, repairs + orders touch ledgers on delivery/advance
6. [x] Refining — Recycle icon; send scrap → receive purified w/ loss + charges; contra-reversible cancel; refining loss absorbed by shop (visible in metal_ledger net)
7. [x] Tagging + cataloging — Catalog grid screen (Images icon); `photo://` custom protocol for local file loads; item detail modal with photos + collections + comma-tags editors; A4 label sheet with Code-128 barcodes via bwip-js + pdfkit (3×8 grid, 24 per page, bulk-select from catalog)
8a. [x] User roles + PIN auth — `users` table + scrypt-hashed PINs; owner seeded (PIN `1234`); PIN LoginScreen boot gate; role gate whitelist on 20+ owner-only channels (settings edits, deletes, exports, backup, karigar pay, refining, labels); audit_log actor = current user; Users card in Settings; current user + sign-out in status bar.
8b. [ ] Multi-company — deferred (single-shop MVP doesn't need it). Would require `company_id` FK on nearly every row + a company switcher. Revisit when a real second-shop customer asks.
9. [ ] E-way bill JSON export
10. [ ] Bill format editor

## Skipped forever (unless explicitly revived)

- LAN/multi-user
- Cloud sync
- Mobile app
- Direct GSP portal API integration
- Tally/Busy handoff (Jewelzz is book of record)
