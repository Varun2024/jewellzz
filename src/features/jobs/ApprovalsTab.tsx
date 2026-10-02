/* Approvals — items leave the shop on approval. Ported to v2 primitives. */

import { useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { gramsToMg, caratToMg } from '@/lib/format';
import type { Item, Party } from '@shared/ipc';
import { StatusChip, fmtDate } from './shared';
import {
  Sheet, Button, Field, Weight, Num, Progress, Empty,
} from '@/components/ui';
import { useHotkey } from '@/lib/useHotkey';

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
    if (!partyId)           return setErr('pick a party');
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
    try { await resolve.run({ id, status }); await list.reload(); } catch { /* surfaced */ }
  }

  useHotkey('n', () => setShowForm(true), !showForm);
  useHotkey('Escape', () => setShowForm(false), showForm);

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
          Goods leave shop on approval — stock decremented. Later mark <b>sold</b> (stock stays out), <b>returned</b> (stock restored), or <b>cancelled</b>.
        </div>
        {!showForm && (
          <Button variant="primary" kbd="N" onClick={() => setShowForm(true)} leading={<Plus size={12} weight="bold" />}>
            New approval
          </Button>
        )}
      </div>

      {showForm && (
        <Sheet title="New approval slip">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--s3)', marginBottom: 'var(--s3)' }}>
            <div className="field">
              <label className="field__label">Party</label>
              <select
                className="input"
                value={partyId ?? ''}
                onChange={(e) => setPartyId(Number(e.target.value) || null)}
              >
                <option value="">— pick —</option>
                {(parties.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <Field label="Promised return" type="date" value={promised}
                   onChange={(e) => setPromised(e.target.value)} />
            <Field label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'flex-end', marginBottom: 'var(--s3)' }}>
            <div style={{ flex: 1 }} className="field">
              <label className="field__label">Add item</label>
              <select
                className="input"
                value={pickId}
                onChange={(e) => setPickId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">— pick item —</option>
                {(items.data ?? []).map((i) => (
                  <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>
                ))}
              </select>
            </div>
            <Button onClick={addLine} type="button" disabled={!pickId}>Add line</Button>
          </div>

          <table className="table" style={{ marginBottom: 'var(--s3)' }}>
            <thead>
              <tr>
                <th>Item</th>
                <th className="num" style={{ width: 56 }}>Qty</th>
                <th className="num" style={{ width: 90 }}>Weight</th>
                <th style={{ width: 60 }}>Unit</th>
                <th>Note</th>
                <th style={{ width: 28 }} />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key}>
                  <td>{l.itemName}</td>
                  <td className="num">
                    <input
                      className="input input--num"
                      style={{ width: 48, height: 24 }}
                      type="number"
                      value={l.qty}
                      onChange={(e) => upd(l.key, { qty: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="num">
                    {l.unit === 'pcs'
                      ? <span style={{ color: 'var(--text-faint)' }}>—</span>
                      : <input
                          className="input input--num"
                          style={{ width: 80, height: 24 }}
                          type="number" step="0.001"
                          value={l.weight}
                          onChange={(e) => upd(l.key, { weight: Number(e.target.value) || 0 })}
                        />}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', color: 'var(--text-mute)' }}>{l.unit}</td>
                  <td>
                    <input
                      className="input"
                      style={{ height: 24 }}
                      value={l.note}
                      onChange={(e) => upd(l.key, { note: e.target.value })}
                    />
                  </td>
                  <td className="num">
                    <button
                      onClick={() => del(l.key)}
                      aria-label="remove"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-faint)', fontSize: 16, lineHeight: 1,
                      }}
                    >×</button>
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 'var(--s4)' }}><Empty title="No lines yet" /></td></tr>
              )}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={submit} disabled={post.loading}>
              {post.loading ? 'Posting…' : 'Post approval'}
            </Button>
            <Button onClick={() => { setShowForm(false); setLines([]); setPartyId(null); setNotes(''); setPromised(''); }}>
              Cancel
            </Button>
            {err && <InlineAlert message={err} onDismiss={() => setErr('')} />}
            {post.error && <InlineAlert message={post.error} onDismiss={post.clearError} />}
          </div>
        </Sheet>
      )}

      {resolve.error && <InlineAlert message={resolve.error} onDismiss={resolve.clearError} />}

      <Sheet title="Approvals" flush>
        {list.loading ? <div style={{ padding: 12 }}><Progress /></div>
          : (list.data?.length ?? 0) === 0 ? <Empty mark="bell" title="No approvals yet">Create one when a customer takes items home to consider.</Empty>
          : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Slip</th>
                  <th style={{ width: 100 }}>Date</th>
                  <th>Party</th>
                  <th style={{ width: 100 }}>Promised</th>
                  <th className="num" style={{ width: 60 }}>Items</th>
                  <th className="num" style={{ width: 100 }}>Weight</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 180 }} />
                </tr>
              </thead>
              <tbody>
                {(list.data ?? []).map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)' }}>{a.slipNo}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-xs)', color: 'var(--text-mute)' }}>{fmtDate(a.ts)}</td>
                    <td>{a.partyName}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-xs)', color: 'var(--text-mute)' }}>{a.promisedReturnDate || '—'}</td>
                    <td className="num"><Num value={a.totalQty ?? 0} /></td>
                    <td className="num"><Weight mg={a.totalMg ?? 0} /></td>
                    <td><StatusChip status={a.status} /></td>
                    <td className="num">
                      {a.status === 'open' && (
                        <div style={{ display: 'inline-flex', gap: 'var(--s2)' }}>
                          <Button variant="link" onClick={() => resolveTo(a.id, 'sold')}>sold</Button>
                          <Button variant="link" onClick={() => resolveTo(a.id, 'returned')}>returned</Button>
                          <Button variant="link" onClick={() => resolveTo(a.id, 'cancelled')} style={{ color: 'var(--neg)' }}>cancel</Button>
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
