# Jewelzz — Prototype PRD

> Prototype spec. Everything here is a starting point, not a contract. Stack is a recommendation, not locked.

## 1. Product identity

Internal jewellery shop management app. Runs on a single PC, works offline. Handles counter transactions, karigar (goldsmith) workflow, cash/metal/party accounting, and Indian GST statutory reports for a jewellery business.

**Target user:** shop owner + 1–2 counter staff on the same machine.
**Not in scope (v1):** LAN multi-user, cloud sync, mobile app, direct portal API integrations.

## 2. Recommended stack (suggestion)

**Electron + React + TypeScript + Vite + SQLite (better-sqlite3) + Drizzle ORM + Tailwind + shadcn/ui.**

Rationale:
- Offline-first single PC → local SQLite is the correct storage.
- Electron over Tauri here because bill printing (thermal + A4/A5), PDF/Excel export, USB backup, and barcode scanner IO all have mature Node ecosystem support.
- React + TS matches existing dev skillset.
- Drizzle keeps schema migrations manageable as modules land incrementally.
- `better-sqlite3` gives synchronous transactions (fast for counter UX) and one-line `.backup()`.
- `electron-updater` for updates, `electron-builder` for installers.

**Alternatives to keep on the shelf:** Tauri (smaller binary — reconsider if bill-print libs are adequate), plain Next.js run locally (overkill).

## 3. Module tree

```
Jewelzz
├── Masters
│   ├── Companies              (multi-company switcher)
│   ├── Parties                (customers + suppliers, one entity with role flag)
│   ├── Karigars               (goldsmiths)
│   ├── Metals & Purities      (Au 22k/18k, Ag, Pt, stones)
│   ├── Item Categories & HSN
│   └── Bill Formats           (invoice / challan / estimate / approval memo templates)
│
├── Inventory
│   ├── Stock Register         (item-level: weight, purity, making, stone)
│   ├── Tagging                (barcode/QR label generation & print)
│   ├── Cataloging             (photos, tags, collections, search)
│   └── Stock Adjustments      (loss/gain, physical count reconciliation)
│
├── Transactions
│   ├── Sale                   (registered, GST invoice)
│   ├── Challan Sale           (delivery challan, no invoice yet)
│   ├── Purchase               (registered supplier)
│   ├── Challan Purchase       (goods in on challan)
│   ├── Unregistered Purchase  (URD / old-gold from walk-in)
│   ├── Approval Issue         (goods out on approval)
│   ├── Approval Receive       (approval back — sold or returned)
│   ├── Repair                 (customer item in → work → out)
│   └── Order                  (customer order → advance → make → deliver)
│
├── Karigar
│   ├── Issue to Karigar       (raw metal + stones out)
│   ├── Receive from Karigar   (finished goods + wastage + labour)
│   ├── Karigar Ledger         (metal-in / metal-out / balance per karigar)
│   └── Labour Payable
│
├── Refining
│   ├── Send for Refining      (impure/scrap lot out)
│   ├── Receive from Refining  (pure metal in + loss %)
│   └── Refining Ledger
│
├── Ledgers
│   ├── Cash Ledger            (cash in/out per company)
│   ├── Metal Ledger           (per metal + purity, running balance in grams)
│   ├── Party Ledger           (per party: cash + metal outstanding)
│   └── Day Book
│
├── Reports
│   ├── GST — GSTR-1, GSTR-3B summary, HSN summary
│   ├── E-Way Bill             (JSON export for portal)
│   ├── Stock Valuation
│   ├── Sales / Purchase Register
│   └── Karigar Wastage Report
│
└── System
    ├── Multi-Company Switcher
    ├── Data Backup            (manual + scheduled → USB/folder)
    ├── Restore
    ├── Users & Roles          (owner vs counter staff)
    └── Settings               (GSTIN, rates, format prefs)
```

## 4. Requirement-by-requirement

| # | Requirement | What it means |
|---|---|---|
| 1  | Inventory | Item-level stock: weight (gross/net/stone), purity, making charge, category, HSN, location. Real-time balance updated on every transaction. |
| 2  | Cash Ledger | Running cash book per company. Every cash-affecting transaction posts here. Opening balance + date filter + PDF export. |
| 3  | Metal Ledger | Per (metal, purity) running balance in grams. Sale, purchase, karigar issue/receive, refining all post here. Physical vs book reconciliation view. |
| 4  | Party Ledger | Per party: two columns — cash outstanding and metal outstanding. Statement PDF export. |
| 5  | Sale | Full GST invoice. Multi-item, making charge, stone charge, GST split (CGST/SGST/IGST), round-off, discount. Payment split across cash / bank / part-metal (old-gold exchange). |
| 6  | Challan Sale | Delivery challan without tax invoice. Convertible to invoice later. Pending-challans view. |
| 7  | Purchase | From registered supplier. Books to stock + party ledger + GST input credit. |
| 8  | Challan Purchase | Goods received against supplier challan; invoice pending. |
| 9  | Unregistered Purchase | URD / old-gold buy from walk-in customer. RCM flag. Feeds scrap lot for refining. |
| 10 | Approval Issue | Goods leave shop on approval to a party. Not a sale yet. Stock flagged `on_approval`. |
| 11 | Approval Receive | On return: convert to sale, partial sale + return, or full return. Stock and ledgers reconciled accordingly. |
| 12 | Repair | Customer's item in → assigned karigar → out. Tracks customer material weight, additions, labour, promised delivery date. |
| 13 | Order | Customer places order → advance received → assign karigar → deliver → invoice. Explicit status pipeline. |
| 14 | Karigar Management | Karigar master, issue/receive slips, per-karigar metal & labour ledger, wastage tracking, payable balance. |
| 15 | Metal Refining | Send impure/scrap lot → receive purified metal + record loss %. Refining party ledger. |
| 16 | GST Reports | GSTR-1 (outward), GSTR-3B summary, HSN-wise summary. Export JSON / Excel for portal upload (no direct API v1). |
| 17 | E-Way Bills | Generate e-way bill data for invoices above threshold. JSON export for GSP/portal. |
| 18 | Cataloging | Item photos, tags, collections. Searchable by design/weight/stone/style. Shareable catalog view (PDF/link). |
| 19 | Inventory Tagging | Barcode/QR label print per item — SKU, weight, purity, code. Scan on sale to auto-fill line item. |
| 20 | Bill Format | Multiple templates (GST invoice, estimate, challan, approval memo). Template editor or template files with variables. |
| 21 | Data Backup | Automatic daily SQLite backup to configured folder + manual "Backup now" to USB. Encrypted option. Retention config. |
| 22 | Multiple Companies | Switch company at login / top-bar. Data isolated per company. Shared masters (parties, karigars) optional. |

## 5. Cross-cutting flows

**Sale flow**
Pick party → scan/select items → auto-fill weight/purity/rate → add making + stone charges → apply old-gold exchange (posts to metal ledger) → GST calc → payment split → print bill → post to stock + cash + metal + party ledgers atomically.

**Karigar cycle**
Issue slip (metal out → karigar ledger debit) → work-in-progress → receive slip (finished item into stock + wastage recorded + labour credited to karigar payable).

**Approval → sale**
Approval issue (stock flagged `on_approval`) → later either (a) approval receive-back (stock restored) or (b) convert to sale (stock consumed, invoice generated, ledgers posted).

**Order flow**
Order placed → advance received (cash ledger + party ledger credit) → karigar assigned → item finished → delivered → invoice generated → balance settled.

**Backup**
On app close + scheduled cron → `sqlite.backup()` → timestamped file in configured folder → retention policy prunes old backups → manual "Backup now to USB" button.

## 6. Data model sketch (headline tables)

```
companies, users, settings, audit_log

parties, karigars, metals, item_categories, bill_templates

items, item_photos, stock_ledger

sales, sale_items
purchases, purchase_items
challans, challan_items
approvals, approval_items
repairs, orders
refining_lots

cash_ledger, metal_ledger, party_ledger, karigar_ledger
```

**Ledger discipline:** ledger tables are append-only. No updates, no deletes. Reversals via explicit contra entries. Balances = `SUM(debit) - SUM(credit)` with running-total view. Every transaction writes to the relevant ledger(s) inside a single SQLite transaction so partial state is impossible.

**Audit log:** every mutating operation writes to `audit_log` with user, timestamp, entity, before/after JSON.

## 7. Non-functional requirements

- **Startup:** < 3s cold.
- **Sale posting:** < 200ms including print job dispatch.
- **Search:** stock/party/item search < 100ms for 100k rows.
- **Backup:** < 10s for typical DB size (< 500MB).
- **Restore drill:** documented, one-command; verified quarterly.
- **Offline:** 100%. No feature depends on network in v1.

## 8. Open questions (answer before v1 scaffold)

- **GST scheme:** composition or regular? Changes invoice fields and GSTR-1 shape.
- **E-way bill:** direct GSP API integration (needs GSP account + ₹) or JSON export only?
- **Old-gold buy RCM:** applicable in your state's practice?
- **Multi-company:** shared parties/karigars across companies, or fully isolated?
- **Barcode hardware:** printer model (Zebra? TSC?) and scanner. Decides label templates and IO layer.
- **Bill print sizes:** thermal 3-inch, A5, A4 — which does the shop use? All three?
- **User roles:** just owner + counter, or granular (owner / manager / counter / karigar-in-charge)?
- **Existing accounting handoff:** Tally / Busy export needed, or Jewelzz is the book of record?
- **Financial year handling:** rollover behavior (new company per FY, or one company across FYs with FY filter)?

## 9. Phasing suggestion

- **Phase 0** — scaffold, DB schema, masters (companies, parties, karigars, metals, items), settings, backup.
- **Phase 1** — inventory + tagging + cataloging + stock adjustments.
- **Phase 2** — sale, purchase, challan variants, cash ledger, metal ledger, party ledger.
- **Phase 3** — karigar issue/receive + karigar ledger, unregistered purchase, refining.
- **Phase 4** — approval, repair, order.
- **Phase 5** — GST reports, e-way bill export.
- **Phase 6** — bill format editor, multi-company polish, user roles.

Each phase ends with a data backup + restore drill.
