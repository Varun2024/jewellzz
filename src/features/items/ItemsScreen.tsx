/* Items — form + list (SKU, name, category, pricing). Ported to v2 primitives. */

import { useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { CategoryBadge } from '@/components/CategoryBadge';
import type { Item, ItemInput } from '@shared/ipc';
import {
  Sheet, Button, Field, Weight, Num, Progress, Empty, toast,
} from '@/components/ui';

type Form = Omit<ItemInput, 'stamp'> & { stamp: string; id?: number };

const EMPTY: Form = {
  sku: '', name: '',
  category: 'gold', unit: 'gms', stamp: '22k',
  hsn: '7113', gstBp: 300,
  labourMode: 'pct', labourValue: 1000,
  wastageMode: 'pct', wastageValue: 200,
  stockQty: 0, stockWtMg: 0,
};

const CATEGORIES = ['gold', 'silver', 'stone', 'artificial'] as const;
const UNITS = ['gms', 'carat', 'pcs'] as const;
const MODES = ['pct', 'per_gram', 'per_pcs'] as const;

function needsStamp(cat: string) { return cat === 'gold' || cat === 'silver'; }

export function ItemsScreen() {
  const list = useAsync<Item[]>(() => invoke(CH.itemsList));
  const [form, setForm] = useState<Form>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const save = useMutation<ItemInput & { id?: number }, Item>(async (p) => {
    if (p.id) return invoke(CH.itemsUpdate, p);
    return invoke(CH.itemsCreate, p);
  });
  const del = useMutation<number, { ok: boolean }>((id) => invoke(CH.itemsDelete, { id }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload: ItemInput & { id?: number } = {
        ...form,
        stamp: needsStamp(form.category) ? form.stamp : null,
        id: editingId ?? undefined,
      };
      const res = await save.run(payload);
      if (editingId) {
        toast.success(`Updated ${res.name}`);
      } else {
        toast.success(`Added ${res.name}`, {
          action: { label: 'edit', onClick: () => edit(res) },
        });
      }
      setForm(EMPTY); setEditingId(null);
      await list.reload();
    } catch { /* surfaced */ }
  }

  function edit(it: Item) {
    setEditingId(it.id);
    setForm({
      sku: it.sku, name: it.name, category: it.category, unit: it.unit,
      stamp: it.stamp ?? '', hsn: it.hsn, gstBp: it.gstBp,
      labourMode: it.labourMode, labourValue: it.labourValue,
      wastageMode: it.wastageMode, wastageValue: it.wastageValue,
      stockQty: it.stockQty, stockWtMg: it.stockWtMg,
    });
    save.clearError();
  }

  async function onDel(it: Item) {
    if (!confirm(`Delete ${it.name}?`)) return;
    try {
      await del.run(it.id);
      toast.success(`Deleted ${it.name}`);
      await list.reload();
    } catch { /* surfaced */ }
  }

  return (
    <div className="ds-v2" style={{ padding: 'var(--container-pad)', height: '100%', overflow: 'auto', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>

        <Sheet title={editingId ? 'Edit item' : 'New item'}>
          <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--s3)' }}>
            <Field label="SKU" required value={form.sku}
                   onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            <div style={{ gridColumn: 'span 2' }}>
              <Field label="Name" required value={form.name}
                     onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <SelectField label="Category" value={form.category}
                         options={CATEGORIES}
                         onChange={(v) => setForm({ ...form, category: v as Item['category'] })} />
            <SelectField label="Unit" value={form.unit}
                         options={UNITS}
                         onChange={(v) => setForm({ ...form, unit: v as Item['unit'] })} />
            <Field
              label="Stamp"
              disabled={!needsStamp(form.category)}
              placeholder={needsStamp(form.category) ? '22k / 925' : '—'}
              value={form.stamp}
              onChange={(e) => setForm({ ...form, stamp: e.target.value })}
            />

            <Field label="HSN" value={form.hsn}
                   onChange={(e) => setForm({ ...form, hsn: e.target.value })} />
            <Field
              label="GST %"
              numeric
              type="number" step="0.01"
              value={form.gstBp / 100}
              onChange={(e) => setForm({ ...form, gstBp: Math.round(Number(e.target.value) * 100) })}
            />
            <SelectField label="Labour mode" value={form.labourMode}
                         options={MODES}
                         onChange={(v) => setForm({ ...form, labourMode: v as Item['labourMode'] })} />
            <Field
              label={form.labourMode === 'pct' ? 'Labour %' : 'Labour ₹'}
              numeric
              type="number" step="0.01"
              value={form.labourValue / 100}
              onChange={(e) => setForm({ ...form, labourValue: Math.round(Number(e.target.value) * 100) })}
            />
            <SelectField label="Wastage mode" value={form.wastageMode}
                         options={MODES}
                         onChange={(v) => setForm({ ...form, wastageMode: v as Item['wastageMode'] })} />
            <Field
              label={form.wastageMode === 'pct' ? 'Wastage %' : 'Wastage ₹'}
              numeric
              type="number" step="0.01"
              value={form.wastageValue / 100}
              onChange={(e) => setForm({ ...form, wastageValue: Math.round(Number(e.target.value) * 100) })}
            />

            <div style={{ gridColumn: 'span 6', display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
              <Button variant="primary" type="submit" disabled={save.loading}>
                {save.loading ? (editingId ? 'Updating…' : 'Adding…') : (editingId ? 'Update' : 'Add item')}
              </Button>
              {editingId && (
                <Button type="button" onClick={() => { setEditingId(null); setForm(EMPTY); save.clearError(); }}>
                  Cancel
                </Button>
              )}
              {save.error && <InlineAlert message={save.error} onDismiss={save.clearError} />}
            </div>
          </form>
        </Sheet>

        {del.error  && <InlineAlert message={del.error}  onDismiss={del.clearError} />}
        {list.error && <InlineAlert message={list.error} onDismiss={() => list.reload()} />}

        <Sheet title="Items" flush>
          {list.loading ? <div style={{ padding: 12 }}><Progress /></div>
            : (list.data?.length ?? 0) === 0 ? <Empty mark="case" title="Nothing in the case yet" />
            : (
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>SKU</th>
                    <th>Name</th>
                    <th style={{ width: 140 }}>Category</th>
                    <th style={{ width: 70 }}>Unit</th>
                    <th className="num" style={{ width: 90 }}>Qty</th>
                    <th className="num" style={{ width: 120 }}>Stock weight</th>
                    <th style={{ width: 110 }} />
                  </tr>
                </thead>
                <tbody>
                  {(list.data ?? []).map((it) => (
                    <tr key={it.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)' }}>{it.sku}</td>
                      <td>{it.name}</td>
                      <td><CategoryBadge category={it.category} stamp={it.stamp} /></td>
                      <td style={{
                        fontSize: 'var(--t-sm)', color: 'var(--text-mute)',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>{it.unit}</td>
                      <td className="num"><Num value={it.stockQty} /></td>
                      <td className="num">
                        {it.stockWtMg
                          ? <Weight mg={it.stockWtMg} unit={it.unit === 'carat' ? 'ct' : 'g'} />
                          : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                      </td>
                      <td className="num">
                        <div style={{ display: 'inline-flex', gap: 'var(--s2)' }}>
                          <Button variant="link" onClick={() => edit(it)}>edit</Button>
                          <Button variant="link" onClick={() => onDel(it)} disabled={del.loading} style={{ color: 'var(--neg)' }}>
                            del
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Sheet>
      </div>
    </div>
  );
}

function SelectField<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="field">
      <label className="field__label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function InlineAlert({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="alert">
      <span style={{ whiteSpace: 'pre-wrap' }}>{message}</span>
      {onDismiss && <button className="alert__dismiss" onClick={onDismiss} aria-label="dismiss">×</button>}
    </div>
  );
}
