import type { IpcMain } from 'electron';
import { z } from 'zod';
import { getDb } from '../db';
import {
  createApproval, resolveApproval,
  createRepair, updateRepairStatus, deliverRepair,
  createOrder, receiveOrderAdvance, updateOrderStatus,
} from '../pipelines';
import {
  CH,
  ApprovalInput, ApprovalResolve,
  RepairInput, RepairDeliver, RepairStatusUpdate,
  OrderInput, OrderAdvance, OrderStatusUpdate,
} from '../../shared/ipc';
import { on, audit } from './_shared';

export function register(ipc: IpcMain): void {
  // ── approval
  on(ipc, CH.approvalCreate, ApprovalInput, (p) => {
    const r = createApproval(getDb(), p);
    audit('approval', r.id, 'create', null, r);
    return r;
  });
  on(ipc, CH.approvalResolve, ApprovalResolve, (p) => {
    const r = resolveApproval(getDb(), p);
    audit('approval', p.id, `resolve:${p.status}`, null, r);
    return r;
  });
  on(ipc, CH.approvalsList, z.object({ status: z.string().optional() }).default({}), ({ status }) => {
    const db = getDb();
    const where = status ? 'WHERE a.status = ?' : '';
    const args = status ? [status] : [];
    return db.prepare(
      `SELECT a.id, a.slip_no as slipNo, a.ts, a.party_id as partyId, p.name as partyName,
              a.promised_return_date as promisedReturnDate, a.status, a.notes,
              a.resolved_at as resolvedAt, a.resolved_sale_id as resolvedSaleId,
              (SELECT COUNT(*) FROM approval_items WHERE approval_id = a.id) as itemCount,
              (SELECT SUM(qty) FROM approval_items WHERE approval_id = a.id) as totalQty,
              (SELECT SUM(weight_mg) FROM approval_items WHERE approval_id = a.id) as totalMg
       FROM approvals a JOIN parties p ON p.id = a.party_id
       ${where}
       ORDER BY a.ts DESC LIMIT 200`,
    ).all(...args);
  });

  // ── repair
  on(ipc, CH.repairCreate, RepairInput, (p) => {
    const r = createRepair(getDb(), p);
    audit('repair', r.id, 'create', null, r);
    return r;
  });
  on(ipc, CH.repairStatus, RepairStatusUpdate, (p) => {
    const r = updateRepairStatus(getDb(), p);
    audit('repair', p.id, `status:${p.status}`, null, r);
    return r;
  });
  on(ipc, CH.repairDeliver, RepairDeliver, (p) => {
    const r = deliverRepair(getDb(), p);
    audit('repair', p.id, 'deliver', null, r);
    return r;
  });
  on(ipc, CH.repairsList, z.object({ status: z.string().optional() }).default({}), ({ status }) => {
    const db = getDb();
    const where = status ? 'WHERE r.status = ?' : '';
    const args = status ? [status] : [];
    return db.prepare(
      `SELECT r.id, r.slip_no as slipNo, r.ts, r.party_id as partyId, p.name as partyName,
              r.description, r.customer_material_category as customerMaterialCategory,
              r.customer_material_stamp as customerMaterialStamp,
              r.customer_material_weight_mg as customerMaterialWeightMg,
              r.karigar_id as karigarId, k.name as karigarName,
              r.addition_paise as additionPaise, r.labour_paise as labourPaise,
              r.total_paise as totalPaise, r.balance_paise as balancePaise,
              r.paid_cash_paise as paidCashPaise, r.paid_bank_paise as paidBankPaise,
              r.promised_date as promisedDate, r.status, r.delivered_at as deliveredAt, r.notes
       FROM repairs r
       JOIN parties p ON p.id = r.party_id
       LEFT JOIN karigars k ON k.id = r.karigar_id
       ${where}
       ORDER BY r.ts DESC LIMIT 200`,
    ).all(...args);
  });

  // ── order
  on(ipc, CH.orderCreate, OrderInput, (p) => {
    const r = createOrder(getDb(), p);
    audit('order', r.id, 'create', null, r);
    return r;
  });
  on(ipc, CH.orderAdvance, OrderAdvance, (p) => {
    const r = receiveOrderAdvance(getDb(), p);
    audit('order', p.id, 'advance', null, r);
    return r;
  });
  on(ipc, CH.orderStatus, OrderStatusUpdate, (p) => {
    const r = updateOrderStatus(getDb(), p);
    audit('order', p.id, `status:${p.status}`, null, r);
    return r;
  });
  on(ipc, CH.ordersList, z.object({ status: z.string().optional() }).default({}), ({ status }) => {
    const db = getDb();
    const where = status ? 'WHERE o.status = ?' : '';
    const args = status ? [status] : [];
    return db.prepare(
      `SELECT o.id, o.slip_no as slipNo, o.ts, o.party_id as partyId, p.name as partyName,
              o.spec, o.estimated_paise as estimatedPaise, o.advance_paise as advancePaise,
              o.karigar_id as karigarId, k.name as karigarName,
              o.promised_date as promisedDate, o.status, o.delivered_at as deliveredAt,
              o.resolved_sale_id as resolvedSaleId, o.notes
       FROM orders o
       JOIN parties p ON p.id = o.party_id
       LEFT JOIN karigars k ON k.id = o.karigar_id
       ${where}
       ORDER BY o.ts DESC LIMIT 200`,
    ).all(...args);
  });
}
