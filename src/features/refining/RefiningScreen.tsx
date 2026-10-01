/* Refining — send impure metal to a refiner, receive purified back. Ported to v2 primitives. */

import { useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { gramsToMg, rupeesToPaise } from '@/lib/format';
import { CategoryBadge } from '@/components/CategoryBadge';
import type { Party } from '@shared/ipc';
import { StatusChip, fmtDate } from '@/features/jobs/shared';
import {
  Sheet, Button, Field, Rupee, Weight, Progress, Empty,
} from '@/components/ui';
import { useHotkey } from '@/lib/useHotkey';

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
    try { await cancel.run(lot.id); await list.reload(); } catch { /* surfaced */ }
  }

  useHotkey('n', () => setShowForm(true), !showForm && !receiveRow);
  useHotkey('Escape', () => { setShowForm(false); setReceiveRow(null); }, showForm || !!receiveRow);

  if (list.error) {
    return (
      <div className="ds-v2" style={{ padding: 'var(--container-pad)' }}>
        <InlineAlert message={list.error} onDismiss={() => list.reload()} />
      </div>
    );
  }

  return (
    <div className="ds-v2" style={{ padding: 'var(--container-pad)', height: '100%', overflow: 'auto', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--s3)',
          padding: 'var(--s3)',
          background: 'var(--surface-hi)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-1)',
        }}>
          <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
            Send impure / scrap metal to a refiner; receive purified metal back. Refining loss is expected and
            absorbed by the shop — the difference shows in the metal ledger as a real net cost.
          </div>
          {!showForm && (
            <Button variant="primary" kbd="N" onClick={() => setShowForm(true)} leading={<Plus size={12} weight="bold" />}>
              Send lot
            </Button>
          )}
        </div>

        {showForm && (
          <Sheet title="New refining lot">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--s3)', marginBottom: 'var(--s3)' }}>
              <div style={{ gridColumn: 'span 2' }} className="field">
                <label className="field__label">Refiner</label>
                <select
                  className="input"
                  value={sendForm.refinerPartyId ?? ''}
                  onChange={(e) => setSendForm({ ...sendForm, refinerPartyId: Number(e.target.value) || null })}
                >
                  <option value="">— pick supplier —</option>
                  {suppliers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field__label">Category</label>
                <select
                  className="input"
                  value={sendForm.sentCategory}
                  onChange={(e) => setSendForm({ ...sendForm, sentCategory: e.target.value as 'gold' | 'silver' })}
                >
                  <option value="gold">gold</option>
                  <option value="silver">silver</option>
                </select>
              </div>
              <Field label="Stamp / grade" placeholder="scrap / 22k / mixed" value={sendForm.sentStamp}
                     onChange={(e) => setSendForm({ ...sendForm, sentStamp: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--s3)', marginBottom: 'var(--s3)' }}>
              <Field
                label="Weight (g)"
                numeric type="number" step="0.001"
                value={sendForm.sentWeightG}
                onChange={(e) => setSendForm({ ...sendForm, sentWeightG: Number(e.target.value) || 0 })}
              />
              <div style={{ gridColumn: 'span 3' }}>
                <Field label="Notes" value={sendForm.notes}
                       onChange={(e) => setSendForm({ ...sendForm, notes: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center', flexWrap: 'wrap' }}>
              <Button variant="primary" onClick={submitSend} disabled={send.loading}>
                {send.loading ? 'Posting…' : 'Post send slip'}
              </Button>
              <Button onClick={() => setShowForm(false)}>Cancel</Button>
              {err && <InlineAlert message={err} onDismiss={() => setErr('')} />}
              {send.error && <InlineAlert message={send.error} onDismiss={send.clearError} />}
            </div>
          </Sheet>
        )}

        {receiveRow && (
          <Sheet title={`Receive ${receiveRow.slipNo}`} style={{ borderColor: 'var(--accent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)', fontSize: 'var(--t-sm)', marginBottom: 'var(--s3)', color: 'var(--text-mute)' }}>
              Sent · <Weight mg={receiveRow.sentWeightMg} /> of{' '}
              <CategoryBadge category={receiveRow.sentCategory} stamp={receiveRow.sentStamp || undefined} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--s3)', marginBottom: 'var(--s3)' }}>
              <div className="field">
                <label className="field__label">Received category</label>
                <select
                  className="input"
                  value={recvForm.receivedCategory}
                  onChange={(e) => setRecvForm({ ...recvForm, receivedCategory: e.target.value as 'gold' | 'silver' })}
                >
                  <option value="gold">gold</option>
                  <option value="silver">silver</option>
                </select>
              </div>
              <Field label="Received stamp" value={recvForm.receivedStamp}
                     onChange={(e) => setRecvForm({ ...recvForm, receivedStamp: e.target.value })} />
              <Field
                label="Received weight (g)"
                numeric type="number" step="0.001"
                value={recvForm.receivedWeightG}
                onChange={(e) => setRecvForm({ ...recvForm, receivedWeightG: Number(e.target.value) || 0 })}
              />
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 2 }}>
                <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Loss so far
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-press)', fontSize: 'var(--t-md)' }}>
                  <Weight mg={receiveRow.sentWeightMg - gramsToMg(recvForm.receivedWeightG)} />
                  {recvForm.receivedWeightG > 0 && (
                    <span style={{ fontSize: 'var(--t-xs)', color: 'var(--text-mute)', marginLeft: 4 }}>
                      ({((1 - (gramsToMg(recvForm.receivedWeightG) / receiveRow.sentWeightMg)) * 100).toFixed(2)}%)
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--s3)', marginBottom: 'var(--s3)' }}>
              <Field label="Refining charges (₹)" numeric type="number" step="0.01" value={recvForm.charges}
                     onChange={(e) => setRecvForm({ ...recvForm, charges: Number(e.target.value) || 0 })} />
              <Field label="Paid cash now (₹)" numeric type="number" step="0.01" value={recvForm.paidCash}
                     onChange={(e) => setRecvForm({ ...recvForm, paidCash: Number(e.target.value) || 0 })} />
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 2 }}>
                <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Charges balance
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--t-md)',
                  color: (recvForm.charges - recvForm.paidCash) > 0 ? 'var(--neg)' : undefined,
                }}>
                  <Rupee paise={rupeesToPaise(recvForm.charges - recvForm.paidCash)} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
              <Button variant="primary" onClick={submitReceive} disabled={receive.loading}>
                {receive.loading ? 'Posting…' : 'Confirm receipt'}
              </Button>
              <Button onClick={() => setReceiveRow(null)}>Cancel</Button>
              {receive.error && <InlineAlert message={receive.error} onDismiss={receive.clearError} />}
            </div>
          </Sheet>
        )}

        {cancel.error && <InlineAlert message={cancel.error} onDismiss={cancel.clearError} />}

        <Sheet title="Refining lots" flush>
          {list.loading ? <div style={{ padding: 12 }}><Progress /></div>
            : (list.data?.length ?? 0) === 0 ? <Empty mark="scale" title="No refining lots yet">Send scrap or impure metal to a refiner and record what comes back.</Empty>
            : (
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>Slip</th>
                    <th style={{ width: 90 }}>Date</th>
                    <th>Refiner</th>
                    <th>Sent</th>
                    <th>Received</th>
                    <th className="num" style={{ width: 110 }}>Loss</th>
                    <th className="num" style={{ width: 130 }}>Charges</th>
                    <th style={{ width: 110 }}>Status</th>
                    <th style={{ width: 160 }} />
                  </tr>
                </thead>
                <tbody>
                  {(list.data ?? []).map((l) => (
                    <tr key={l.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)' }}>{l.slipNo}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-xs)', color: 'var(--text-mute)' }}>{fmtDate(l.ts)}</td>
                      <td>{l.refinerName}</td>
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <CategoryBadge category={l.sentCategory} stamp={l.sentStamp || undefined} />
                          <Weight mg={l.sentWeightMg} />
                        </div>
                      </td>
                      <td>
                        {l.status === 'received' ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <CategoryBadge category={l.receivedCategory} stamp={l.receivedStamp || undefined} />
                            <Weight mg={l.receivedWeightMg} />
                          </div>
                        ) : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                      </td>
                      <td className="num">
                        {l.status === 'received' ? (
                          <span style={{ color: 'var(--accent-press)' }}>
                            <Weight mg={l.lossMg} />
                            <span style={{ fontSize: 'var(--t-xs)', color: 'var(--text-mute)', marginLeft: 4 }}>
                              ({((l.lossMg / l.sentWeightMg) * 100).toFixed(2)}%)
                            </span>
                          </span>
                        ) : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                      </td>
                      <td className="num">
                        {l.chargesPaise ? <Rupee paise={l.chargesPaise} /> : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                      </td>
                      <td><StatusChip status={l.status} /></td>
                      <td className="num">
                        {l.status === 'sent' && (
                          <div style={{ display: 'inline-flex', gap: 'var(--s2)', justifyContent: 'flex-end' }}>
                            <Button variant="link" onClick={() => openReceive(l)}>receive</Button>
                            <Button variant="link" onClick={() => doCancel(l)} style={{ color: 'var(--neg)' }}>cancel</Button>
                          </div>
                        )}
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

function InlineAlert({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="alert">
      <span style={{ whiteSpace: 'pre-wrap' }}>{message}</span>
      {onDismiss && <button className="alert__dismiss" onClick={onDismiss} aria-label="dismiss">×</button>}
    </div>
  );
}
