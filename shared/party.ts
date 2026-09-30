import { z } from 'zod';
import { PartyRole } from './enums';

export const PartyInput = z.object({
  name: z.string().min(1).max(120),
  role: PartyRole,
  gstin: z.string().max(15).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(500).default(''),
  stateCode: z.string().max(4).default(''),
  openingCash: z.number().int().default(0),      // paise
  openingMetalMg: z.number().int().default(0),   // milligrams
});
export type PartyInput = z.infer<typeof PartyInput>;

export const Party = PartyInput.extend({
  id: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type Party = z.infer<typeof Party>;
