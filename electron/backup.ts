import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import cron from 'node-cron';
import { getDb, dbPath } from './db';

let task: cron.ScheduledTask | null = null;

function backupDir(): string {
  const dir = path.join(app.getPath('userData'), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export async function runBackupNow(): Promise<{ path: string; bytes: number }> {
  const target = path.join(backupDir(), `jewelzz-${timestamp()}.db`);
  await getDb().backup(target);
  pruneOld();
  return { path: target, bytes: fs.statSync(target).size };
}

// ponytail: naive retention — keep last 14 files. Weekly-tier not needed until DB actually grows.
function pruneOld(): void {
  const files = fs
    .readdirSync(backupDir())
    .filter((f) => f.startsWith('jewelzz-') && f.endsWith('.db'))
    .map((f) => ({ f, m: fs.statSync(path.join(backupDir(), f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  for (const { f } of files.slice(14)) {
    try {
      fs.unlinkSync(path.join(backupDir(), f));
    } catch {
      /* ignore */
    }
  }
}

export function startBackupScheduler(): void {
  // Daily at 02:00 local
  task = cron.schedule('0 2 * * *', () => {
    runBackupNow().catch((e) => console.error('[backup] failed:', e));
  });
}

export function stopBackupScheduler(): void {
  task?.stop();
  task = null;
  // Best-effort backup on shutdown
  try {
    const target = path.join(backupDir(), `jewelzz-${timestamp()}-shutdown.db`);
    fs.copyFileSync(dbPath(), target);
  } catch (e) {
    console.error('[backup] shutdown copy failed:', e);
  }
}
