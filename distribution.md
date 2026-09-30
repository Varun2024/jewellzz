# Distribution

> Purpose: how to hand Jewelzz to a real jewellery shop, cheapest first.

## Build (packaged installer)

`electron-builder` is already a devDep. Add a `build` block to `package.json`, run `pnpm package`, ship the `.exe`.

```json
"build": {
  "appId": "com.jewelzz.app",
  "productName": "Jewelzz",
  "artifactName": "${productName}-Setup-${version}.exe",
  "directories": { "output": "release" },
  "files": [
    "dist/**/*",
    "dist-electron/**/*",
    "db/migrations/**/*",
    "package.json"
  ],
  "extraResources": [{ "from": "build/icons", "to": "icons" }],
  "win": {
    "target": "nsis",
    "icon": "build/icons/jewelzz.ico"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "shortcutName": "Jewelzz"
  }
}
```

**Two prerequisites** before this works:

1. `build/icons/jewelzz.ico` — export the J-scale SVG at 256×256 and convert to `.ico`.
2. Patch `db/migrator.ts` to also look under `process.resourcesPath` — `process.cwd()` is fine in dev but the migrations live inside the ASAR in the packaged app.

## Code signing

**Skip for first client.** Windows shows a *"Windows protected your PC"* SmartScreen; teach them to click **More info → Run anyway** exactly once.

| Option | Cost | When to bother |
|---|---|---|
| Unsigned | ₹0 | 1–4 shops, small support surface |
| OV cert | ~₹6k/year | SmartScreen support is a real burden |
| EV cert | ~₹25k/year + HSM | Zero warnings needed from day one |

## Delivery

- USB stick or Google Drive → shop runs the `.exe` → NSIS installs to `C:\Program Files\Jewelzz\` with a desktop shortcut.
- App data lives in `%APPDATA%\Jewelzz\` — **survives uninstall, survives updates.** SQLite DB, backups, invoices, photos, and CSV exports all sit there.

## Client first-run checklist (before opening the till)

1. Sign in as **Owner** / PIN `1234` → **Settings → Users** → change PIN.
2. **Settings → Company** → real name, GSTIN, state code, address, phone (appears on every invoice).
3. **Settings → Rates** → today's Au22k, Ag925, etc.
4. **Parties** → add regular customers + suppliers.
5. **Items** → add real SKUs (or a CSV import — not built yet).
6. **Backup** → click "Backup now" once; verify a `.db` file appears in `%APPDATA%\Jewelzz\backups\`.
7. **Dev → Run smoke test** → all-green sanity check on their machine.

## Updates

- **Manual for now**: send a new `.exe`, they run it, NSIS upgrades in place, data stays.
- **When it hurts**: wire `electron-updater` + host on GitHub Releases (free). Needs a code signature for silent updates to be smooth.

## Explicitly skipped

| Skipped | Add when |
|---|---|
| Code signing | 5+ shops OR SmartScreen becomes a support burden |
| Auto-update | Pushing changes more than monthly |
| Multi-machine sync | Never — per PRD, LAN/cloud is out of scope |
| Onboarding wizard | Client reports the checklist above is painful |
| CSV item importer | Client has an existing list they refuse to retype |
| Crash-report telemetry | You get a real support ticket you can't reproduce |

## Ready-to-ship punch list

Two 30-minute tasks to make this concretely ready:

- [ ] `build` block in `package.json` + `.ico` generated from the J-scale mark
- [ ] `db/migrator.ts` — resolve `db/migrations` under `process.resourcesPath` when packaged

Then `pnpm package` produces `release/Jewelzz-Setup-0.0.1.exe`.
