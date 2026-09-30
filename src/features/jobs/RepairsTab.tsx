import { useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { fmtPaise, gramsToMg, rupeesToPaise } from '@/lib/format';
import { ErrorBanner, LoadingBlock, EmptyState, Spinner } from '@/components/Status';
import type { Party, Karigar } from '@shared/ipc';
import { StatusChip, fmtDate } from './shared';

const CAT = ['gold', 'silver', 'stone', 'artificial'] as const;

export function RepairsTab() {
  const list = useAsync<any[]>(() => invoke(CH.repairsList, {}));
  const parties = useAsync<Party[]>(() => invoke(CH.partiesList));
  const karigars = useAsync<Karigar[]>(() => invoke(CH.karigarsList));

  const [showForm, setShowForm] = useState(false);
  const [partyId, setPartyId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [material, setMaterial] = useState({ cat: '' as string, stamp: '', weightG: 0 });
  const [karigarId, setKarigarId] = useState<number | null>(null);
  const [addition, setAddition] = useState(0);
  const [labour, setLabour] = useState(0);
  const [promised, setPromised] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState('');

  const [deliverRow, setDeliverRow] = useState<any | null>(null);
  const [payCash, setPayCash] = useState(0);
  const [payBank, setPayBank] = useState(0);

  const post = useMutation<any, any>((p) => invoke(CH.repairCreate, p));
  const statusMut = useMutation<any, any>((p) => invoke(CH.repairStatus, p));
  const deliverMut = useMutation<any, any>((p) => invoke(CH.repairDeliver, p));

  async function submit() {
    setErr(''); post.clearError();
    if (!partyId) return setErr('pick a party');
    if (!description.trim()) return setErr('description required');
    try {
      await post.run({
        partyId, description,
        customerMaterialCategory: material.cat || null,
        customerMaterialStamp: material.stamp || null,
        customerMaterialWeightMg: gramsToMg(material.weightG),
        karigarId,
        additionPaise: rupeesToPaise(addition),
        labourPaise: rupeesToPaise(labour),
        promisedDate: promised, notes,
      });
      setShowForm(false); setPartyId(null); setDescription(''); setMaterial({ cat: '', stamp: '', weightG: 0 });
      setKarigarId(null); setAddition(0); setLabour(0); setPromised(''); setNotes('');
      await list.reload();
    } catch { /* surfaced */ }
  }

  async function moveStatus(id: number, status: string) {
    try { await statusMut.run({ id, status }); await list.reload(); } catch { /* surfaced */ }
  }

  async function doDeliver() {
    if (!deliverRow) return;
    try {
      await deliverMut.run({
        id: deliverRow.id,
        paidCashPaise: rupeesToPaise(payCash),
        paidBankPaise: rupeesToPaise(payBank),
      });
      setDeliverRow(null); setPayCash(0); setPayBank(0);
      await list.reload();
    } catch { /* surfaced */ }
  }

  if (list.error) return <ErrorBanner message={list.error} onDismiss={() => list.reload()} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-[var(--ink-500)]">
          Customer's item comes in → assign karigar → mark ready → deliver &amp; charge. Shop stock is not affected.
        </p>
        {!showForm && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={12} weight="bold" /> New repair
          </button>
        )}
      </div>

      {showForm && (
        <div className="card space-y-3">
          <div className="section-label">— new repair slip ———————</div>
          <div className="grid grid-cols-3 gap-3">
            <label className="text-xs text-[var(--ink-500)]">Party
              <select className="input w-full" value={partyId ?? ''} onChange={(e) => setPartyId(Number(e.target.value) || null)}>
                <option value="">— pick —</option>
                {(parties.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-[var(--ink-500)]">Assign karigar (optional)
              <select className="input w-full" value={karigarId ?? ''} onChange={(e) => setKarigarId(Number(e.target.value) || null)}>
                <option value="">— none —</option>
                {(karigars.data ?? []).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-[var(--ink-500)]">Promised delivery
              <input type="date" className="input w-full" value={promised} onChange={(e) => setPromised(e.target.value)} />
            </label>
          </div>

          <label className="text-xs text-[var(--ink-500)] block">Description
            <input required className="input w-full" placeholder="e.g. 22k gold chain, clasp broken"
                   value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>

          <div className="section-label mt-2">— customer material (optional) ———</div>
          <div className="grid grid-cols-3 gap-3">
            <label className="text-xs text-[var(--ink-500)]">Category
              <select className="input w-full" value={material.cat} onChange={(e) => setMaterial({ ...material, cat: e.target.value })}>
                <option value="">— none —</option>
                {CAT.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-xs text-[var(--ink-500)]">Stamp
              <input className="input w-full mono" value={material.stamp} onChange={(e) => setMaterial({ ...material, stamp: e.target.value })} />
            </label>
            <label className="text-xs text-[var(--ink-500)]">Weight (g)
              <input type="number" step="0.001" className="input w-full mono" value={material.weightG}
                     onChange={(e) => setMaterial({ ...material, weightG: Number(e.target.value) || 0 })} />
            </label>
          </div>

          <div className="section-label mt-2">— charges ————————</div>
          <div className="grid grid-cols-3 gap-3">
            <label className="text-xs text-[var(--ink-500)]">Addition (₹)
              <input type="number" step="0.01" className="input w-full mono" value={addition}
                     onChange={(e) => setAddition(Number(e.target.value) || 0)} />
            </label>
            <label className="text-xs text-[var(--ink-500)]">Labour (₹)
              <input type="number" step="0.01" className="input w-full mono" value={labour}
                     onChange={(e) => setLabour(Number(e.target.value) || 0)} />
            </label>
            <label className="text-xs text-[var(--ink-500)]">Notes
              <input className="input w-full" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>

          <div className="flex gap-2 items-center">
            <button className="btn-primary" onClick={submit} disabled={post.loading}>
              {post.loading ? <Spinner label="posting" /> : 'Post repair'}
            </button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            {err && <ErrorBanner message={err} onDismiss={() => setErr('')} />}
            {post.error && <ErrorBanner message={post.error} onDismiss={post.clearError} />}
          </div>
        </div>
      )}

      {statusMut.error && <ErrorBanner message={statusMut.error} onDismiss={statusMut.clearError} />}
      {deliverMut.error && <ErrorBanner message={deliverMut.error} onDismiss={deliverMut.clearError} />}

      {deliverRow && (
        <div className="card space-y-3" style={{ borderColor: 'var(--gold-500)' }}>
          <div className="section-label">— deliver {deliverRow.slipNo} ———</div>
          <div className="text-sm">
            <div><b>{deliverRow.description}</b></div>
            <div className="text-[var(--ink-500)]">Total due <span className="mono text-[var(--ink-950)]">{fmtPaise(deliverRow.totalPaise)}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-[var(--ink-500)]">Cash (₹)
              <input type="number" step="0.01" className="input w-full mono" value={payCash} onChange={(e) => setPayCash(Number(e.target.value) || 0)} />
            </label>
            <label className="text-xs text-[var(--ink-500)]">Bank (₹)
              <input type="number" step="0.01" className="input w-full mono" value={payBank} onChange={(e) => setPayBank(Number(e.target.value) || 0)} />
            </label>
          </div>
          <div className="flex gap-2 items-center">
            <button className="btn-primary" onClick={doDeliver} disabled={deliverMut.loading}>
              {deliverMut.loading ? <Spinner label="delivering" /> : 'Confirm delivery'}
            </button>
            <button className="btn" onClick={() => setDeliverRow(null)}>Cancel</button>
          </div>
        </div>
      )}

      {list.loading ? <LoadingBlock label="loading repairs…" /> : (
        <table className="ledger-table">
          <thead><tr>
            <th>Slip</th><th>Date</th><th>Party</th><th>Description</th>
            <th>Karigar</th><th>Promised</th>
            <th className="text-right">Total</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {(list.data ?? []).map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.slipNo}</td>
                <td className="mono text-[11px] text-[var(--ink-500)]">{fmtDate(r.ts)}</td>
                <td>{r.partyName}</td>
                <td style={{ maxWidth: 180 }} className="truncate">{r.description}</td>
                <td className="text-[var(--ink-500)]">{r.karigarName ?? '—'}</td>
                <td className="mono text-[11px] text-[var(--ink-500)]">{r.promisedDate || '—'}</td>
                <td className="num">{fmtPaise(r.totalPaise)}</td>
                <td><StatusChip status={r.status} /></td>
                <td className="text-right">
                  {r.status === 'received' && <button className="link" onClick={() => moveStatus(r.id, 'in_progress')}>start</button>}
                  {r.status === 'in_progress' && <button className="link" onClick={() => moveStatus(r.id, 'ready')}>ready</button>}
                  {r.status === 'ready' && <button className="link" onClick={() => { setDeliverRow(r); setPayCash(r.totalPaise / 100); setPayBank(0); }}>deliver</button>}
                </td>
              </tr>
            ))}
            {(list.data?.length ?? 0) === 0 && <tr><td colSpan={9}><EmptyState hint="Create a repair when a customer brings an item in for work">no repairs yet</EmptyState></td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
