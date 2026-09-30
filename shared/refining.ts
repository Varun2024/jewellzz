import { z } from 'zod';

export const RefiningSend = z.object({
  refinerPartyId: z.number().int(),
  sentCategory: z.enum(['gold', 'silver']),
  sentStamp: z.string().default(''),
  sentWeightMg: z.number().int().positive(),
  notes: z.string().default(''),
});
export type RefiningSend = z.infer<typeof RefiningSend>;

export const RefiningReceive = z.object({
  id: z.number().int(),
  receivedCategory: z.enum(['gold', 'silver']),
  receivedStamp: z.string().default(''),
  receivedWeightMg: z.number().int().min(0),
  chargesPaise: z.number().int().min(0).default(0),
  paidCashPaise: z.number().int().min(0).default(0),
});
export type RefiningReceive = z.infer<typeof RefiningReceive>;
