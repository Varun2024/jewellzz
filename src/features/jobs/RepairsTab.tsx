/* Repairs — customer brings item for work. Ported to v2 primitives. */

import { useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { gramsToMg, rupeesToPaise } from '@/lib/format';
import type { Party, Karigar } from '@shared/ipc';
import { StatusChip, fmtDate } from './shared';
import {
  Sheet, Button, Field, Rupee, Progress, Empty,
} from '@/components/ui';
import { useHotkey } from '@/lib/useHotkey';

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
    if (!partyId)              return setErr('pick a party');
    if (!description.trim())   return setErr('description required');
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

  useHotkey('n', () => setShowForm(true), !showForm && !deliverRow);
  useHotkey('Escape', () => { setShowForm(false); setDeliverRow(null); }, showForm || !!deliverRow);

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
          Customer's item comes in → assign karigar → mark ready → deliver &amp; charge. Shop stock is not affected.
        </div>
        {!showForm && (
          <Button variant="primary" kbd="N" onClick={() => setShowForm(true)} leading={<Plus size={12} weight="bold" />}>
            New repair
          </Button>
        )}
      </div>

      {showForm && (
        <Sheet title="New repair slip">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--s3)', marginBottom: 'var(--s3)' }}>
            <div className="field">
              <label className="field__label">Party</label>
              <select className="input" value={partyId ?? ''} onChange={(e) => setPartyId(Number(e.target.value) || null)}>
                <option value="">— pick —</option>
                {(parties.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field__label">Assign karigar (optional)</label>
              <select className="input" value={karigarId ?? ''} onChange={(e) => setKarigarId(Number(e.target.value) || null)}>
                <option value="">— none —</option>
                {(karigars.data ?? []).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </div>
            <Field label="Promised delivery" type="date" value={promised} onChange={(e) => setPromised(e.target.value)} />
          </div>

          <div style={{ marginBottom: 'var(--s3)' }}>
            <Field
              label="Description"
              required
              placeholder="e.g. 22k gold chain, clasp broken"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <SectionLabel>Customer material (optional)</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--s3)', marginBottom: 'var(--s3)' }}>
            <div className="field">
              <label className="field__label">Category</label>
              <select className="input" value={material.cat} onChange={(e) => setMaterial({ ...material, cat: e.target.value })}>
                <option value="">— none —</option>
                {CAT.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Field label="Stamp" value={material.stamp}
                   onChange={(e) => setMaterial({ ...material, stamp: e.target.value })} />
            <Field label="Weight (g)" numeric type="number" step="0.001" value={material.weightG}
                   onChange={(e) => setMaterial({ ...material, weightG: Number(e.target.value) || 0 })} />
          </div>

          <SectionLabel>Charges</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--s3)', marginBottom: 'var(--s3)' }}>
            <Field label="Addition (₹)" numeric type="number" step="0.01" value={addition}
                   onChange={(e) => setAddition(Number(e.target.value) || 0)} />
            <Field label="Labour (₹)" numeric type="number" step="0.01" value={labour}
                   onChange={(e) => setLabour(Number(e.target.value) || 0)} />
            <Field label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={submit} disabled={post.loading}>
              {post.loading ? 'Posting…' : 'Post repair'}
            </Button>
            <Button onClick={() => setShowForm(false)}>Cancel</Button>
            {err && <InlineAlert message={err} onDismiss={() => setErr('')} />}
            {post.error && <InlineAlert message={post.error} onDismiss={post.clearError} />}
          </div>
        </Sheet>
      )}

      {statusMut.error && <InlineAlert message={statusMut.error} onDismiss={statusMut.clearError} />}
      {deliverMut.error && <InlineAlert message={deliverMut.error} onDismiss={deliverMut.clearError} />}

      {deliverRow && (
        <Sheet
          title={`Deliver ${deliverRow.slipNo}`}
          style={{ borderColor: 'var(--accent)' }}
        >
          <div style={{ fontSize: 'var(--t-sm)', marginBottom: 'var(--s3)' }}>
            <div style={{ fontWeight: 500 }}>{deliverRow.description}</div>
            <div style={{ color: 'var(--text-mute)' }}>
              Total due · <Rupee paise={deliverRow.totalPaise} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s3)', marginBottom: 'var(--s3)' }}>
            <Field label="Cash (₹)" numeric type="number" step="0.01" value={payCash}
                   onChange={(e) => setPayCash(Number(e.target.value) || 0)} />
            <Field label="Bank (₹)" numeric type="number" step="0.01" value={payBank}
                   onChange={(e) => setPayBank(Number(e.target.value) || 0)} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--s2)' }}>
            <Button variant="primary" onClick={doDeliver} disabled={deliverMut.loading}>
              {deliverMut.loading ? 'Delivering…' : 'Confirm delivery'}
            </Button>
            <Button onClick={() => setDeliverRow(null)}>Cancel</Button>
          </div>
        </Sheet>
      )}

      <Sheet title="Repairs" flush>
        {list.loading ? <div style={{ padding: 12 }}><Progress /></div>
          : (list.data?.length ?? 0) === 0 ? <Empty mark="bell" title="No repairs yet">Create one when a customer brings an item in for work.</Empty>
          : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Slip</th>
                  <th style={{ width: 90 }}>Date</th>
                  <th style={{ width: 140 }}>Party</th>
                  <th>Description</th>
                  <th style={{ width: 110 }}>Karigar</th>
                  <th style={{ width: 100 }}>Promised</th>
                  <th className="num" style={{ width: 130 }}>Total</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {(list.data ?? []).map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)' }}>{r.slipNo}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-xs)', color: 'var(--text-mute)' }}>{fmtDate(r.ts)}</td>
                    <td>{r.partyName}</td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</td>
                    <td style={{ color: 'var(--text-mute)', fontSize: 'var(--t-sm)' }}>{r.karigarName ?? '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-xs)', color: 'var(--text-mute)' }}>{r.promisedDate || '—'}</td>
                    <td className="num"><Rupee paise={r.totalPaise} /></td>
                    <td><StatusChip status={r.status} /></td>
                    <td className="num">
                      {r.status === 'received'    && <Button variant="link" onClick={() => moveStatus(r.id, 'in_progress')}>start</Button>}
                      {r.status === 'in_progress' && <Button variant="link" onClick={() => moveStatus(r.id, 'ready')}>ready</Button>}
                      {r.status === 'ready'       && <Button variant="link" onClick={() => { setDeliverRow(r); setPayCash(r.totalPaise / 100); setPayBank(0); }}>deliver</Button>}
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 'var(--t-sm)', color: 'var(--text-mute)',
      textTransform: 'uppercase', letterSpacing: '0.04em',
      marginBottom: 'var(--s2)',
    }}>{children}</div>
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
