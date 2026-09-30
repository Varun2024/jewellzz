import type { IpcMain } from 'electron';
import { z } from 'zod';
import { getDb } from '../db';
import { sendRefiningLot, receiveRefiningLot, cancelRefiningLot } from '../refining';
import { CH, RefiningSend, RefiningReceive } from '../../shared/ipc';
import { on, audit } from './_shared';

export function register(ipc: IpcMain): void {
  on(ipc, CH.refiningSend, RefiningSend, (p) => {
    const r = sendRefiningLot(getDb(), p);
    audit('refining', r.id, 'send', null, r);
    return r;
  });
  on(ipc, CH.refiningReceive, RefiningReceive, (p) => {
    const r = receiveRefiningLot(getDb(), p);
    audit('refining', p.id, 'receive', null, r);
    return r;
  });
  on(ipc, CH.refiningCancel, z.object({ id: z.number().int() }), ({ id }) => {
    const r = cancelRefiningLot(getDb(), id);
    audit('refining', id, 'cancel', null, r);
    return r;
  });
  on(ipc, CH.refiningList, z.object({ status: z.string().optional() }).default({}), ({ status }) => {
    const db = getDb();
    const where = status ? 'WHERE r.status = ?' : '';
    const args = status ? [status] : [];
    return db.prepare(
      `SELECT r.id, r.slip_no as slipNo, r.ts, r.refiner_party_id as refinerPartyId, p.name as refinerName,
              r.sent_category as sentCategory, r.sent_stamp as sentStamp, r.sent_weight_mg as sentWeightMg,
              r.received_category as receivedCategory, r.received_stamp as receivedStamp,
              r.received_weight_mg as receivedWeightMg, r.loss_mg as lossMg,
              r.charges_paise as chargesPaise, r.paid_cash_paise as paidCashPaise,
              r.charges_balance_paise as chargesBalancePaise,
              r.status, r.received_at as receivedAt, r.notes
       FROM refining_lots r JOIN parties p ON p.id = r.refiner_party_id
       ${where}
       ORDER BY r.ts DESC LIMIT 200`,
    ).all(...args);
  });
}
