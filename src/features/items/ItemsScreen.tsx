import { useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { fmtGrams, fmtCarat } from '@/lib/format';
import { ErrorBanner, LoadingBlock, EmptyState, Spinner } from '@/components/Status';
import { CategoryBadge } from '@/components/CategoryBadge';
import type { Item, ItemInput } from '@shared/ipc';

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
      await save.run(payload);
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
      await list.reload();
    } catch { /* surfaced */ }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <form onSubmit={submit} className="grid grid-cols-6 gap-2 bg-panel p-4 border border-border rounded">
        <F label="SKU"><input required className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></F>
        <F label="Name" span={2}><input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
        <F label="Category">
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as any })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </F>
        <F label="Unit">
          <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as any })}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </F>
        <F label="Stamp">
          <input className="input" disabled={!needsStamp(form.category)}
                 placeholder={needsStamp(form.category) ? '22k / 925' : '—'}
                 value={form.stamp} onChange={(e) => setForm({ ...form, stamp: e.target.value })} />
        </F>
        <F label="HSN"><input className="input" value={form.hsn} onChange={(e) => setForm({ ...form, hsn: e.target.value })} /></F>
        <F label="GST %">
          <input type="number" step="0.01" className="input mono"
                 value={form.gstBp / 100}
                 onChange={(e) => setForm({ ...form, gstBp: Math.round(Number(e.target.value) * 100) })} />
        </F>
        <F label="Labour mode">
          <select className="input" value={form.labourMode} onChange={(e) => setForm({ ...form, labourMode: e.target.value as any })}>
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </F>
        <F label={form.labourMode === 'pct' ? 'Labour %' : 'Labour ₹'}>
          <input type="number" step="0.01" className="input mono"
                 value={form.labourValue / 100}
                 onChange={(e) => setForm({ ...form, labourValue: Math.round(Number(e.target.value) * 100) })} />
        </F>
        <F label="Wastage mode">
          <select className="input" value={form.wastageMode} onChange={(e) => setForm({ ...form, wastageMode: e.target.value as any })}>
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </F>
        <F label={form.wastageMode === 'pct' ? 'Wastage %' : 'Wastage ₹'}>
          <input type="number" step="0.01" className="input mono"
                 value={form.wastageValue / 100}
                 onChange={(e) => setForm({ ...form, wastageValue: Math.round(Number(e.target.value) * 100) })} />
        </F>
        <div className="col-span-6 flex items-center gap-2">
          <button type="submit" className="btn-primary" disabled={save.loading}>
            {save.loading ? <Spinner label={editingId ? 'updating…' : 'adding…'} /> : (editingId ? 'Update' : 'Add item')}
          </button>
          {editingId && (
            <button type="button" className="btn" onClick={() => { setEditingId(null); setForm(EMPTY); save.clearError(); }}>Cancel</button>
          )}
        </div>
        {save.error && <div className="col-span-6"><ErrorBanner message={save.error} onDismiss={save.clearError} /></div>}
      </form>

      {del.error && <ErrorBanner message={del.error} onDismiss={del.clearError} />}
      {list.error && <ErrorBanner message={list.error} onDismiss={() => list.reload()} />}

      {list.loading ? <LoadingBlock label="loading items…" /> : (
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-muted">
            <tr>
              <th className="py-1 pr-2">SKU</th><th className="pr-2">Name</th>
              <th className="pr-2" colSpan={2}>Category</th>
              <th className="pr-2">Unit</th>
              <th className="pr-2 text-right">Stock qty</th><th className="pr-2 text-right">Stock wt</th><th></th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((it) => (
              <tr key={it.id} className="border-b border-border/50 hover:bg-[var(--bg-hover)]">
                <td className="py-1 pr-2 mono">{it.sku}</td>
                <td className="pr-2">{it.name}</td>
                <td className="pr-2" colSpan={2}><CategoryBadge category={it.category} stamp={it.stamp} /></td>
                <td className="pr-2 text-xs text-muted uppercase">{it.unit}</td>
                <td className="pr-2 text-right mono">{it.stockQty}</td>
                <td className="pr-2 text-right mono">
                  {it.unit === 'carat' ? fmtCarat(it.stockWtMg) : fmtGrams(it.stockWtMg)}
                </td>
                <td className="text-right">
                  <button className="link" onClick={() => edit(it)}>edit</button>{' '}
                  <button className="link text-danger" onClick={() => onDel(it)} disabled={del.loading}>del</button>
                </td>
              </tr>
            ))}
            {(list.data?.length ?? 0) === 0 && (
              <tr><td colSpan={8}><EmptyState>no items</EmptyState></td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

const SPAN = ['', 'col-span-1', 'col-span-2', 'col-span-3', 'col-span-4', 'col-span-5', 'col-span-6'] as const;
function F({ label, span = 1, children }: { label: string; span?: number; children: React.ReactNode }) {
  return (
    <label className={`text-xs text-muted flex flex-col gap-1 ${SPAN[span] ?? 'col-span-1'}`}>
      {label}{children}
    </label>
  );
}
