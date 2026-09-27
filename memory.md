# Memory

> Purpose: session resumption cheatsheet. Read first on any new session.

## Project identity

Jewelzz — offline single-PC Electron app for a jewellery shop. Regular GST, A5 bill, old-gold in.

## Locked decisions

- Stack: Electron + React + TS + Vite + better-sqlite3 + Drizzle + Tailwind + shadcn/ui
- Money = integer paise. Weight = integer milligrams. Never float.
- Ledgers are append-only. Reversals via contra rows.
- Sale hot path uses raw prepared SQL, not Drizzle.
- One SQLite transaction per sale, WAL mode, FK on.
- MVP = Phases 0–2. Ship after Phase 2, iterate post-launch.
- Single company hardcoded in MVP. Multi-company post-launch.
- No auth in MVP. Single user.
- Bill format: one fixed A5 GST invoice template.
- Item shape (no separate `metals` master — category + stamp on item is the full spec):
  - `category` enum: `gold | silver | stone | artificial`
  - `unit` enum: `gms | carat | pcs`
  - `stamp` text, nullable — required when `category in (gold, silver)`, null otherwise. Examples: `22k`, `20k`, `18k`, `925`.
  - `labour_mode` enum: `pct | per_gram | per_pcs` + `labour_value` (int; pct in basis points, per_gram/per_pcs in paise)
  - `wastage_mode` enum: `pct | per_gram | per_pcs` + `wastage_value` (same units as labour)
  - Sale line inherits item defaults but every field is overridable at bill time.
- Carat/gram conversion: canonical weight is milligrams (rules.md). Stones may be *entered* in carat and *billed* in grams — UI toggles the display and does the conversion at input/output. `1 carat = 200 mg` fixed constant. Store mg, show whichever unit the operator picked. No separate stored "carat" value.

## What's built

- [x] PRD.md, README.md
- [x] Kickoff docs (PLAN, architecture, rules, phases, design, memory)
- [x] Phase 0 scaffold — Electron + Vite + React shell, better-sqlite3 wired (WAL, FK on), migrations runner, seed, backup (manual + daily cron 02:00 + shutdown copy), restore script, Tailwind + sidebar layout, `app.ping` IPC round-trip.
- [x] Phase 0 launch verified — window opens, IPC round-trip works.
- [x] Phase 1 — Parties CRUD, Items CRUD (category-aware stamp), Stock register + adjustments with history, FTS5 global search bar, F2–F10 shortcuts + `/` for search. All mutations audit-logged.
- [x] Phase 2 — Sale (F9 post+print), Purchase, three ledger tabs (cash/metal/party), CSV register exports, A5 GST invoice PDF via pdfkit → default viewer. Sale/purchase math in `electron/txn.ts` runs single SQLite txn.
- [x] Loading + error handling across every screen. `src/lib/useAsync.ts` + `src/components/Status.tsx`. Dev screen (F11) runs `electron/smoke.ts` for end-to-end verification with assertions on every derived total + ledger balance; deletes its own rows after.
- [x] Phase 3 karigar — dedicated `karigars` master + issue/receipt slips + `karigar_ledger` (metal + cash) + F8 Karigar screen with 4 tabs + inline pay-labour action. Smoke covers full cycle including wastage settlement.
- [x] Ledger-modern design system — Fraunces + General Sans + JetBrains Mono, parchment base + burnished gold accent, torn-ledger totals block, gold-dot sidebar, italic small-caps section labels, gold sweep loading bar. Applied to app + invoice PDF.
- [x] Brand identity — J-scale SVG mark (Fraunces J-hook + hanging pan + gold gem), `jewelzz` Fraunces italic wordmark, favicon = same SVG. `LogoMark` / `Wordmark` / `Logo` components in `src/components/Logo.tsx`. Same mark rendered with pdfkit primitives on invoice PDF.
- [x] Icon system — `@phosphor-icons/react` (regular weight; fill for active nav). Nav icons, category badges (gold/silver/stone/artificial), ledger direction arrows, first-launch hint lightbulb.
- [x] Idiot-proof pass — plain-English OwesIndicator cards on party + karigar ledgers, colored category badges everywhere, first-launch keyboard hint bar (localStorage-remembered).
- [x] GST reports — `electron/gst.ts` (GSTR-1 per-rate B2B/B2C, GSTR-3B summary, HSN summary) + Reports screen tabs + CSVs.
- [ ] Phase 3 continued = approval/repair/order, then refining, per phases.md order.

## What's not built yet

Everything after the docs. Next concrete step: Phase 0 scaffold (see phases.md).

## Non-obvious gotchas

- **better-sqlite3 native build on Windows.** Dev machine runs Node 24, but better-sqlite3 ships no Node 24 prebuild → falls back to node-gyp → needs Visual Studio Build Tools. Workaround used: manually ran `prebuild-install --runtime=electron --target=33.4.11 --arch=x64` inside `node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3` to fetch the electron-v130 prebuild. That binary works when loaded by Electron but NOT by system `node`/`tsx`. Consequence: **CLI scripts (`pnpm migrate:run`, `pnpm seed`, `pnpm backup`, `pnpm restore`) will not run under Node 24** — they need either Node 22 LTS installed or VS Build Tools. Migrations run automatically at Electron startup, so this isn't blocking. Revisit if we need CLI access to the DB.
- pnpm 11 quirks locked in: `pnpm-workspace.yaml` has `verifyDepsBeforeRun: false` (stops re-running install on every script) and `allowBuilds: {better-sqlite3, electron, esbuild}`. `.npmrc` has `block-exotic-subdeps=false`.
- **Electron binary must be manually installed** after `pnpm install` on this machine: `cd node_modules/.pnpm/electron@*/node_modules/electron && node install.js`. pnpm's approve-builds gate blocked the auto-postinstall on first run. Symptom: `Electron failed to install correctly` on launch.
- **`postinstall` runs `scripts/ensure-native.mjs`** which re-fetches the better-sqlite3 electron prebuild if the `.node` binary is missing. Any `pnpm install` that wipes `build/Release/better_sqlite3.node` will auto-recover on the next `pnpm install`. If Electron binary also missing after install, also re-run its `install.js` manually.
- `@electron/rebuild` was dropped from deps because a git-URL subdep tripped pnpm 11's exotic-subdep block. Not needed as long as we keep using the electron prebuild path above.
- FTS5 requires SQLite compiled with the extension — better-sqlite3 ships it.
- Thermal printer path is not MVP; A5 laser/inkjet via system print dialog is.
- Indian number grouping (`1,23,456`) — use `Intl.NumberFormat('en-IN')`, not the default `en-US`.
- GST invoice needs: seller GSTIN, buyer GSTIN (or "URP"), place of supply, HSN per line, tax split (CGST+SGST intra-state, IGST inter-state).

## Deferred / to-decide later

- E-way bill (post-launch, JSON export only)
- Barcode hardware model (post-launch, at tagging phase)
- Roles (post-launch)
- Tally/Busy handoff — decided NO, Jewelzz is book of record

## Session resumption checklist

1. Read `PLAN.md` progress log (bottom)
2. Read this file's "What's built" section
3. Check current phase in `phases.md`
4. Run `pnpm dev` and confirm app boots (once scaffolded)
