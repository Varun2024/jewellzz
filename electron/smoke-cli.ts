/* Headless smoke runner. Launches Electron with no window, opens the DB
 * (migrations + seed + owner), runs runSmokeTest(), prints JSON to stdout
 * and exits.
 *
 * Usage:
 *   pnpm build:electron && npx electron dist-electron/smoke-cli.js
 */

import { app } from 'electron';
import { openDb, closeDb } from './db';
import { runSmokeTest } from './smoke';

app.whenReady().then(async () => {
  try {
    openDb();
    const report = await runSmokeTest();
    const totalMs = report.steps.reduce((s, x) => s + x.ms, 0);
    // Human-readable summary to stderr; machine JSON to stdout.
    process.stderr.write(
      `smoke: ${report.passed} passed, ${report.failed} failed, ${report.steps.length} total · ${totalMs} ms\n`,
    );
    for (const s of report.steps) {
      process.stderr.write(
        `  ${s.ok ? 'OK ' : 'FAIL'} ${String(s.ms).padStart(4)}ms  ${s.name}${s.detail ? '  — ' + s.detail : ''}\n`,
      );
    }
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    closeDb();
    app.exit(report.failed === 0 ? 0 : 1);
  } catch (e: any) {
    process.stderr.write(`smoke runner crashed: ${e?.stack ?? e}\n`);
    app.exit(2);
  }
});
