import fs from 'node:fs';
import path from 'node:path';
import { cliDbPath } from './_db';

const src = process.argv[2];
if (!src) {
  console.error('usage: pnpm restore <path-to-backup.db>');
  process.exit(1);
}
if (!fs.existsSync(src)) {
  console.error(`[restore] source not found: ${src}`);
  process.exit(1);
}

const dst = cliDbPath();
const bak = `${dst}.pre-restore-${Date.now()}`;
if (fs.existsSync(dst)) fs.copyFileSync(dst, bak);
fs.copyFileSync(src, dst);
console.log(`[restore] ${src} -> ${dst}`);
console.log(`[restore] previous db saved as ${bak}`);
