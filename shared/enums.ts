import { z } from 'zod';

export const PartyRole = z.enum(['customer', 'supplier', 'both']);

export const ItemCategory = z.enum(['gold', 'silver', 'stone', 'artificial']);
export const ItemUnit = z.enum(['gms', 'carat', 'pcs']);
export const ChargeMode = z.enum(['pct', 'per_gram', 'per_pcs']);

export const ApprovalStatus = z.enum(['open', 'sold', 'returned', 'cancelled']);
export const RepairStatus = z.enum(['received', 'in_progress', 'ready', 'delivered', 'cancelled']);
export const OrderStatus = z.enum(['open', 'in_progress', 'ready', 'delivered', 'cancelled']);
