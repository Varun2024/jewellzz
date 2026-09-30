import { z } from 'zod';

export const MetalRate = z.object({
  id: z.number().int(),
  category: z.enum(['gold', 'silver']),
  stamp: z.string(),
  ratePaisePerG: z.number().int().positive(),
  updatedAt: z.number().int(),
  updatedBy: z.string(),
});
export type MetalRate = z.infer<typeof MetalRate>;

export const MetalRateInput = z.object({
  category: z.enum(['gold', 'silver']),
  stamp: z.string().min(1).max(20),
  ratePaisePerG: z.number().int().positive(),
});
export type MetalRateInput = z.infer<typeof MetalRateInput>;
