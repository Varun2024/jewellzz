// Ensure better-sqlite3 has an Electron-ABI prebuild after any pnpm install.
// Runs during postinstall. Idempotent: skips if the .node file already exists.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let bsPkg;
try {
  bsPkg = require.resolve('better-sqlite3/package.json');
} catch {
  console.log('[ensure-native] better-sqlite3 not installed, skipping');
  process.exit(0);
}

const bsDir = path.dirname(bsPkg);
const binary = path.join(bsDir, 'build', 'Release', 'better_sqlite3.node');

if (fs.existsSync(binary)) {
  console.log('[ensure-native] better-sqlite3 binary present, skipping');
  process.exit(0);
}

// Read electron version from our own package.json
const rootPkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const electronRange = rootPkg.devDependencies?.electron ?? '';
const electronVer = electronRange.replace(/^[^\d]*/, '') || '33.4.11';

const bin = path.join(bsDir, 'node_modules', '.bin', process.platform === 'win32' ? 'prebuild-install.cmd' : 'prebuild-install');
if (!fs.existsSync(bin)) {
  console.log('[ensure-native] prebuild-install not found at', bin);
  process.exit(0);
}

console.log(`[ensure-native] fetching better-sqlite3 prebuild for electron ${electronVer}`);
const r = spawnSync(bin, ['--runtime=electron', `--target=${electronVer}`, '--arch=x64'], {
  cwd: bsDir,
  stdio: 'inherit',
  shell: false,
});

if (r.status !== 0) {
  console.error('[ensure-native] prebuild-install failed with', r.status);
  process.exit(0); // don't block install; user can debug
}
console.log('[ensure-native] done');
