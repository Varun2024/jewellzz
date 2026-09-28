import { useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { fmtPaise, fmtGrams, rupeesToPaise, gramsToMg } from '@/lib/format';
import { ErrorBanner, LoadingBlock, EmptyState, Spinner } from '@/components/Status';
import type { Party, PartyInput } from '@shared/ipc';

const EMPTY: PartyInput & { id?: number } = {
  name: '', role: 'customer', gstin: '', phone: '',
  address: '', stateCode: '',
  openingCash: 0, openingMetalMg: 0,
};

export function PartiesScreen() {
  const list = useAsync<Party[]>(() => invoke(CH.partiesList));
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const save = useMutation<PartyInput & { id?: number }, Party>(async (p) => {
    if (p.id) return invoke(CH.partiesUpdate, p);
    return invoke(CH.partiesCreate, p);
  });
  const del = useMutation<number, { ok: boolean }>((id) => invoke(CH.partiesDelete, { id }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.run({ ...form, id: editingId ?? undefined });
      setForm(EMPTY); setEditingId(null);
      await list.reload();
    } catch { /* error surfaced via save.error */ }
  }

  function edit(p: Party) {
    setEditingId(p.id);
    setForm({
      name: p.name, role: p.role,
      gstin: p.gstin ?? '', phone: p.phone ?? '',
      address: p.address, stateCode: p.stateCode,
      openingCash: p.openingCash, openingMetalMg: p.openingMetalMg,
    });
    save.clearError();
  }

  async function onDel(p: Party) {
    if (!confirm(`Delete ${p.name}?`)) return;
    try {
      await del.run(p.id);
      await list.reload();
    } catch { /* error via del.error */ }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <form onSubmit={submit} className="grid grid-cols-6 gap-2 bg-panel p-4 border border-border rounded">
        <F label="Name" span={2}><input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
        <F label="Role">
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as any })}>
            <option value="customer">customer</option><option value="supplier">supplier</option><option value="both">both</option>
          </select>
        </F>
        <F label="Phone"><input className="input" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></F>
        <F label="GSTIN"><input className="input" value={form.gstin ?? ''} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></F>
        <F label="State"><input className="input" value={form.stateCode} onChange={(e) => setForm({ ...form, stateCode: e.target.value })} /></F>
        <F label="Address" span={6}><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></F>
        <F label="Opening cash (₹)">
          <input type="number" step="0.01" className="input mono"
                 value={form.openingCash / 100}
                 onChange={(e) => setForm({ ...form, openingCash: rupeesToPaise(Number(e.target.value) || 0) })} />
        </F>
        <F label="Opening metal (g)">
          <input type="number" step="0.001" className="input mono"
                 value={form.openingMetalMg / 1000}
                 onChange={(e) => setForm({ ...form, openingMetalMg: gramsToMg(Number(e.target.value) || 0) })} />
        </F>
        <div className="col-span-6 flex gap-2 items-center">
          <button className="btn-primary" type="submit" disabled={save.loading}>
            {save.loading ? <Spinner label={editingId ? 'updating…' : 'adding…'} /> : (editingId ? 'Update' : 'Add party')}
          </button>
          {editingId && (
            <button type="button" className="btn" onClick={() => { setEditingId(null); setForm(EMPTY); save.clearError(); }}>Cancel</button>
          )}
        </div>
        {save.error && <div className="col-span-6"><ErrorBanner message={save.error} onDismiss={save.clearError} /></div>}
      </form>

      {del.error && <ErrorBanner message={del.error} onDismiss={del.clearError} />}
      {list.error && <ErrorBanner message={list.error} onDismiss={() => list.reload()} />}

      {list.loading ? <LoadingBlock label="loading parties…" /> : (
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-muted">
            <tr>
              <th className="py-1 pr-2">Name</th><th className="pr-2">Role</th><th className="pr-2">Phone</th>
              <th className="pr-2">GSTIN</th><th className="pr-2 text-right">Opening ₹</th>
              <th className="pr-2 text-right">Opening g</th><th></th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((p) => (
              <tr key={p.id} className="border-b border-border/50 hover:bg-[var(--bg-hover)]">
                <td className="py-1 pr-2">{p.name}</td>
                <td className="pr-2">{p.role}</td>
                <td className="pr-2">{p.phone ?? ''}</td>
                <td className="pr-2 mono">{p.gstin ?? ''}</td>
                <td className="pr-2 text-right mono">{fmtPaise(p.openingCash)}</td>
                <td className="pr-2 text-right mono">{fmtGrams(p.openingMetalMg)}</td>
                <td className="text-right">
                  <button className="link" onClick={() => edit(p)}>edit</button>{' '}
                  <button className="link text-danger" onClick={() => onDel(p)} disabled={del.loading}>del</button>
                </td>
              </tr>
            ))}
            {(list.data?.length ?? 0) === 0 && (
              <tr><td colSpan={7}><EmptyState>no parties</EmptyState></td></tr>
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
