import { z } from 'zod';
import { ItemCategory, ChargeMode } from './enums';

export const KarigarInput = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(500).default(''),
  defaultLabourMode: ChargeMode.default('per_gram'),
  defaultLabourValue: z.number().int().min(0).default(0),
  notes: z.string().default(''),
});
export type KarigarInput = z.infer<typeof KarigarInput>;

export const Karigar = z.object({
  id: z.number().int(),
  name: z.string(),
  phone: z.string().nullable(),
  address: z.string(),
  defaultLabourMode: ChargeMode,
  defaultLabourValue: z.number().int(),
  notes: z.string(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type Karigar = z.infer<typeof Karigar>;

export const KarigarIssueLine = z.object({
  category: ItemCategory,
  stamp: z.string().default(''),
  weightMg: z.number().int().positive(),
  note: z.string().default(''),
});
export type KarigarIssueLine = z.infer<typeof KarigarIssueLine>;

export const KarigarIssueInput = z.object({
  karigarId: z.number().int(),
  ts: z.number().int().optional(),
  purpose: z.string().default(''),
  notes: z.string().default(''),
  lines: z.array(KarigarIssueLine).min(1),
});
export type KarigarIssueInput = z.infer<typeof KarigarIssueInput>;

export const KarigarReceiptLine = z.object({
  itemId: z.number().int().optional().nullable(),
  category: ItemCategory,
  stamp: z.string().default(''),
  qty: z.number().int().min(0).default(0),
  weightMg: z.number().int().min(0).default(0),
  wastageMg: z.number().int().min(0).default(0),
  note: z.string().default(''),
});
export type KarigarReceiptLine = z.infer<typeof KarigarReceiptLine>;

export const KarigarReceiptInput = z.object({
  karigarId: z.number().int(),
  relatedIssueId: z.number().int().optional().nullable(),
  ts: z.number().int().optional(),
  labourPaise: z.number().int().min(0).default(0),
  notes: z.string().default(''),
  lines: z.array(KarigarReceiptLine).min(1),
});
export type KarigarReceiptInput = z.infer<typeof KarigarReceiptInput>;

export const KarigarPayInput = z.object({
  karigarId: z.number().int(),
  amountPaise: z.number().int().positive(),
  note: z.string().default(''),
});
export type KarigarPayInput = z.infer<typeof KarigarPayInput>;
