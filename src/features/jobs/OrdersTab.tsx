import { useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { fmtPaise, rupeesToPaise } from '@/lib/format';
import { ErrorBanner, LoadingBlock, EmptyState, Spinner } from '@/components/Status';
import type { Party, Karigar } from '@shared/ipc';
import { StatusChip, fmtDate } from './shared';

export function OrdersTab() {
  const list = useAsync<any[]>(() => invoke(CH.ordersList, {}));
  const parties = useAsync<Party[]>(() => invoke(CH.partiesList));
  const karigars = useAsync<Karigar[]>(() => invoke(CH.karigarsList));

  const [showForm, setShowForm] = useState(false);
  const [partyId, setPartyId] = useState<number | null>(null);
  const [spec, setSpec] = useState('');
  const [estimated, setEstimated] = useState(0);
  const [karigarId, setKarigarId] = useState<number | null>(null);
  const [promised, setPromised] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState('');

  const [advRow, setAdvRow] = useState<any | null>(null);
  const [advAmount, setAdvAmount] = useState(0);

  const post = useMutation<any, any>((p) => invoke(CH.orderCreate, p));
  const advance = useMutation<any, any>((p) => invoke(CH.orderAdvance, p));
  const statusMut = useMutation<any, any>((p) => invoke(CH.orderStatus, p));

  async function submit() {
    setErr(''); post.clearError();
    if (!partyId) return setErr('pick a party');
    if (!spec.trim()) return setErr('spec required');
    try {
      await post.run({
        partyId, spec,
        estimatedPaise: rupeesToPaise(estimated),
        karigarId, promisedDate: promised, notes,
      });
      setShowForm(false); setPartyId(null); setSpec(''); setEstimated(0);
      setKarigarId(null); setPromised(''); setNotes('');
      await list.reload();
    } catch { /* surfaced */ }
  }

  async function moveStatus(id: number, status: string) {
    try { await statusMut.run({ id, status }); await list.reload(); } catch { /* surfaced */ }
  }

  async function submitAdvance() {
    if (!advRow || advAmount <= 0) return;
    try {
      await advance.run({ id: advRow.id, amountPaise: rupeesToPaise(advAmount) });
      setAdvRow(null); setAdvAmount(0);
      await list.reload();
    } catch { /* surfaced */ }
  }

  if (list.error) return <ErrorBanner message={list.error} onDismiss={() => list.reload()} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-[var(--ink-500)]">
          Customer places an order → advance received → karigar assigned → ready → delivered. Advance writes cash ledger + party credit.
        </p>
        {!showForm && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={12} weight="bold" /> New order
          </button>
        )}
      </div>

      {showForm && (
        <div className="card space-y-3">
          <div className="section-label">— new order slip ———————</div>
          <div className="grid grid-cols-3 gap-3">
            <label className="text-xs text-[var(--ink-500)]">Party
              <select className="input w-full" value={partyId ?? ''} onChange={(e) => setPartyId(Number(e.target.value) || null)}>
                <option value="">— pick —</option>
                {(parties.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-[var(--ink-500)]">Estimated total (₹)
              <input type="number" step="0.01" className="input w-full mono" value={estimated}
                     onChange={(e) => setEstimated(Number(e.target.value) || 0)} />
            </label>
            <label className="text-xs text-[var(--ink-500)]">Promised delivery
              <input type="date" className="input w-full" value={promised} onChange={(e) => setPromised(e.target.value)} />
            </label>
          </div>
          <label className="text-xs text-[var(--ink-500)] block">Spec / description
            <input required className="input w-full" placeholder="e.g. 22k gold ring, 8g, size 7, floral engraving"
                   value={spec} onChange={(e) => setSpec(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-[var(--ink-500)]">Assign karigar (optional)
              <select className="input w-full" value={karigarId ?? ''} onChange={(e) => setKarigarId(Number(e.target.value) || null)}>
                <option value="">— none —</option>
                {(karigars.data ?? []).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-[var(--ink-500)]">Notes
              <input className="input w-full" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>
          <div className="flex gap-2 items-center">
            <button className="btn-primary" onClick={submit} disabled={post.loading}>
              {post.loading ? <Spinner label="posting" /> : 'Post order'}
            </button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            {err && <ErrorBanner message={err} onDismiss={() => setErr('')} />}
            {post.error && <ErrorBanner message={post.error} onDismiss={post.clearError} />}
          </div>
        </div>
      )}

      {statusMut.error && <ErrorBanner message={statusMut.error} onDismiss={statusMut.clearError} />}
      {advance.error && <ErrorBanner message={advance.error} onDismiss={advance.clearError} />}

      {advRow && (
        <div className="card space-y-3" style={{ borderColor: 'var(--gold-500)' }}>
          <div className="section-label">— advance for {advRow.slipNo} ———</div>
          <div className="text-sm">
            <div className="text-[var(--ink-500)]">Estimated <span className="mono text-[var(--ink-950)]">{fmtPaise(advRow.estimatedPaise)}</span></div>
            <div className="text-[var(--ink-500)]">Advance so far <span className="mono text-[var(--ink-950)]">{fmtPaise(advRow.advancePaise)}</span></div>
          </div>
          <label className="text-xs text-[var(--ink-500)] block">Additional advance (₹)
            <input type="number" step="0.01" autoFocus className="input w-full mono" value={advAmount}
                   onChange={(e) => setAdvAmount(Number(e.target.value) || 0)} />
          </label>
          <div className="flex gap-2 items-center">
            <button className="btn-primary" onClick={submitAdvance} disabled={advance.loading}>
              {advance.loading ? <Spinner label="posting" /> : 'Receive advance'}
            </button>
            <button className="btn" onClick={() => { setAdvRow(null); setAdvAmount(0); }}>Cancel</button>
          </div>
        </div>
      )}

      {list.loading ? <LoadingBlock label="loading orders…" /> : (
        <table className="ledger-table">
          <thead><tr>
            <th>Slip</th><th>Date</th><th>Party</th><th>Spec</th>
            <th>Karigar</th><th>Promised</th>
            <th className="text-right">Est.</th><th className="text-right">Adv.</th>
            <th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {(list.data ?? []).map((o) => (
              <tr key={o.id}>
                <td className="mono">{o.slipNo}</td>
                <td className="mono text-[11px] text-[var(--ink-500)]">{fmtDate(o.ts)}</td>
                <td>{o.partyName}</td>
                <td style={{ maxWidth: 180 }} className="truncate">{o.spec}</td>
                <td className="text-[var(--ink-500)]">{o.karigarName ?? '—'}</td>
                <td className="mono text-[11px] text-[var(--ink-500)]">{o.promisedDate || '—'}</td>
                <td className="num">{fmtPaise(o.estimatedPaise)}</td>
                <td className="num">{fmtPaise(o.advancePaise)}</td>
                <td><StatusChip status={o.status} /></td>
                <td className="text-right">
                  {o.status !== 'delivered' && o.status !== 'cancelled' && (
                    <div className="flex gap-1 justify-end items-center flex-wrap">
                      <button className="link" onClick={() => setAdvRow(o)}>advance</button>
                      <span className="text-[var(--ink-300)]">·</span>
                      {o.status === 'open' && <button className="link" onClick={() => moveStatus(o.id, 'in_progress')}>start</button>}
                      {o.status === 'in_progress' && <button className="link" onClick={() => moveStatus(o.id, 'ready')}>ready</button>}
                      {o.status === 'ready' && <button className="link" onClick={() => moveStatus(o.id, 'delivered')}>delivered</button>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {(list.data?.length ?? 0) === 0 && <tr><td colSpan={10}><EmptyState hint="Create an order when a customer commissions a new piece">no orders yet</EmptyState></td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
