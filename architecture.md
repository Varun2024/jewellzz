# Architecture

> Purpose: system shape, data flow, trust boundaries, what is deliberately not here.

## Shape

```
┌─────────────────────────────────────────────┐
│  Electron main process                      │
│  ├── better-sqlite3 (WAL, sync)             │
│  ├── backup scheduler (node-cron)           │
│  ├── print bridge (thermal + PDF)           │
│  └── IPC handlers (typed via zod)           │
└──────────────┬──────────────────────────────┘
               │ contextBridge (typed IPC)
┌──────────────┴──────────────────────────────┐
│  Renderer (React + Vite)                    │
│  ├── features/ (sale, purchase, stock, …)   │
│  ├── zustand for local UI state             │
│  └── tanstack-query for main-process reads  │
└─────────────────────────────────────────────┘
```

## Data flow — sale (hot path)

Renderer collects sale → IPC `sale.post(dto)` → main validates (zod) → **single SQLite transaction**:
1. Insert `sales` + `sale_items`
2. Decrement `items.stock_qty` / `stock_weight`
3. Append `cash_ledger` (payment portion)
4. Append `metal_ledger` (sold metal + old-gold received)
5. Append `party_ledger` (if credit / partial)
6. Append `audit_log`

Return `sale_id + bill_number` → renderer triggers print → PDF or ESC/POS emit.

Target: <200ms end-to-end including print dispatch.

## Ledger discipline

Ledger tables are append-only. No UPDATE, no DELETE. Reversals via contra entries with `reverses_id` FK. Running balance = `SUM(debit) - SUM(credit)` computed via indexed view or materialised on read.

## Trust boundaries

- IPC boundary: every payload validated by zod on the main side. Renderer is untrusted for DB writes.
- File system: backup writes only to user-configured folder. No arbitrary path writes.
- Print: ESC/POS byte streams built server-side. Renderer supplies data, never raw bytes.

## Failure modes

| Failure | Handling |
|---|---|
| SQLite locked | WAL mode + single-writer main process → won't happen |
| Print job fails | Sale is already committed. Show "reprint" button, don't roll back sale |
| Backup folder gone | Log + toast, next scheduled run retries |
| Corrupt DB | Restore drill from last good backup (documented in phases.md) |
| Power loss mid-sale | WAL journal replays; transaction is atomic — either full sale or nothing |

## Deliberately not here (v1)

- No LAN/multi-user. Single writer, single PC.
- No cloud sync. Backup is USB/folder only.
- No direct GST portal API. JSON/Excel export.
- No ORM in the sale hot path — raw prepared SQL, measured.
- No auth/roles. Single-user session.
