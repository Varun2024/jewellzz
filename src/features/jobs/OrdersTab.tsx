/* Orders — custom commission. Ported to v2 primitives. */

import { useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { rupeesToPaise } from '@/lib/format';
import type { Party, Karigar } from '@shared/ipc';
import { StatusChip, fmtDate } from './shared';
import {
  Sheet, Button, Field, Rupee, Progress, Empty,
} from '@/components/ui';
import { useHotkey } from '@/lib/useHotkey';

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
    if (!partyId)        return setErr('pick a party');
    if (!spec.trim())    return setErr('spec required');
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

  useHotkey('n', () => setShowForm(true), !showForm && !advRow);
  useHotkey('Escape', () => { setShowForm(false); setAdvRow(null); }, showForm || !!advRow);

  if (list.error) return <InlineAlert message={list.error} onDismiss={() => list.reload()} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--s3)',
        padding: 'var(--s3)',
        background: 'var(--surface-hi)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-1)',
      }}>
        <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
          Customer places an order → advance received → karigar assigned → ready → delivered. Advance writes cash ledger + party credit.
        </div>
        {!showForm && (
          <Button variant="primary" kbd="N" onClick={() => setShowForm(true)} leading={<Plus size={12} weight="bold" />}>
            New order
          </Button>
        )}
      </div>

      {showForm && (
        <Sheet title="New order slip">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--s3)', marginBottom: 'var(--s3)' }}>
            <div className="field">
              <label className="field__label">Party</label>
              <select className="input" value={partyId ?? ''} onChange={(e) => setPartyId(Number(e.target.value) || null)}>
                <option value="">— pick —</option>
                {(parties.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <Field label="Estimated total (₹)" numeric type="number" step="0.01" value={estimated}
                   onChange={(e) => setEstimated(Number(e.target.value) || 0)} />
            <Field label="Promised delivery" type="date" value={promised}
                   onChange={(e) => setPromised(e.target.value)} />
          </div>

          <div style={{ marginBottom: 'var(--s3)' }}>
            <Field
              label="Spec / description"
              required
              placeholder="e.g. 22k gold ring, 8g, size 7, floral engraving"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s3)', marginBottom: 'var(--s3)' }}>
            <div className="field">
              <label className="field__label">Assign karigar (optional)</label>
              <select className="input" value={karigarId ?? ''} onChange={(e) => setKarigarId(Number(e.target.value) || null)}>
                <option value="">— none —</option>
                {(karigars.data ?? []).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </div>
            <Field label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={submit} disabled={post.loading}>
              {post.loading ? 'Posting…' : 'Post order'}
            </Button>
            <Button onClick={() => setShowForm(false)}>Cancel</Button>
            {err && <InlineAlert message={err} onDismiss={() => setErr('')} />}
            {post.error && <InlineAlert message={post.error} onDismiss={post.clearError} />}
          </div>
        </Sheet>
      )}

      {statusMut.error && <InlineAlert message={statusMut.error} onDismiss={statusMut.clearError} />}
      {advance.error && <InlineAlert message={advance.error} onDismiss={advance.clearError} />}

      {advRow && (
        <Sheet title={`Advance for ${advRow.slipNo}`} style={{ borderColor: 'var(--accent)' }}>
          <div style={{ fontSize: 'var(--t-sm)', marginBottom: 'var(--s3)' }}>
            <div style={{ color: 'var(--text-mute)' }}>
              Estimated · <Rupee paise={advRow.estimatedPaise} />
            </div>
            <div style={{ color: 'var(--text-mute)' }}>
              Advance so far · <Rupee paise={advRow.advancePaise} />
            </div>
          </div>
          <div style={{ marginBottom: 'var(--s3)' }}>
            <Field
              label="Additional advance (₹)"
              autoFocus
              numeric type="number" step="0.01"
              value={advAmount}
              onChange={(e) => setAdvAmount(Number(e.target.value) || 0)}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--s2)' }}>
            <Button variant="primary" onClick={submitAdvance} disabled={advance.loading}>
              {advance.loading ? 'Posting…' : 'Receive advance'}
            </Button>
            <Button onClick={() => { setAdvRow(null); setAdvAmount(0); }}>Cancel</Button>
          </div>
        </Sheet>
      )}

      <Sheet title="Orders" flush>
        {list.loading ? <div style={{ padding: 12 }}><Progress /></div>
          : (list.data?.length ?? 0) === 0 ? <Empty mark="bell" title="No orders yet">Create one when a customer commissions a new piece.</Empty>
          : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Slip</th>
                  <th style={{ width: 90 }}>Date</th>
                  <th style={{ width: 140 }}>Party</th>
                  <th>Spec</th>
                  <th style={{ width: 110 }}>Karigar</th>
                  <th style={{ width: 100 }}>Promised</th>
                  <th className="num" style={{ width: 120 }}>Est.</th>
                  <th className="num" style={{ width: 120 }}>Adv.</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 220 }} />
                </tr>
              </thead>
              <tbody>
                {(list.data ?? []).map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)' }}>{o.slipNo}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-xs)', color: 'var(--text-mute)' }}>{fmtDate(o.ts)}</td>
                    <td>{o.partyName}</td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.spec}</td>
                    <td style={{ color: 'var(--text-mute)', fontSize: 'var(--t-sm)' }}>{o.karigarName ?? '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-xs)', color: 'var(--text-mute)' }}>{o.promisedDate || '—'}</td>
                    <td className="num"><Rupee paise={o.estimatedPaise} /></td>
                    <td className="num"><Rupee paise={o.advancePaise} /></td>
                    <td><StatusChip status={o.status} /></td>
                    <td className="num">
                      {o.status !== 'delivered' && o.status !== 'cancelled' && (
                        <div style={{ display: 'inline-flex', gap: 'var(--s2)' }}>
                          <Button variant="link" onClick={() => setAdvRow(o)}>advance</Button>
                          {o.status === 'open'        && <Button variant="link" onClick={() => moveStatus(o.id, 'in_progress')}>start</Button>}
                          {o.status === 'in_progress' && <Button variant="link" onClick={() => moveStatus(o.id, 'ready')}>ready</Button>}
                          {o.status === 'ready'       && <Button variant="link" onClick={() => moveStatus(o.id, 'delivered')}>delivered</Button>}
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
