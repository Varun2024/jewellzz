import { z } from 'zod';
import { ItemCategory, ItemUnit } from './enums';

export const PurchaseLineInput = z.object({
  itemId: z.number().int(),
  description: z.string().min(1).max(200),
  category: ItemCategory,
  unit: ItemUnit,
  stamp: z.string().nullable(),
  hsn: z.string().default(''),
  qty: z.number().int().default(0),
  weightMg: z.number().int().min(0).default(0),
  ratePaise: z.number().int().min(0).default(0),
  gstBp: z.number().int().min(0).max(10000).default(300),
});
export type PurchaseLineInput = z.infer<typeof PurchaseLineInput>;

export const PurchaseInput = z.object({
  partyId: z.number().int(),
  refNo: z.string().min(1).max(40),
  ts: z.number().int().optional(),
  notes: z.string().default(''),
  lines: z.array(PurchaseLineInput).min(1),
  paidCashPaise: z.number().int().min(0).default(0),
  paidBankPaise: z.number().int().min(0).default(0),
});
export type PurchaseInput = z.infer<typeof PurchaseInput>;
