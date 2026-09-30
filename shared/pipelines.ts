import { z } from 'zod';
import { ItemCategory, RepairStatus, OrderStatus } from './enums';

// ── Approval
export const ApprovalLine = z.object({
  itemId: z.number().int(),
  category: ItemCategory,
  stamp: z.string().nullable(),
  qty: z.number().int().min(0).default(0),
  weightMg: z.number().int().min(0).default(0),
  note: z.string().default(''),
});
export type ApprovalLine = z.infer<typeof ApprovalLine>;

export const ApprovalInput = z.object({
  partyId: z.number().int(),
  promisedReturnDate: z.string().default(''),
  notes: z.string().default(''),
  lines: z.array(ApprovalLine).min(1),
});
export type ApprovalInput = z.infer<typeof ApprovalInput>;

export const ApprovalResolve = z.object({
  id: z.number().int(),
  status: z.enum(['sold', 'returned', 'cancelled']),
  resolvedSaleId: z.number().int().optional().nullable(),
});
export type ApprovalResolve = z.infer<typeof ApprovalResolve>;

// ── Repair
export const RepairInput = z.object({
  partyId: z.number().int(),
  description: z.string().min(1).max(500),
  customerMaterialCategory: z.enum(['gold', 'silver', 'stone', 'artificial']).optional().nullable(),
  customerMaterialStamp: z.string().optional().nullable(),
  customerMaterialWeightMg: z.number().int().min(0).default(0),
  karigarId: z.number().int().optional().nullable(),
  additionPaise: z.number().int().min(0).default(0),
  labourPaise: z.number().int().min(0).default(0),
  promisedDate: z.string().default(''),
  notes: z.string().default(''),
});
export type RepairInput = z.infer<typeof RepairInput>;

export const RepairDeliver = z.object({
  id: z.number().int(),
  paidCashPaise: z.number().int().min(0).default(0),
  paidBankPaise: z.number().int().min(0).default(0),
});
export type RepairDeliver = z.infer<typeof RepairDeliver>;

export const RepairStatusUpdate = z.object({
  id: z.number().int(),
  status: RepairStatus,
});
export type RepairStatusUpdate = z.infer<typeof RepairStatusUpdate>;

// ── Order
export const OrderInput = z.object({
  partyId: z.number().int(),
  spec: z.string().min(1).max(500),
  estimatedPaise: z.number().int().min(0).default(0),
  karigarId: z.number().int().optional().nullable(),
  promisedDate: z.string().default(''),
  notes: z.string().default(''),
});
export type OrderInput = z.infer<typeof OrderInput>;

export const OrderAdvance = z.object({
  id: z.number().int(),
  amountPaise: z.number().int().positive(),
});
export type OrderAdvance = z.infer<typeof OrderAdvance>;

export const OrderStatusUpdate = z.object({
  id: z.number().int(),
  status: OrderStatus,
});
export type OrderStatusUpdate = z.infer<typeof OrderStatusUpdate>;
