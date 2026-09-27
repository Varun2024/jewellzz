import fs from 'node:fs';
import path from 'node:path';
import { openCliDb, cliDbPath } from './_db';

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const backupDir = path.join(path.dirname(cliDbPath()), 'backups');
fs.mkdirSync(backupDir, { recursive: true });

async function main() {
  const target = path.join(backupDir, `jewelzz-${timestamp()}.db`);
  const db = openCliDb();
  await db.backup(target);
  db.close();
  const bytes = fs.statSync(target).size;
  console.log(`[backup] wrote ${target} (${(bytes / 1024).toFixed(1)} KiB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
