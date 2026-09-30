import type { IpcMain } from 'electron';
import { CH } from '../../shared/ipc';
import { on } from './_shared';

export function register(ipc: IpcMain): void {
  on(ipc, CH.devSmoke, null, async () => {
    const { runSmokeTest } = await import('../smoke');
    return runSmokeTest();
  });
}
