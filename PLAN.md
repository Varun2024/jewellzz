# PLAN

> Purpose: MVP scope, stack, folder layout, and dated progress log. Read this first every session.

## Product

Offline single-PC jewellery shop app. Regular GST scheme. A5 bill print. Old-gold exchange in MVP.

## Stack (locked)

- Electron + React + TypeScript + Vite
- SQLite via better-sqlite3 (WAL mode, FTS5 for search)
- Drizzle ORM everywhere except the sale hot path (raw prepared SQL there)
- Tailwind + shadcn/ui
- electron-builder for installer, electron-updater for updates
- Printing: node-thermal-printer + pdfkit for A5 PDF; system print dialog for the A5 laser/inkjet path

Speed rules baked in:
- WAL mode on boot
- One SQLite transaction per sale
- Prepared statements cached
- FTS5 virtual tables for stock/party/item search
- Keyboard-first sale screen (no mouse required)

## MVP scope (ship this, nothing more)

1. Masters: company (single, hardcoded name in settings), parties, metals+purities, item categories, items
2. Stock register (auto-updated from sale/purchase)
3. Sale: multi-item, making + stone charges, GST split, old-gold exchange line, payment split (cash/bank/old-gold)
4. Purchase (registered supplier)
5. Ledgers: cash, metal (per metal+purity, grams), party (cash + metal columns)
6. Bill print: one A5 GST invoice template
7. Backup: daily auto → configured folder + "Backup now" button

Deferred to post-launch: karigar, refining, approval, repair, order, GST reports (Excel export of sales register only), tagging/cataloging, multi-company, roles, e-way bill, bill format editor.

## Folder structure

```
jewelzz/
├── PRD.md, README.md, PLAN.md, architecture.md, rules.md, phases.md, design.md, memory.md
├── electron/          main + preload
├── src/               React renderer
│   ├── app/           routing, layout
│   ├── features/      sale, purchase, stock, ledgers, masters, backup
│   ├── components/    shared UI
│   ├── lib/           db, print, backup, gst, money, keyboard
│   └── styles/
├── db/
│   ├── schema.ts      Drizzle schema
│   ├── migrations/
│   └── seed.ts
├── build/             electron-builder config, icons
└── scripts/           dev, build, migrate
```

## Progress log

- **2026-09-29** — PRD reviewed. Stack locked (Electron + better-sqlite3). MVP scope cut to 7 modules. Regular GST, A5 print, old-gold in. Kickoff docs written. Item shape locked (category/unit/stamp/labour/wastage — see memory.md).
- **2026-09-29** — Phase 0 scaffold complete. Electron shell + Vite renderer + Tailwind sidebar + IPC ping + SQLite (WAL/FK) + migrator + seed (1 company, 2 parties, 4 sample items covering all category/unit/labour/wastage modes) + backup harness (manual IPC + daily cron + shutdown copy + retention 14). Typecheck green, Electron build green. Native build gotcha logged in memory.md.
- **2026-09-30** — Launch verified end-to-end (window opens, IPC works, better-sqlite3 electron prebuild loads). Design/polish deferred; Phase 1 = function-only build of inventory + stock + FTS5 search + masters CRUD.
- **2026-09-30** — Phase 1 complete. Migration 0002 (FTS5 for items + parties, stock_adjustments). Shared IPC contract in `shared/ipc.ts` with zod schemas + channel enum. Handlers with audit_log on every mutation. Screens: Parties CRUD, Items CRUD (category-aware stamp field), Stock register + adjustments with history. Global SearchBar in the top bar, `/` shortcut focuses it, F2–F10 nav shortcuts, results route to Items/Parties screen. Typecheck + electron build green. Next: run `pnpm start` to hand-test; Phase 2 = sale + purchase + ledgers.
- **2026-09-30** — Phase 2 (MVP finish line) complete. Migration 0003 (sales, sale_items, sale_payments, purchases, purchase_items, cash/metal/party ledgers — all append-only). `electron/txn.ts` holds sale/purchase math in one SQLite transaction each: line taxable = metal + making + wastage; CGST+SGST intra-state vs IGST inter-state (auto from party.state vs company.state); old-gold = old-gold payment writes `sale-old-gold` metal debit and reduces balance. Bill number monotonic via `settings.bill_next_no`. Sale screen keyboard-first with F9 post+print, party+item pickers debounced through FTS5. Purchase screen (supplier filter, simple). Ledgers screen with 3 tabs — cash (running balance), metal (per category+stamp bucket), party (per-party cash + metal). Reports = CSV export of sales / purchase register. Backup screen with manual button + status. A5 GST invoice PDF via pdfkit, opens in default viewer for printing. Everything mutating goes through audit_log. MVP feature-complete on scaffold; needs hand-testing next.
- **2026-09-30** — Settings + rate management (real MVP gap addressed before Phase 3 #5). Migration 0005 adds `metal_rates(category, stamp, rate_paise_per_g, updated_at, updated_by, UNIQUE(category, stamp))` — gold+silver only (stones + artificial priced per-line at sale time). Seeded with 24k/22k/20k/18k gold + 999/925 silver as day-1 defaults. `rates.list/upsert/delete` IPC channels with audit_log on every write. `SettingsScreen` at sidebar item (no F-key to avoid F9=sale-post collision) with two cards: Company (name, GSTIN, state, address, phone — uses existing companyGet/Update) + Today's metal rates (click-to-edit inline, Enter saves, Esc cancels, "last updated" relative time, Add rate expander, per-row delete). Auto-fill on Sale + Purchase: `useSaleDraft` now takes a `RateMap`; `makeDraftLine` prefills `ratePerUnit` when the item's (category, stamp) has a rate — gms items get ₹/g directly, carat items get ₹/g × 0.2 (per-carat), pcs items skip. Status bar footer shows live Au22k + Ag925 rates from a 30s-polled cache. GearSix icon in the sidebar. Everything under one card per screen, gold accent on section icons.
- **2026-09-30** — Phase 3 #5 shipped: Approval / Repair / Order pipelines. Migration 0006 adds `approvals` + `approval_items`, `repairs`, `orders`, each with a `status` CHECK enum and slip counters (AP-/RP-/OR- via settings). `electron/pipelines.ts`: `createApproval` decrements items stock inside one txn; `resolveApproval('returned'|'cancelled')` restores stock, `sold` leaves it out (operator posts a real Sale separately, optionally linked via `resolved_sale_id`). `createRepair` doesn't touch shop stock (customer's material); status transitions guarded (no changes past delivered/cancelled); `deliverRepair` writes cash_ledger (cash portion) + party_ledger balance if non-zero. `createOrder` + `receiveOrderAdvance` (cash_ledger debit + party_ledger cash credit — party paid ahead) + `updateOrderStatus`. Jobs screen (sidebar, Kanban icon, no F-key) with 3 tabs; each has an expandable New-slip form, colored `StatusChip`, and inline pipeline actions (Approvals: sold/returned/cancel · Repairs: start/ready/deliver-with-cash · Orders: advance/start/ready/delivered). Smoke covers create-return-stock-restore invariant, create-sell-stock-out invariant, full repair cycle asserting cash ledger +₹1000, full order cycle asserting cash + party credit, and a double-delivery rejection guard.
- **2026-09-30** — Brand identity + icon system + idiot-proofing pass. `src/components/Logo.tsx` holds `LogoMark` (SVG J-scale: Fraunces italic J-shaped hook + single hanging pan + gold gem — reads as jewellery scale AND our initial, ownable, works at 16px favicon), `Wordmark` (Fraunces italic 500 lowercase), and full `Logo` lockup. Favicon in `index.html` is the same mark as inline data-URI SVG. Sidebar now leads with the mark + wordmark. Phosphor Icons React added as dep — nav items get category-appropriate icons (Receipt/ShoppingBag/Package/BookOpen/Users/Tag/Hammer/ChartLineUp/FloppyDisk/Wrench) that switch to `fill` weight when active + turn gold. `src/components/CategoryBadge.tsx` renders per-category chips (gold/silver/stone/artificial) with distinct color + icon + optional stamp — used in Items + Stock tables so operators never have to read the word. Party ledger and Karigar ledger now show a fat `OwesIndicator` card at the top with arrow + plain English "SHOP OWES PARTY" or "PARTY OWES SHOP" or "ALL SETTLED", colored by semantic meaning (rose = someone owes shop, moss = shop owes / all clear, amber = shop owes labour). First-launch hint bar (dismissible, remembered via localStorage) surfaces F2/F3/F9/F10 keys with a lightbulb icon. Invoice PDF gains the same J-scale mark rendered with pdfkit primitives top-left of A5, matching the app icon.
- **2026-09-30** — Ledger-modern design system landed (user-picked direction). Fonts: Fraunces (display / section labels / TOTAL), General Sans from Fontshare (UI body, Indian type foundry), JetBrains Mono w/ tabular figures for all numbers. Palette: parchment-cream base (#F6F2EA), warm ink text (#14100E), burnished gold accent (#B8892E), deep vermilion danger. Signature moves: (1) totals block with gold double-hairline over TOTAL — reads like a torn ledger receipt, (2) Fraunces italic small-caps section labels with 0.14em tracking ("— items —————"), (3) sidebar with gold-dot marker instead of pill/fill, (4) bottom status bar with dot indicators (IPC / backup / metal rate placeholder), (5) keyboard shortcut chips inside buttons, (6) gold sweep loading bar over tables replaces most spinners. Instant focus rings (0ms), 120/180ms motion on hover/tabs, `prefers-reduced-motion` respected. Files: `index.html` (font links), `src/styles/index.css` (full token + component rewrite), `tailwind.config.js` (new theme), `src/app/Shell.tsx` (sidebar/header/status-bar), `src/components/Status.tsx` (restyled), `src/features/sale/SaleScreen.tsx` (totals block gets torn-ledger treatment, section labels replace plain text labels), tabs classes applied to Ledgers/Karigar/Reports. Invoice PDF (`electron/print.ts`) mirrors the same language — Fraunces italic title, gold double-hairline over TOTAL, Courier for numbers, section labels in italic. No structural HTML changes, no new deps. Typecheck + Electron build green.
- **2026-09-30** — GST reports (post-launch #4) complete. No schema change — pure reports over existing sales/purchases. `electron/gst.ts` holds `computeGstr1` (per-(invoice, rate) split B2B/B2C using party.gstin presence, one row per rate), `computeGstr3b` (outward taxable + CGST/SGST/IGST split by B2B vs B2C, plus ITC from purchases), `computeHsnSummary` (group sale_items by hsn+rate+unit with qty, weight in grams, taxable, and tax split). CSV exporters for each drop into `%APPDATA%/jewelzz/exports/` and auto-open. Reports screen refactored into 4 tabs: Registers (existing sales/purchase CSV) + GSTR-1 (inline table with B2B/B2C badge + CSV) + GSTR-3B (4 summary cards + CSV) + HSN summary (grouped table + CSV). Date range picker at the top applies to all four tabs. Smoke test extended with 4 GST assertions including reconciliation of GSTR-3B outward totals against sum of sales headers.
- **2026-09-30** — Phase 3 (karigar) complete. Migration 0004 adds `karigars` master (dedicated table per PRD, with karigars_fts), `karigar_issues` + `karigar_issue_items`, `karigar_receipts` + `karigar_receipt_items`, and `karigar_ledger` (append-only, tracks per-karigar cash + metal-per-bucket). Ledger convention: metal debit = karigar owes shop metal, metal credit = karigar returned metal (receipt+wastage settles), cash credit = shop owes labour, cash debit = labour paid. `electron/karigar.ts` holds three one-txn handlers: `postKarigarIssue` (metal_ledger credit + karigar_ledger metal debit), `postKarigarReceipt` (metal_ledger debit on received-only + karigar_ledger metal credit on received+wastage + karigar_ledger cash credit for labour claim + items stock update if item_id given), `payKarigar` (cash_ledger credit + karigar_ledger cash debit). Slip numbers `KI-####` / `KR-####` via settings counters. Karigar screen at F8 with 4 tabs: Karigars (CRUD with per-karigar cash + metal balances), Issue (multi-line metal out), Receive (multi-line received + wastage + labour + optional item stock-in + inline pay button), Ledger (per-karigar running balance view). Smoke test extended: creates karigar, issues 20g gold-22k, receives 19g + 1g wastage + ₹5000 labour, asserts karigar metal balance = 0 (settle = received+wastage), shop-metal_ledger only credits the 19g received (not wastage), cash credit -₹5000 (shop owes), then pays and asserts settlement to 0. Shell nav updated: Karigar F8, Reports moved to F12 (F9 stays as Sale-post to avoid keystroke collision).
- **2026-09-30** — Loading + error handling pass across all screens. Added `src/lib/useAsync.ts` (useAsync + useMutation hooks with `errText` helper) and `src/components/Status.tsx` (Spinner / ErrorBanner / LoadingBlock / EmptyState). Retrofit: Parties, Items, Stock, Sale, Purchase, Ledgers (all 3 tabs), Reports, Backup, SearchBar. Every mutation shows a spinner + disables the button; every error surfaces as a dismissible banner instead of a raw string; every initial load shows a spinner block. Also added an in-app **Dev screen** (F11) with a "Run smoke test" button — invokes `dev.smoke` IPC which runs `electron/smoke.ts`: creates 3 parties + 4 items (all category/unit combos), asserts the two schema CHECK constraints reject bad data, runs FTS5 lookups, posts a purchase then verifies stock + metal ledger, posts a multi-line intra-state sale with cash+bank+old-gold and asserts every derived total (subtotal, cgst/sgst split, party balance, metal buckets, stock decrement), posts an inter-state sale and asserts IGST-only path, generates the A5 PDF invoice, exports both CSVs, runs a backup, verifies the sales-total reconciliation invariant, then deletes all test rows. Run it any time to end-to-end verify the MVP.
