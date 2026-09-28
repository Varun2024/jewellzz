import { useMemo, useState } from 'react';
import type { Item, SaleLineInput, SalePaymentInput } from '@shared/ipc';
import { caratToMg, gramsToMg, rupeesToPaise } from '@/lib/format';

type ChargeModeT = 'pct' | 'per_gram' | 'per_pcs';

// UI-side line — free-typed values in display units, converted at post time.
export type DraftLine = {
  key: string;
  itemId: number;
  description: string;
  category: Item['category'];
  unit: Item['unit'];
  stamp: string | null;
  hsn: string;
  qty: number;                 // pcs
  weight: number;              // display units (g or ct); 0 for pcs items
  ratePerUnit: number;         // ₹ per g / ct / pcs
  makingMode: ChargeModeT;
  makingValue: number;         // % or ₹ — display units
  wastageMode: ChargeModeT;
  wastageValue: number;
  gstPct: number;
};

export function makeDraftLine(it: Item): DraftLine {
  return {
    key: `${it.id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    itemId: it.id,
    description: it.name,
    category: it.category,
    unit: it.unit,
    stamp: it.stamp,
    hsn: it.hsn,
    qty: it.unit === 'pcs' ? 1 : 0,
    weight: 0,
    ratePerUnit: 0,
    makingMode: it.labourMode,
    makingValue: it.labourMode === 'pct' ? it.labourValue / 100 : it.labourValue / 100,
    wastageMode: it.wastageMode,
    wastageValue: it.wastageValue / 100,
    gstPct: it.gstBp / 100,
  };
}

// Convert one draft line → canonical SaleLineInput (paise / mg / bp).
export function toLineInput(l: DraftLine): SaleLineInput {
  const weightMg = l.unit === 'carat' ? caratToMg(l.weight) : l.unit === 'gms' ? gramsToMg(l.weight) : 0;
  const ratePaise = rupeesToPaise(l.ratePerUnit);
  const makingValue = l.makingMode === 'pct' ? Math.round(l.makingValue * 100) : rupeesToPaise(l.makingValue);
  const wastageValue = l.wastageMode === 'pct' ? Math.round(l.wastageValue * 100) : rupeesToPaise(l.wastageValue);
  return {
    itemId: l.itemId,
    description: l.description,
    category: l.category,
    unit: l.unit,
    stamp: l.stamp,
    hsn: l.hsn,
    qty: Math.round(l.qty),
    weightMg,
    ratePaise,
    makingMode: l.makingMode,
    makingValue,
    wastageMode: l.wastageMode,
    wastageValue,
    gstBp: Math.round(l.gstPct * 100),
  };
}

// Preview totals — same math as electron/txn.ts, kept small.
export function computeLineTotals(l: DraftLine, interstate: boolean) {
  const li = toLineInput(l);
  const metal = li.unit === 'pcs' ? li.qty * li.ratePaise :
    Math.round((li.weightMg * li.ratePaise) / (li.unit === 'gms' ? 1000 : 200));
  const making = charge(li.makingMode, li.makingValue, metal, li.weightMg, li.qty);
  const wastage = charge(li.wastageMode, li.wastageValue, metal, li.weightMg, li.qty);
  const taxable = metal + making + wastage;
  const gst = Math.round((taxable * li.gstBp) / 10000);
  const cgst = interstate ? 0 : Math.round(gst / 2);
  const sgst = interstate ? 0 : gst - cgst;
  const igst = interstate ? gst : 0;
  return { metal, making, wastage, taxable, cgst, sgst, igst, total: taxable + cgst + sgst + igst };
}

function charge(mode: string, value: number, metal: number, weightMg: number, qty: number): number {
  if (mode === 'pct') return Math.round((metal * value) / 10000);
  if (mode === 'per_gram') return Math.round((value * weightMg) / 1000);
  if (mode === 'per_pcs') return value * qty;
  return 0;
}

// ────────────────────────────────────────────────────────────
export type Draft = {
  partyId: number | null;
  partyStateCode: string;
  lines: DraftLine[];
  discount: number;      // ₹
  roundOff: number;      // ₹
  cash: number;          // ₹
  bank: number;          // ₹
  oldGold: { category: 'gold' | 'silver'; stamp: string; weight: number; rate: number } | null;
  notes: string;
};

export const EMPTY_DRAFT: Draft = {
  partyId: null,
  partyStateCode: '',
  lines: [],
  discount: 0,
  roundOff: 0,
  cash: 0,
  bank: 0,
  oldGold: null,
  notes: '',
};

export function useSaleDraft(companyStateCode: string) {
  const [d, setD] = useState<Draft>(EMPTY_DRAFT);

  const interstate = !!(companyStateCode && d.partyStateCode && companyStateCode !== d.partyStateCode);

  const totals = useMemo(() => {
    let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
    const perLine = d.lines.map((l) => computeLineTotals(l, interstate));
    for (const t of perLine) {
      subtotal += t.taxable; cgst += t.cgst; sgst += t.sgst; igst += t.igst;
    }
    const discountPaise = rupeesToPaise(d.discount);
    const roundOffPaise = rupeesToPaise(d.roundOff);
    const total = subtotal + cgst + sgst + igst - discountPaise + roundOffPaise;
    const oldGoldValue = d.oldGold ? Math.round((gramsToMg(d.oldGold.weight) * rupeesToPaise(d.oldGold.rate)) / 1000) : 0;
    const paid = rupeesToPaise(d.cash) + rupeesToPaise(d.bank) + oldGoldValue;
    return { subtotal, cgst, sgst, igst, discountPaise, roundOffPaise, total, oldGoldValue, paid, balance: total - paid, perLine };
  }, [d, interstate]);

  function reset() { setD(EMPTY_DRAFT); }
  function addLine(it: Item) { setD((d) => ({ ...d, lines: [...d.lines, makeDraftLine(it)] })); }
  function updLine(key: string, patch: Partial<DraftLine>) {
    setD((d) => ({ ...d, lines: d.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  }
  function delLine(key: string) { setD((d) => ({ ...d, lines: d.lines.filter((l) => l.key !== key) })); }

  function toPayload(): { partyId: number; discountPaise: number; roundOffPaise: number; notes: string; lines: SaleLineInput[]; payments: SalePaymentInput[] } {
    if (!d.partyId) throw new Error('party required');
    if (d.lines.length === 0) throw new Error('at least one line required');
    const payments: SalePaymentInput[] = [];
    if (d.cash > 0) payments.push({ kind: 'cash', amountPaise: rupeesToPaise(d.cash) });
    if (d.bank > 0) payments.push({ kind: 'bank', amountPaise: rupeesToPaise(d.bank), note: '' });
    if (d.oldGold && d.oldGold.weight > 0) {
      payments.push({
        kind: 'old_gold',
        metalCategory: d.oldGold.category,
        metalStamp: d.oldGold.stamp,
        metalWeightMg: gramsToMg(d.oldGold.weight),
        metalRatePaise: rupeesToPaise(d.oldGold.rate),
      });
    }
    return {
      partyId: d.partyId,
      discountPaise: totals.discountPaise,
      roundOffPaise: totals.roundOffPaise,
      notes: d.notes,
      lines: d.lines.map(toLineInput),
      payments,
    };
  }

  return { draft: d, setDraft: setD, addLine, updLine, delLine, reset, totals, interstate, toPayload };
}
