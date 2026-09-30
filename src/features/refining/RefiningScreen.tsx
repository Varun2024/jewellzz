import { useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { fmtGrams, fmtPaise, gramsToMg, rupeesToPaise } from '@/lib/format';
import { ErrorBanner, LoadingBlock, EmptyState, Spinner } from '@/components/Status';
import { CategoryBadge } from '@/components/CategoryBadge';
import type { Party } from '@shared/ipc';
import { StatusChip, fmtDate } from '@/features/jobs/shared';

export function RefiningScreen() {
  const list = useAsync<any[]>(() => invoke(CH.refiningList, {}));
  const parties = useAsync<Party[]>(() => invoke(CH.partiesList));
  const suppliers = (parties.data ?? []).filter((p) => p.role === 'supplier' || p.role === 'both');

  const [showForm, setShowForm] = useState(false);
  const [sendForm, setSendForm] = useState({
    refinerPartyId: null as number | null,
    sentCategory: 'gold' as 'gold' | 'silver',
    sentStamp: '',
    sentWeightG: 0,
    notes: '',
  });
  const [err, setErr] = useState('');

  const [receiveRow, setReceiveRow] = useState<any | null>(null);
  const [recvForm, setRecvForm] = useState({
    receivedCategory: 'gold' as 'gold' | 'silver',
    receivedStamp: '24k',
    receivedWeightG: 0,
    charges: 0,
    paidCash: 0,
  });

  const send = useMutation<any, any>((p) => invoke(CH.refiningSend, p));
  const receive = useMutation<any, any>((p) => invoke(CH.refiningReceive, p));
  const cancel = useMutation<number, any>((id) => invoke(CH.refiningCancel, { id }));

  async function submitSend() {
    setErr(''); send.clearError();
    if (!sendForm.refinerPartyId) return setErr('pick a refiner');
    if (sendForm.sentWeightG <= 0) return setErr('sent weight must be positive');
    try {
      await send.run({
        refinerPartyId: sendForm.refinerPartyId,
        sentCategory: sendForm.sentCategory,
        sentStamp: sendForm.sentStamp,
        sentWeightMg: gramsToMg(sendForm.sentWeightG),
        notes: sendForm.notes,
      });
      setShowForm(false);
      setSendForm({ refinerPartyId: null, sentCategory: 'gold', sentStamp: '', sentWeightG: 0, notes: '' });
      await list.reload();
    } catch { /* surfaced */ }
  }

  function openReceive(lot: any) {
    setReceiveRow(lot);
    setRecvForm({
      receivedCategory: lot.sentCategory,
      receivedStamp: lot.sentCategory === 'gold' ? '24k' : '999',
      receivedWeightG: lot.sentWeightMg / 1000,
      charges: 0,
      paidCash: 0,
    });
  }

  async function submitReceive() {
    if (!receiveRow) return;
    try {
      await receive.run({
        id: receiveRow.id,
        receivedCategory: recvForm.receivedCategory,
        receivedStamp: recvForm.receivedStamp,
        receivedWeightMg: gramsToMg(recvForm.receivedWeightG),
        chargesPaise: rupeesToPaise(recvForm.charges),
        paidCashPaise: rupeesToPaise(recvForm.paidCash),
      });
      setReceiveRow(null);
      await list.reload();
    } catch { /* surfaced */ }
  }

  async function doCancel(lot: any) {
    if (!confirm(`Cancel lot ${lot.slipNo}? Metal will be returned to shop stock (contra entries).`)) return;
    try {
      await cancel.run(lot.id);
      await list.reload();
    } catch { /* surfaced */ }
  }

  if (list.error) return <ErrorBanner message={list.error} onDismiss={() => list.reload()} />;

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-[var(--ink-500)]">
          Send impure / scrap metal to a refiner; receive purified metal back. Refining loss is expected and absorbed
          by the shop — the difference between sent and received shows in the metal ledger as a real net cost.
        </p>
        {!showForm && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={12} weight="bold" /> Send lot
          </button>
        )}
      </div>

      {showForm && (
        <div className="card space-y-3">
          <div className="section-label">— new refining lot ———————</div>
          <div className="grid grid-cols-4 gap-3">
            <label className="text-xs text-[var(--ink-500)] col-span-2">Refiner
              <select className="input w-full" value={sendForm.refinerPartyId ?? ''}
                      onChange={(e) => setSendForm({ ...sendForm, refinerPartyId: Number(e.target.value) || null })}>
                <option value="">— pick supplier —</option>
                {suppliers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-[var(--ink-500)]">Category
              <select className="input w-full" value={sendForm.sentCategory}
                      onChange={(e) => setSendForm({ ...sendForm, sentCategory: e.target.value as any })}>
                <option value="gold">gold</option>
                <option value="silver">silver</option>
              </select>
            </label>
            <label className="text-xs text-[var(--ink-500)]">Stamp / grade
              <input className="input w-full mono" placeholder="scrap / 22k / mixed"
                     value={sendForm.sentStamp}
                     onChange={(e) => setSendForm({ ...sendForm, sentStamp: e.target.value })} />
            </label>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <label className="text-xs text-[var(--ink-500)]">Weight (g)
              <input type="number" step="0.001" className="input w-full mono" value={sendForm.sentWeightG}
                     onChange={(e) => setSendForm({ ...sendForm, sentWeightG: Number(e.target.value) || 0 })} />
            </label>
            <label className="text-xs text-[var(--ink-500)] col-span-3">Notes
              <input className="input w-full" value={sendForm.notes}
                     onChange={(e) => setSendForm({ ...sendForm, notes: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2 items-center">
            <button className="btn-primary" onClick={submitSend} disabled={send.loading}>
              {send.loading ? <Spinner label="posting" /> : 'Post send slip'}
            </button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            {err && <ErrorBanner message={err} onDismiss={() => setErr('')} />}
            {send.error && <ErrorBanner message={send.error} onDismiss={send.clearError} />}
          </div>
        </div>
      )}

      {receiveRow && (
        <div className="card space-y-3" style={{ borderColor: 'var(--gold-500)' }}>
          <div className="section-label">— receive {receiveRow.slipNo} ———</div>
          <div className="text-sm text-[var(--ink-500)]">
            Sent <span className="mono text-[var(--ink-950)]">{fmtGrams(receiveRow.sentWeightMg)}</span> of{' '}
            <CategoryBadge category={receiveRow.sentCategory} stamp={receiveRow.sentStamp || undefined} />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <label className="text-xs text-[var(--ink-500)]">Received category
              <select className="input w-full" value={recvForm.receivedCategory}
                      onChange={(e) => setRecvForm({ ...recvForm, receivedCategory: e.target.value as any })}>
                <option value="gold">gold</option>
                <option value="silver">silver</option>
              </select>
            </label>
            <label className="text-xs text-[var(--ink-500)]">Received stamp
              <input className="input w-full mono" value={recvForm.receivedStamp}
                     onChange={(e) => setRecvForm({ ...recvForm, receivedStamp: e.target.value })} />
            </label>
            <label className="text-xs text-[var(--ink-500)]">Received weight (g)
              <input type="number" step="0.001" className="input w-full mono" value={recvForm.receivedWeightG}
                     onChange={(e) => setRecvForm({ ...recvForm, receivedWeightG: Number(e.target.value) || 0 })} />
            </label>
            <div className="text-xs text-[var(--ink-500)] flex flex-col justify-end pb-1">
              Loss so far
              <div className="mono text-[var(--amber-500)] text-sm">
                {fmtGrams(receiveRow.sentWeightMg - gramsToMg(recvForm.receivedWeightG))}
                {recvForm.receivedWeightG > 0 && (
                  <span className="text-[10px] text-[var(--ink-500)] ml-1">
                    ({((1 - (gramsToMg(recvForm.receivedWeightG) / receiveRow.sentWeightMg)) * 100).toFixed(2)}%)
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="text-xs text-[var(--ink-500)]">Refining charges (₹)
              <input type="number" step="0.01" className="input w-full mono" value={recvForm.charges}
                     onChange={(e) => setRecvForm({ ...recvForm, charges: Number(e.target.value) || 0 })} />
            </label>
            <label className="text-xs text-[var(--ink-500)]">Paid cash now (₹)
              <input type="number" step="0.01" className="input w-full mono" value={recvForm.paidCash}
                     onChange={(e) => setRecvForm({ ...recvForm, paidCash: Number(e.target.value) || 0 })} />
            </label>
            <div className="text-xs text-[var(--ink-500)] flex flex-col justify-end pb-1">
              Charges balance
              <div className={`mono text-sm ${(recvForm.charges - recvForm.paidCash) > 0 ? 'text-[var(--rose-500)]' : ''}`}>
                {fmtPaise(rupeesToPaise(recvForm.charges - recvForm.paidCash))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <button className="btn-primary" onClick={submitReceive} disabled={receive.loading}>
              {receive.loading ? <Spinner label="posting" /> : 'Confirm receipt'}
            </button>
            <button className="btn" onClick={() => setReceiveRow(null)}>Cancel</button>
            {receive.error && <ErrorBanner message={receive.error} onDismiss={receive.clearError} />}
          </div>
        </div>
      )}

      {cancel.error && <ErrorBanner message={cancel.error} onDismiss={cancel.clearError} />}

      {list.loading ? <LoadingBlock label="loading lots…" /> : (
        <table className="ledger-table">
          <thead><tr>
            <th>Slip</th><th>Date</th><th>Refiner</th><th>Sent</th>
            <th>Received</th><th className="text-right">Loss</th>
            <th className="text-right">Charges</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {(list.data ?? []).map((l) => (
              <tr key={l.id}>
                <td className="mono">{l.slipNo}</td>
                <td className="mono text-[11px] text-[var(--ink-500)]">{fmtDate(l.ts)}</td>
                <td>{l.refinerName}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <CategoryBadge category={l.sentCategory} stamp={l.sentStamp || undefined} />
                    <span className="mono text-xs">{fmtGrams(l.sentWeightMg)}</span>
                  </div>
                </td>
                <td>
                  {l.status === 'received' ? (
                    <div className="flex items-center gap-2">
                      <CategoryBadge category={l.receivedCategory} stamp={l.receivedStamp || undefined} />
                      <span className="mono text-xs">{fmtGrams(l.receivedWeightMg)}</span>
                    </div>
                  ) : <span className="text-[var(--ink-300)]">—</span>}
                </td>
                <td className="num">
                  {l.status === 'received' ? (
                    <span className="text-[var(--amber-500)]">
                      {fmtGrams(l.lossMg)}
                      <span className="text-[10px] text-[var(--ink-500)] ml-1">
                        ({((l.lossMg / l.sentWeightMg) * 100).toFixed(2)}%)
                      </span>
                    </span>
                  ) : <span className="text-[var(--ink-300)]">—</span>}
                </td>
                <td className="num">{l.chargesPaise ? fmtPaise(l.chargesPaise) : <span className="text-[var(--ink-300)]">—</span>}</td>
                <td><StatusChip status={l.status} /></td>
                <td className="text-right">
                  {l.status === 'sent' && (
                    <div className="flex gap-2 justify-end">
                      <button className="link" onClick={() => openReceive(l)}>receive</button>
                      <span className="text-[var(--ink-300)]">·</span>
                      <button className="link text-danger" onClick={() => doCancel(l)}>cancel</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {(list.data?.length ?? 0) === 0 && <tr><td colSpan={9}>
              <EmptyState hint="Send scrap or impure metal to a refiner and record what comes back">no refining lots yet</EmptyState>
            </td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
