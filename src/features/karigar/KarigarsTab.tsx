import { useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { fmtPaise, fmtGrams } from '@/lib/format';
import { ErrorBanner, LoadingBlock, EmptyState, Spinner } from '@/components/Status';
import type { Karigar, KarigarInput } from '@shared/ipc';

type Balance = { id: number; name: string; phone: string | null; cashBalance: number; metalBalanceMg: number };

const EMPTY: KarigarInput & { id?: number } = {
  name: '', phone: '', address: '',
  defaultLabourMode: 'per_gram', defaultLabourValue: 0,
  notes: '',
};

const MODES = ['pct', 'per_gram', 'per_pcs'] as const;

export function KarigarsTab() {
  const bals = useAsync<Balance[]>(() => invoke(CH.karigarBalances));
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const save = useMutation<KarigarInput & { id?: number }, Karigar>(async (p) => {
    if (p.id) return invoke(CH.karigarsUpdate, p);
    return invoke(CH.karigarsCreate, p);
  });
  const del = useMutation<number, { ok: boolean }>((id) => invoke(CH.karigarsDelete, { id }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.run({ ...form, id: editingId ?? undefined });
      setForm(EMPTY); setEditingId(null);
      await bals.reload();
    } catch { /* surfaced */ }
  }

  function edit(k: Balance) {
    // fetch full karigar
    invoke<Karigar[]>(CH.karigarsList).then((list) => {
      const full = list.find((x) => x.id === k.id);
      if (!full) return;
      setEditingId(full.id);
      setForm({
        name: full.name, phone: full.phone ?? '', address: full.address,
        defaultLabourMode: full.defaultLabourMode, defaultLabourValue: full.defaultLabourValue,
        notes: full.notes,
      });
      save.clearError();
    });
  }

  async function onDel(k: Balance) {
    if (!confirm(`Delete ${k.name}?`)) return;
    try {
      await del.run(k.id);
      await bals.reload();
    } catch { /* surfaced */ }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <form onSubmit={submit} className="grid grid-cols-6 gap-2 bg-panel p-4 border border-border rounded">
        <F label="Name" span={2}><input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
        <F label="Phone"><input className="input" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></F>
        <F label="Address" span={3}><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></F>
        <F label="Default labour mode">
          <select className="input" value={form.defaultLabourMode} onChange={(e) => setForm({ ...form, defaultLabourMode: e.target.value as any })}>
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </F>
        <F label={form.defaultLabourMode === 'pct' ? 'Default labour %' : 'Default labour ₹'}>
          <input type="number" step="0.01" className="input mono"
                 value={form.defaultLabourValue / 100}
                 onChange={(e) => setForm({ ...form, defaultLabourValue: Math.round(Number(e.target.value) * 100) })} />
        </F>
        <F label="Notes" span={4}><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
        <div className="col-span-6 flex gap-2 items-center">
          <button type="submit" className="btn-primary" disabled={save.loading}>
            {save.loading ? <Spinner label={editingId ? 'updating…' : 'adding…'} /> : (editingId ? 'Update' : 'Add karigar')}
          </button>
          {editingId && <button type="button" className="btn" onClick={() => { setEditingId(null); setForm(EMPTY); save.clearError(); }}>Cancel</button>}
        </div>
        {save.error && <div className="col-span-6"><ErrorBanner message={save.error} onDismiss={save.clearError} /></div>}
      </form>

      {del.error && <ErrorBanner message={del.error} onDismiss={del.clearError} />}
      {bals.error && <ErrorBanner message={bals.error} onDismiss={() => bals.reload()} />}
      {bals.loading ? <LoadingBlock label="loading karigars…" /> : (
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-muted">
            <tr>
              <th className="py-1 pr-2">Name</th><th className="pr-2">Phone</th>
              <th className="pr-2 text-right">Cash balance</th>
              <th className="pr-2 text-right">Metal balance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(bals.data ?? []).map((k) => (
              <tr key={k.id} className="border-b border-border/50 hover:bg-[var(--bg-hover)]">
                <td className="py-1 pr-2">{k.name}</td>
                <td className="pr-2">{k.phone ?? ''}</td>
                <td className={`pr-2 text-right mono ${k.cashBalance < 0 ? 'text-danger' : ''}`}>
                  {fmtPaise(k.cashBalance)}
                </td>
                <td className={`pr-2 text-right mono ${k.metalBalanceMg > 0 ? 'text-warn' : ''}`}>
                  {fmtGrams(k.metalBalanceMg)}
                </td>
                <td className="text-right">
                  <button className="link" onClick={() => edit(k)}>edit</button>{' '}
                  <button className="link text-danger" onClick={() => onDel(k)} disabled={del.loading}>del</button>
                </td>
              </tr>
            ))}
            {(bals.data?.length ?? 0) === 0 && (
              <tr><td colSpan={5}><EmptyState>no karigars — add one to get started</EmptyState></td></tr>
            )}
          </tbody>
        </table>
      )}
      <p className="text-xs text-muted">
        Cash balance: negative = shop owes labour to karigar. Metal balance: positive = karigar owes metal to shop (open issue slip pending receipt).
      </p>
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
