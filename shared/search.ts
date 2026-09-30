import { z } from 'zod';
import { ItemCategory, PartyRole } from './enums';

export const SearchInput = z.object({
  q: z.string().min(1).max(120),
  scope: z.enum(['all', 'items', 'parties']).default('all'),
  limit: z.number().int().min(1).max(50).default(20),
});
export type SearchInput = z.infer<typeof SearchInput>;

export const SearchHit = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('item'),  id: z.number().int(), name: z.string(), sku: z.string(), category: ItemCategory, stamp: z.string().nullable() }),
  z.object({ kind: z.literal('party'), id: z.number().int(), name: z.string(), role: PartyRole, phone: z.string().nullable() }),
]);
export type SearchHit = z.infer<typeof SearchHit>;
