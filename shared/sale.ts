import { z } from 'zod';
import { ItemCategory, ItemUnit, ChargeMode } from './enums';

export const SaleLineInput = z.object({
  itemId: z.number().int(),
  description: z.string().min(1).max(200),
  category: ItemCategory,
  unit: ItemUnit,
  stamp: z.string().nullable(),
  hsn: z.string().default(''),
  qty: z.number().int().default(0),
  weightMg: z.number().int().min(0).default(0),   // canonical mg
  ratePaise: z.number().int().min(0).default(0),  // per gram / per carat / per pcs
  makingMode: ChargeMode,
  makingValue: z.number().int().min(0).default(0),
  wastageMode: ChargeMode,
  wastageValue: z.number().int().min(0).default(0),
  gstBp: z.number().int().min(0).max(10000).default(300),
});
export type SaleLineInput = z.infer<typeof SaleLineInput>;

export const SalePaymentInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('cash'), amountPaise: z.number().int().min(0) }),
  z.object({ kind: z.literal('bank'), amountPaise: z.number().int().min(0), note: z.string().default('') }),
  z.object({
    kind: z.literal('old_gold'),
    metalCategory: z.enum(['gold', 'silver']),
    metalStamp: z.string().min(1),
    metalWeightMg: z.number().int().min(0),
    metalRatePaise: z.number().int().min(0), // per gram
  }),
]);
export type SalePaymentInput = z.infer<typeof SalePaymentInput>;

export const SaleInput = z.object({
  partyId: z.number().int(),
  ts: z.number().int().optional(),
  discountPaise: z.number().int().min(0).default(0),
  roundOffPaise: z.number().int().default(0),
  notes: z.string().default(''),
  lines: z.array(SaleLineInput).min(1),
  payments: z.array(SalePaymentInput).default([]),
});
export type SaleInput = z.infer<typeof SaleInput>;

export const SalePosted = z.object({
  id: z.number().int(),
  billNo: z.string(),
  totalPaise: z.number().int(),
  balancePaise: z.number().int(),
});
export type SalePosted = z.infer<typeof SalePosted>;
