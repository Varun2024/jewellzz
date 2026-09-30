import type Database from 'better-sqlite3';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// ponytail: PIN hashing via node:crypto scryptSync. No bcrypt dep needed.
// Cost params below are fine for a 4-8 digit PIN on a shop counter PC.

const SCRYPT_N = 16384; // 2^14, ~50ms on a modern CPU
const KEYLEN = 32;

export type CurrentUser = { id: number; name: string; role: 'owner' | 'counter' };

// Held in main-process memory; the renderer asks via whoami on boot / after login.
let current: CurrentUser | null = null;

export function whoami(): CurrentUser | null { return current; }

function hashPin(pin: string, saltHex: string): string {
  const salt = Buffer.from(saltHex, 'hex');
  return scryptSync(pin, salt, KEYLEN, { N: SCRYPT_N }).toString('hex');
}

function newSalt(): string { return randomBytes(16).toString('hex'); }

export function ensureOwner(db: Database.Database): void {
  const row = db.prepare(`SELECT id FROM users WHERE role='owner' LIMIT 1`).get();
  if (row) return;
  const salt = newSalt();
  const hash = hashPin('1234', salt);
  db.prepare(
    `INSERT INTO users (name, role, pin_hash, pin_salt) VALUES ('Owner', 'owner', ?, ?)`,
  ).run(hash, salt);
}

export function listActiveUsers(db: Database.Database): Array<{ id: number; name: string; role: string }> {
  return db.prepare(`SELECT id, name, role FROM users WHERE active=1 ORDER BY role='owner' DESC, name`).all() as any[];
}

export function listAllUsers(db: Database.Database): Array<{ id: number; name: string; role: string; active: number; createdAt: number }> {
  return db.prepare(
    `SELECT id, name, role, active, created_at as createdAt FROM users ORDER BY role='owner' DESC, name`,
  ).all() as any[];
}

export function login(db: Database.Database, userId: number, pin: string): CurrentUser {
  const row = db.prepare(
    `SELECT id, name, role, pin_hash, pin_salt, active FROM users WHERE id = ?`,
  ).get(userId) as any;
  if (!row || !row.active) throw new Error('user not found');
  const attempt = Buffer.from(hashPin(pin, row.pin_salt), 'hex');
  const stored = Buffer.from(row.pin_hash, 'hex');
  if (attempt.length !== stored.length || !timingSafeEqual(attempt, stored)) {
    throw new Error('wrong PIN');
  }
  current = { id: row.id, name: row.name, role: row.role };
  return current;
}

export function logout(): void { current = null; }

export function createUser(
  db: Database.Database,
  input: { name: string; role: 'owner' | 'counter'; pin: string },
): { id: number } {
  if (!/^\d{4,8}$/.test(input.pin)) throw new Error('PIN must be 4–8 digits');
  const salt = newSalt();
  const hash = hashPin(input.pin, salt);
  const row = db.prepare(
    `INSERT INTO users (name, role, pin_hash, pin_salt) VALUES (?, ?, ?, ?) RETURNING id`,
  ).get(input.name.trim(), input.role, hash, salt) as { id: number };
  return row;
}

export function setUserPin(db: Database.Database, userId: number, newPin: string): void {
  if (!/^\d{4,8}$/.test(newPin)) throw new Error('PIN must be 4–8 digits');
  const salt = newSalt();
  const hash = hashPin(newPin, salt);
  const r = db.prepare(
    `UPDATE users SET pin_hash=?, pin_salt=?, updated_at=unixepoch() WHERE id=?`,
  ).run(hash, salt, userId);
  if (r.changes === 0) throw new Error('user not found');
}

export function deactivateUser(db: Database.Database, userId: number): void {
  const owners = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role='owner' AND active=1`).get() as { n: number };
  const target = db.prepare(`SELECT role FROM users WHERE id=?`).get(userId) as { role: string } | undefined;
  if (!target) throw new Error('user not found');
  if (target.role === 'owner' && owners.n <= 1) throw new Error('cannot deactivate the only owner');
  db.prepare(`UPDATE users SET active=0, updated_at=unixepoch() WHERE id=?`).run(userId);
  if (current?.id === userId) current = null;
}

// Owner-only channel whitelist (see electron/ipc.ts). Everything not listed here is allowed for both roles.
export const OWNER_ONLY_CHANNELS: ReadonlySet<string> = new Set([
  'company.update',
  'rates.upsert',
  'rates.delete',
  'parties.delete',
  'items.delete',
  'karigars.delete',
  'karigar.pay',
  'refining.send',
  'refining.receive',
  'refining.cancel',
  'export.sales.csv',
  'export.purchases.csv',
  'gst.gstr1.csv',
  'gst.gstr3b.csv',
  'gst.hsn.csv',
  'backup.now',
  'users.create',
  'users.setPin',
  'users.deactivate',
  'collections.delete',
  'labels.print',
]);

export function assertRole(channel: string): void {
  if (!current) throw new Error('not logged in');
  if (OWNER_ONLY_CHANNELS.has(channel) && current.role !== 'owner') {
    throw new Error(`role '${current.role}' cannot ${channel} (owner only)`);
  }
}

export function currentActor(): string {
  return current?.name ?? 'system';
}
