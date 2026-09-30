import { z } from 'zod';
import { ItemCategory } from './enums';

export const LedgerRange = z.object({
  fromTs: z.number().int().optional(),
  toTs: z.number().int().optional(),
  partyId: z.number().int().optional(),
  category: ItemCategory.optional(),
  stamp: z.string().optional(),
});
export type LedgerRange = z.infer<typeof LedgerRange>;
