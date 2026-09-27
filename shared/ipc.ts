import { z } from 'zod';

// ────────────────────────────────────────────────────────────
// Party
// ────────────────────────────────────────────────────────────
export const PartyRole = z.enum(['customer', 'supplier', 'both']);

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

// ────────────────────────────────────────────────────────────
// Item
// ────────────────────────────────────────────────────────────
export const ItemCategory = z.enum(['gold', 'silver', 'stone', 'artificial']);
export const ItemUnit = z.enum(['gms', 'carat', 'pcs']);
export const ChargeMode = z.enum(['pct', 'per_gram', 'per_pcs']);

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

// ────────────────────────────────────────────────────────────
// Stock adjustment
// ────────────────────────────────────────────────────────────
export const StockAdjustInput = z.object({
  itemId: z.number().int(),
  deltaQty: z.number().int().default(0),
  deltaWtMg: z.number().int().default(0),
  reason: z.string().min(1).max(200),
});
export type StockAdjustInput = z.infer<typeof StockAdjustInput>;

// ────────────────────────────────────────────────────────────
// Search
// ────────────────────────────────────────────────────────────
export const SearchInput = z.object({
  q: z.string().min(1).max(120),
  scope: z.enum(['all', 'items', 'parties']).default('all'),
  limit: z.number().int().min(1).max(50).default(20),
});
export type SearchInput = z.infer<typeof SearchInput>;

export const SearchHit = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('item'), id: z.number().int(), name: z.string(), sku: z.string(), category: ItemCategory, stamp: z.string().nullable() }),
  z.object({ kind: z.literal('party'), id: z.number().int(), name: z.string(), role: PartyRole, phone: z.string().nullable() }),
]);
export type SearchHit = z.infer<typeof SearchHit>;

// ────────────────────────────────────────────────────────────
// Sale
// ────────────────────────────────────────────────────────────
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

// ────────────────────────────────────────────────────────────
// Purchase
// ────────────────────────────────────────────────────────────
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

// ────────────────────────────────────────────────────────────
// Karigar
// ────────────────────────────────────────────────────────────
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

// ────────────────────────────────────────────────────────────
// Ledger reads
// ────────────────────────────────────────────────────────────
export const LedgerRange = z.object({
  fromTs: z.number().int().optional(),
  toTs: z.number().int().optional(),
  partyId: z.number().int().optional(),
  category: ItemCategory.optional(),
  stamp: z.string().optional(),
});
export type LedgerRange = z.infer<typeof LedgerRange>;

// ────────────────────────────────────────────────────────────
// Channel names — single source of truth
// ────────────────────────────────────────────────────────────
export const CH = {
  ping: 'app.ping',
  backupNow: 'backup.now',
  partiesList: 'parties.list',
  partiesCreate: 'parties.create',
  partiesUpdate: 'parties.update',
  partiesDelete: 'parties.delete',
  itemsList: 'items.list',
  itemsCreate: 'items.create',
  itemsUpdate: 'items.update',
  itemsDelete: 'items.delete',
  stockAdjust: 'stock.adjust',
  stockAdjustments: 'stock.adjustments',
  search: 'search',
  // phase 2
  salePost: 'sale.post',
  saleGet: 'sale.get',
  salesList: 'sales.list',
  salePrint: 'sale.print',
  purchasePost: 'purchase.post',
  purchasesList: 'purchases.list',
  ledgerCash: 'ledger.cash',
  ledgerMetal: 'ledger.metal',
  ledgerParty: 'ledger.party',
  metalBuckets: 'ledger.metal.buckets',
  exportSalesCsv: 'export.sales.csv',
  exportPurchasesCsv: 'export.purchases.csv',
  companyGet: 'company.get',
  companyUpdate: 'company.update',
  devSmoke: 'dev.smoke',
  // phase 3 — karigar
  karigarsList: 'karigars.list',
  karigarsCreate: 'karigars.create',
  karigarsUpdate: 'karigars.update',
  karigarsDelete: 'karigars.delete',
  karigarIssuePost: 'karigar.issue.post',
  karigarReceiptPost: 'karigar.receipt.post',
  karigarPay: 'karigar.pay',
  karigarIssuesList: 'karigar.issues.list',
  karigarReceiptsList: 'karigar.receipts.list',
  karigarLedger: 'karigar.ledger',
  karigarBalances: 'karigar.balances',
  // phase 3 — GST reports
  gstGstr1View: 'gst.gstr1.view',
  gstGstr1Csv: 'gst.gstr1.csv',
  gstGstr3bView: 'gst.gstr3b.view',
  gstGstr3bCsv: 'gst.gstr3b.csv',
  gstHsnView: 'gst.hsn.view',
  gstHsnCsv: 'gst.hsn.csv',
} as const;
