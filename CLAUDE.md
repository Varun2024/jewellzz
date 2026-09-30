# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read first

- `PRD.md` — product spec (jewellery shop MVP scope)
- `phases.md` — phase checklist, always update when finishing a chunk
- `memory.md` — locked decisions + non-obvious gotchas (native build, ledger conventions, item shape)
- `rules.md` — money-in-paise / weight-in-mg / append-only ledger discipline
- `PLAN.md` — dated progress log; append an entry at the end of each significant chunk

## Commands

```bash
pnpm start            # vite dev + electron in parallel — the dev loop
pnpm typecheck        # renderer + electron tsc --noEmit
pnpm build:electron   # rebuild dist-electron/ after any electron/ change
pnpm build            # full production build
```

CLI scripts (`pnpm migrate:run`, `seed`, `backup`, `restore`) **do not run under this machine's Node 24** — better-sqlite3 has no Node 24 prebuild and there's no VS Build Tools. Only the Electron path works. Migrations + seed run automatically inside `openDb()` on Electron boot, so this is rarely blocking.

## Native-build fragility (Windows / Node 24)

After any `pnpm install`:
- `postinstall` runs `scripts/ensure-native.mjs` which re-fetches the better-sqlite3 electron-v130 prebuild if `build/Release/better_sqlite3.node` is missing.
- If Electron itself fails with "Electron failed to install correctly", run once:
  `cd node_modules/.pnpm/electron@*/node_modules/electron && node install.js`
- `pnpm-workspace.yaml` intentionally has `allowBuilds.better-sqlite3: false` — do NOT flip this on. Our postinstall handles it via prebuild-install; letting pnpm run better-sqlite3's own gyp will fail on this machine.

## Architecture

```
electron/  main process — CommonJS, tsc → dist-electron/
  db.ts         opens SQLite (WAL, FK on), runs migrations + seed on boot
  ipc.ts        registers every handler; every mutation writes audit_log
  txn.ts        postSale / postPurchase — one SQLite transaction each
  karigar.ts    postKarigarIssue / postKarigarReceipt / payKarigar
  gst.ts        GSTR-1 / GSTR-3B / HSN engines
  print.ts      pdfkit A5 invoice + inline J-scale logo
  export.ts     CSV writers (registers + GST)
  backup.ts     better-sqlite3 .backup() + node-cron 02:00 + shutdown copy
  smoke.ts      end-to-end assertion suite invoked by Dev screen

shared/ipc.ts   single source of truth — zod schemas + CH channel enum;
                imported by both main and renderer

db/
  migrations/*.sql   append new numbered files; migrator applies missing ones inside a txn
  migrator.ts        applies + seeds; seed uses INSERT OR IGNORE (idempotent)

src/                renderer — Vite + React + TS
  app/Shell.tsx     sidebar nav, first-launch hint bar, bottom status bar
  features/*        one folder per screen; screens use useAsync + useMutation
  lib/useAsync.ts   loading/error primitives
  lib/format.ts     fmtPaise, fmtGrams, fmtCarat, gramsToMg, etc.
  components/       Logo, CategoryBadge, Status (Spinner/ErrorBanner/LoadingBlock/EmptyState)
  styles/index.css  tokens + component classes (.input .btn .totals .tabs .section-label .kbd)
```

## Ledger discipline (never break)

- `cash_ledger`, `metal_ledger`, `party_ledger`, `karigar_ledger` are **append-only**. Reversals = new contra row with `reverses_id`. No UPDATE, no DELETE, ever.
- Sale post = one `db.transaction`: insert sales+sale_items → decrement items stock → append cash/metal/party ledger rows → append audit_log. If any step throws, the whole thing rolls back.
- Bill number is issued inside the txn from `settings.bill_next_no` (monotonic).
- Money is integer paise. Weight is integer milligrams. Never floats.
- Stone/carat conversion: `1 carat = 200 mg` (constant in `lib/format.ts`).
- Sale rate is per-line and per-gram for gms items, per-carat for carat items, per-pcs for pcs items — see the `mgPerUnit()` helper in `electron/txn.ts`.

## Data model constraints worth knowing

- `items.stamp` is required for gold/silver, **forbidden** for stone/artificial (SQL CHECK constraint, also enforced by `ItemInput` zod refine).
- `metal_rates` is gold/silver only; auto-fills sale + purchase line rates; stones/artificial are per-line pricing.
- Interstate is auto-computed from `company.state_code` vs `party.state_code` — CGST+SGST intra-state, IGST inter-state.
- Old-gold is a `sale_payments.kind='old_gold'` row that ALSO writes a `metal_ledger` debit with `ref_type='sale-old-gold'`.

## IPC pattern

Add a new mutation:
1. Add zod schema + channel name to `shared/ipc.ts`.
2. Register handler in `electron/ipc.ts` using the `on()` wrapper (validates via `z.infer<typeof Schema>` inference).
3. Emit `audit_log` inside the handler.
4. Call from renderer via `invoke(CH.foo, payload)` from `@/lib/ipc`.

The `on()` helper's signature is `on<S extends z.ZodTypeAny, R>(ipc, channel, schema | null, fn)` — using a naked `z.ZodType<T>` breaks inference. Follow the pattern.

## Smoke test — verify end-to-end

The Dev screen (F11) runs `electron/smoke.ts`. Any new phase should add assertion steps: create synthetic rows with a unique run id, exercise the new handlers, assert exact numeric outcomes + ledger invariants, then delete the smoke rows in the cleanup step. Idempotent — safe to re-run.

## Design system

The look is **"ledger-modern"** (Fraunces italic display + General Sans body + JetBrains Mono numbers on a parchment #F6F2EA base with burnished-gold #B8892E accent). Component classes live in `src/styles/index.css`:

- `.section-label` — Fraunces italic small-caps for `— items ——————` headers
- `.totals` — the torn-ledger receipt grid with gold `.rule-double` above TOTAL
- `.ledger-table`, `.tabs`, `.tab`, `.card`, `.kbd`, `.nav-item`, `.statusbar`
- `.loadbar` — gold sweep (preferred over spinners inside tables)

Icons come from `@phosphor-icons/react` — `regular` weight, `fill` for active nav. `CategoryBadge` renders the four item categories as coloured chips; use it everywhere a category is displayed.

## Committing

When asked to commit, follow global rule (`~/.claude/rules/common/git-workflow.md`): conventional commit format, no AI-attribution footer.
