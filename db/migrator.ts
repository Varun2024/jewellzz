import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// ponytail: sql files + version table. Simple enough that a schema-DSL never earned its keep.

function migrationsDir(): string {
  // At runtime this file may live in dist-electron/db/. Fall back to source dir in dev.
  const candidates = [
    path.join(__dirname, 'migrations'),
    path.join(__dirname, '..', '..', 'db', 'migrations'),
    path.join(process.cwd(), 'db', 'migrations'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('migrations dir not found');
}

export function runMigrations(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`);

  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all().map((r: any) => r.name),
  );

  const files = fs
    .readdirSync(migrationsDir())
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const insert = db.prepare('INSERT INTO _migrations (name) VALUES (?)');
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir(), f), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      insert.run(f);
    })();
    console.log(`[migrate] applied ${f}`);
  }
}

export function seedIfEmpty(db: Database.Database): void {
  const row = db.prepare('SELECT COUNT(*) AS n FROM companies').get() as { n: number };
  if (row.n > 0) return;

  db.transaction(() => {
    db.prepare(
      `INSERT INTO companies (name, gstin, state_code) VALUES (?, ?, ?)`,
    ).run('Jewelzz Demo Jewellers', '00AAAAA0000A1Z0', '00');

    const settings: Array<[string, string]> = [
      ['bill_prefix', 'INV-'],
      ['bill_next_no', '1'],
      ['fy_start', '2026-04-01'],
    ];
    const setStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of settings) setStmt.run(k, v);

    const party = db.prepare(
      `INSERT OR IGNORE INTO parties (name, role, state_code) VALUES (?, ?, ?)`,
    );
    party.run('Walk-in Customer', 'customer', '00');
    party.run('Bullion Supplier', 'supplier', '00');

    const item = db.prepare(
      `INSERT OR IGNORE INTO items (sku, name, category, unit, stamp, hsn, gst_bp, labour_mode, labour_value, wastage_mode, wastage_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    item.run('G22-CHAIN', '22k Chain', 'gold', 'gms', '22k', '7113', 300, 'pct', 1200, 'pct', 200);
    item.run('S925-RING', 'Silver Ring 925', 'silver', 'gms', '925', '7113', 300, 'per_gram', 5000, 'per_gram', 500);
    item.run('DIA-01',     'Solitaire 0.5ct', 'stone', 'carat', null, '7102', 300, 'per_pcs', 500000, 'per_pcs', 0);
    item.run('ART-BAN-01', 'Fashion Bangle',  'artificial', 'pcs', null, '7117', 300, 'per_pcs', 20000, 'per_pcs', 0);
  })();

  console.log('[seed] initial data inserted');
}
