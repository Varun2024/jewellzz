import type { IpcMain } from 'electron';
import { CH } from '../../shared/ipc';
import { runBackupNow } from '../backup';
import { on } from './_shared';

export function register(ipc: IpcMain): void {
  on(ipc, CH.ping, null, () => ({ ok: true, ts: Date.now() }));
  on(ipc, CH.backupNow, null, () => runBackupNow());
}
