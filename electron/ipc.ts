import type { IpcMain } from 'electron';
import * as auth from './ipc/auth';
import * as health from './ipc/health';
import * as parties from './ipc/parties';
import * as items from './ipc/items';
import * as search from './ipc/search';
import * as company from './ipc/company';
import * as sale from './ipc/sale';
import * as purchase from './ipc/purchase';
import * as ledgers from './ipc/ledgers';
import * as karigar from './ipc/karigar';
import * as rates from './ipc/rates';
import * as pipelines from './ipc/pipelines';
import * as refining from './ipc/refining';
import * as catalog from './ipc/catalog';
import * as reports from './ipc/reports';
import * as dev from './ipc/dev';

export function registerIpc(ipc: IpcMain): void {
  auth.register(ipc);      // must come first — everything else is role-gated
  health.register(ipc);
  parties.register(ipc);
  items.register(ipc);
  search.register(ipc);
  company.register(ipc);
  sale.register(ipc);
  purchase.register(ipc);
  ledgers.register(ipc);
  karigar.register(ipc);
  rates.register(ipc);
  pipelines.register(ipc);
  refining.register(ipc);
  catalog.register(ipc);
  reports.register(ipc);
  dev.register(ipc);
}
