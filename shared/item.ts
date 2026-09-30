import { z } from 'zod';
import { ItemCategory, ItemUnit, ChargeMode } from './enums';

export const ItemInput = z
  .object({
    sku: z.string().min(1).max(40),
    name: z.string().min(1).max(120),
    category: ItemCategory,
    unit: ItemUnit,
    stamp: z.string().max(20).optional().nullable(),
    hsn: z.string().max(10).default(''),
    gstBp: z.number().int().min(0).max(10000).default(300),
    labourMode: ChargeMode,
    labourValue: z.number().int().min(0).default(0),
    wastageMode: ChargeMode,
    wastageValue: z.number().int().min(0).default(0),
    stockQty: z.number().int().default(0),
    stockWtMg: z.number().int().default(0),
  })
  .refine(
    (v) =>
      (['gold', 'silver'].includes(v.category) && !!v.stamp && v.stamp.length > 0) ||
      (['stone', 'artificial'].includes(v.category) && (!v.stamp || v.stamp.length === 0)),
    { message: 'stamp required for gold/silver, must be empty for stone/artificial', path: ['stamp'] },
  );
export type ItemInput = z.infer<typeof ItemInput>;

export const Item = z.object({
  id: z.number().int(),
  sku: z.string(),
  name: z.string(),
  category: ItemCategory,
  unit: ItemUnit,
  stamp: z.string().nullable(),
  hsn: z.string(),
  gstBp: z.number().int(),
  labourMode: ChargeMode,
  labourValue: z.number().int(),
  wastageMode: ChargeMode,
  wastageValue: z.number().int(),
  stockQty: z.number().int(),
  stockWtMg: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type Item = z.infer<typeof Item>;

export const StockAdjustInput = z.object({
  itemId: z.number().int(),
  deltaQty: z.number().int().default(0),
  deltaWtMg: z.number().int().default(0),
  reason: z.string().min(1).max(200),
});
export type StockAdjustInput = z.infer<typeof StockAdjustInput>;
