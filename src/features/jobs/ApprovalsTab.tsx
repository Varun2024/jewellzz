import { useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { fmtGrams, gramsToMg, caratToMg } from '@/lib/format';
import { ErrorBanner, LoadingBlock, EmptyState, Spinner } from '@/components/Status';
import type { Item, Party } from '@shared/ipc';
import { StatusChip, fmtDate } from './shared';

type Line = {
  key: string;
  itemId: number;
  itemName: string;
  category: Item['category'];
  stamp: string | null;
  unit: 'g' | 'ct' | 'pcs';
  qty: number;
  weight: number;
  note: string;
};

export function ApprovalsTab() {
  const list = useAsync<any[]>(() => invoke(CH.approvalsList, {}));
  const items = useAsync<Item[]>(() => invoke(CH.itemsList));
  const parties = useAsync<Party[]>(() => invoke(CH.partiesList));

  const [showForm, setShowForm] = useState(false);
  const [partyId, setPartyId] = useState<number | null>(null);
  const [promised, setPromised] = useState('');
  const [notes, setNotes] = useState('');
  const [pickId, setPickId] = useState<number | ''>('');
  const [lines, setLines] = useState<Line[]>([]);
  const [err, setErr] = useState('');
  const post = useMutation<any, any>((p) => invoke(CH.approvalCreate, p));
  const resolve = useMutation<any, any>((p) => invoke(CH.approvalResolve, p));

  function addLine() {
    if (!pickId) return;
    const it = items.data?.find((x) => x.id === Number(pickId));
    if (!it) return;
    setLines((ls) => [...ls, {
      key: `${it.id}-${Date.now()}`,
      itemId: it.id, itemName: it.name, category: it.category, stamp: it.stamp,
      unit: it.unit === 'gms' ? 'g' : it.unit === 'carat' ? 'ct' : 'pcs',
      qty: it.unit === 'pcs' ? 1 : 0, weight: 0, note: '',
    }]);
    setPickId('');
  }
  function upd(k: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => l.key === k ? { ...l, ...patch } : l));
  }
  function del(k: string) { setLines((ls) => ls.filter((l) => l.key !== k)); }

  async function submit() {
    setErr(''); post.clearError();
    if (!partyId) return setErr('pick a party');
    if (lines.length === 0) return setErr('add at least one line');
    try {
      await post.run({
        partyId, promisedReturnDate: promised, notes,
        lines: lines.map((l) => ({
          itemId: l.itemId, category: l.category, stamp: l.stamp,
          qty: Math.round(l.qty),
          weightMg: l.unit === 'ct' ? caratToMg(l.weight) : l.unit === 'g' ? gramsToMg(l.weight) : 0,
          note: l.note,
        })),
      });
      setShowForm(false); setPartyId(null); setPromised(''); setNotes(''); setLines([]);
      await list.reload();
    } catch { /* surfaced */ }
  }

  async function resolveTo(id: number, status: 'sold' | 'returned' | 'cancelled') {
    if (!confirm(`Mark approval as ${status}?`)) return;
    try {
      await resolve.run({ id, status });
      await list.reload();
    } catch { /* surfaced */ }
  }

  if (list.error) return <ErrorBanner message={list.error} onDismiss={() => list.reload()} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-[var(--ink-500)]">
          Goods leave shop on approval — stock decremented. Later mark <b>sold</b> (stock stays out), <b>returned</b> (stock restored), or <b>cancelled</b>.
        </p>
        {!showForm && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={12} weight="bold" /> New approval
          </button>
        )}
      </div>

      {showForm && (
        <div className="card space-y-3">
          <div className="section-label">— new approval slip ———————</div>
          <div className="grid grid-cols-3 gap-3">
            <label className="text-xs text-[var(--ink-500)]">Party
              <select className="input w-full" value={partyId ?? ''} onChange={(e) => setPartyId(Number(e.target.value) || null)}>
                <option value="">— pick —</option>
                {(parties.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-[var(--ink-500)]">Promised return
              <input type="date" className="input w-full" value={promised} onChange={(e) => setPromised(e.target.value)} />
            </label>
            <label className="text-xs text-[var(--ink-500)]">Notes
              <input className="input w-full" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>

          <div className="flex gap-2 items-end">
            <label className="text-xs text-[var(--ink-500)] flex-1">Add item
              <select className="input w-full" value={pickId} onChange={(e) => setPickId(e.target.value === '' ? '' : Number(e.target.value))}>
                <option value="">— pick item —</option>
                {(items.data ?? []).map((i) => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}
              </select>
            </label>
            <button className="btn" onClick={addLine} type="button">Add line</button>
          </div>

          <table className="ledger-table" style={{ fontSize: 12 }}>
            <thead><tr>
              <th>Item</th><th className="text-right">Qty</th><th className="text-right">Weight</th>
              <th>Unit</th><th>Note</th><th></th>
            </tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key}>
                  <td>{l.itemName}</td>
                  <td className="num"><input className="input w-14 text-right mono" type="number" value={l.qty} onChange={(e) => upd(l.key, { qty: Number(e.target.value) || 0 })} /></td>
                  <td className="num">{l.unit === 'pcs' ? <span className="text-[var(--ink-300)]">—</span> :
                    <input className="input w-20 text-right mono" type="number" step="0.001" value={l.weight} onChange={(e) => upd(l.key, { weight: Number(e.target.value) || 0 })} />}</td>
                  <td className="text-[var(--ink-500)] mono uppercase text-[11px]">{l.unit}</td>
                  <td><input className="input" value={l.note} onChange={(e) => upd(l.key, { note: e.target.value })} /></td>
                  <td className="text-right"><button className="link text-danger" onClick={() => del(l.key)}>×</button></td>
                </tr>
              ))}
              {lines.length === 0 && <tr><td colSpan={6}><EmptyState>no lines yet</EmptyState></td></tr>}
            </tbody>
          </table>

          <div className="flex gap-2 items-center">
            <button className="btn-primary" onClick={submit} disabled={post.loading}>
              {post.loading ? <Spinner label="posting" /> : 'Post approval'}
            </button>
            <button className="btn" onClick={() => { setShowForm(false); setLines([]); setPartyId(null); setNotes(''); setPromised(''); }}>Cancel</button>
            {err && <ErrorBanner message={err} onDismiss={() => setErr('')} />}
            {post.error && <ErrorBanner message={post.error} onDismiss={post.clearError} />}
          </div>
        </div>
      )}

      {resolve.error && <ErrorBanner message={resolve.error} onDismiss={resolve.clearError} />}

      {list.loading ? <LoadingBlock label="loading approvals…" /> : (
        <table className="ledger-table">
          <thead><tr>
            <th>Slip</th><th>Date</th><th>Party</th><th>Promised</th>
            <th className="text-right">Items</th><th className="text-right">Weight</th>
            <th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {(list.data ?? []).map((a) => (
              <tr key={a.id}>
                <td className="mono">{a.slipNo}</td>
                <td className="mono text-[11px] text-[var(--ink-500)]">{fmtDate(a.ts)}</td>
                <td>{a.partyName}</td>
                <td className="mono text-[11px] text-[var(--ink-500)]">{a.promisedReturnDate || '—'}</td>
                <td className="num">{a.totalQty ?? 0}</td>
                <td className="num">{fmtGrams(a.totalMg ?? 0)}</td>
                <td><StatusChip status={a.status} /></td>
                <td className="text-right">
                  {a.status === 'open' && (
                    <div className="flex gap-1 justify-end">
                      <button className="link" onClick={() => resolveTo(a.id, 'sold')}>sold</button>
                      <span className="text-[var(--ink-300)]">·</span>
                      <button className="link" onClick={() => resolveTo(a.id, 'returned')}>returned</button>
                      <span className="text-[var(--ink-300)]">·</span>
                      <button className="link text-danger" onClick={() => resolveTo(a.id, 'cancelled')}>cancel</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {(list.data?.length ?? 0) === 0 && <tr><td colSpan={8}><EmptyState hint="Create an approval when a customer takes items home to consider">no approvals yet</EmptyState></td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
