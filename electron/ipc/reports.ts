import type { IpcMain } from 'electron';
import { getDb } from '../db';
import { CH, LedgerRange } from '../../shared/ipc';
import { on } from './_shared';

// Dynamic imports keep startup light: CSV/GST modules only load when actually needed.
export function register(ipc: IpcMain): void {
  on(ipc, CH.exportSalesCsv, LedgerRange, async (r) => {
    const { writeCsvSales } = await import('../export');
    return writeCsvSales(getDb(), r);
  });
  on(ipc, CH.exportPurchasesCsv, LedgerRange, async (r) => {
    const { writeCsvPurchases } = await import('../export');
    return writeCsvPurchases(getDb(), r);
  });

  on(ipc, CH.gstGstr1View, LedgerRange, async (r) => {
    const { computeGstr1 } = await import('../gst');
    return computeGstr1(getDb(), r);
  });
  on(ipc, CH.gstGstr1Csv, LedgerRange, async (r) => {
    const { writeGstr1Csv } = await import('../gst');
    return writeGstr1Csv(getDb(), r);
  });
  on(ipc, CH.gstGstr3bView, LedgerRange, async (r) => {
    const { computeGstr3b } = await import('../gst');
    return computeGstr3b(getDb(), r);
  });
  on(ipc, CH.gstGstr3bCsv, LedgerRange, async (r) => {
    const { writeGstr3bCsv } = await import('../gst');
    return writeGstr3bCsv(getDb(), r);
  });
  on(ipc, CH.gstHsnView, LedgerRange, async (r) => {
    const { computeHsnSummary } = await import('../gst');
    return computeHsnSummary(getDb(), r);
  });
  on(ipc, CH.gstHsnCsv, LedgerRange, async (r) => {
    const { writeHsnCsv } = await import('../gst');
    return writeHsnCsv(getDb(), r);
  });
}
