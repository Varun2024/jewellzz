/* Receive slip — ported to v2 primitives. */

import { useEffect, useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { gramsToMg, caratToMg, rupeesToPaise } from '@/lib/format';
import type { Karigar, Item } from '@shared/ipc';
import {
  Sheet, Button, Field, Rupee, Weight, Pill, Progress, Empty,
} from '@/components/ui';

type Cat = 'gold' | 'silver' | 'stone' | 'artificial';
type Line = {
  key: string;
  itemId: number | null;
  category: Cat;
  stamp: string;
  qty: number;
  weight: number;
  wastage: number;
  unit: 'g' | 'ct';
  note: string;
};
const CATEGORIES: Cat[] = ['gold', 'silver', 'stone', 'artificial'];

export function ReceiveTab() {
  const karigars = useAsync<Karigar[]>(() => invoke(CH.karigarsList));
  const items = useAsync<Item[]>(() => invoke(CH.itemsList));
  const receipts = useAsync<any[]>(() => invoke(CH.karigarReceiptsList, {}));

  const [karigarId, setKarigarId] = useState<number | null>(null);
  const [openIssues, setOpenIssues] = useState<any[]>([]);
  const [relatedIssueId, setRelatedIssueId] = useState<number | null>(null);
  const [labour, setLabour] = useState(0);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const post = useMutation<any, { id: number; slipNo: string }>((p) => invoke(CH.karigarReceiptPost, p));
  const pay = useMutation<any, { id: number }>((p) => invoke(CH.karigarPay, p));

  useEffect(() => {
    if (!karigarId) { setOpenIssues([]); return; }
    invoke<any[]>(CH.karigarIssuesList, { karigarId }).then(setOpenIssues).catch(() => setOpenIssues([]));
  }, [karigarId]);

  function addLine() {
    setLines((ls) => [...ls, {
      key: `${Date.now()}-${ls.length}`,
      itemId: null, category: 'gold', stamp: '22k',
      qty: 0, weight: 0, wastage: 0, unit: 'g', note: '',
    }]);
  }
  function upd(k: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => l.key === k ? { ...l, ...patch } : l));
  }
  function del(k: string) { setLines((ls) => ls.filter((l) => l.key !== k)); }

  async function submit() {
    setErr(''); setOk(''); post.clearError();
    if (!karigarId)         return setErr('pick a karigar');
    if (lines.length === 0) return setErr('add at least one line');
    try {
      const payload = {
        karigarId,
        relatedIssueId: relatedIssueId ?? null,
        labourPaise: rupeesToPaise(labour),
        notes,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          category: l.category,
          stamp: l.category === 'gold' || l.category === 'silver' ? l.stamp : '',
          qty: Math.round(l.qty),
          weightMg:  l.unit === 'ct' ? caratToMg(l.weight)  : gramsToMg(l.weight),
          wastageMg: l.unit === 'ct' ? caratToMg(l.wastage) : gramsToMg(l.wastage),
          note: l.note,
        })),
      };
      const r = await post.run(payload);
      setLines([]); setLabour(0); setNotes(''); setRelatedIssueId(null);
      await Promise.all([receipts.reload(), items.reload()]);
      setOk(`received ${r.slipNo}`);
    } catch { /* surfaced */ }
  }

  async function payNow(amount: number) {
    if (!karigarId) return;
    try {
      await pay.run({ karigarId, amountPaise: rupeesToPaise(amount), note: 'labour payment' });
      setOk('paid');
    } catch { /* surfaced */ }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s4)' }}>

      <Sheet title="New receipt slip">
        {karigars.error && <InlineAlert message={karigars.error} onDismiss={() => karigars.reload()} />}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s3)', marginBottom: 'var(--s3)' }}>
          <div className="field">
            <label className="field__label">Karigar</label>
            <select
              className="input"
              value={karigarId ?? ''}
              onChange={(e) => setKarigarId(Number(e.target.value) || null)}
              disabled={karigars.loading}
            >
              <option value="">{karigars.loading ? 'loading…' : '— pick —'}</option>
              {(karigars.data ?? []).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field__label">Related issue (optional)</label>
            <select
              className="input"
              value={relatedIssueId ?? ''}
              onChange={(e) => setRelatedIssueId(Number(e.target.value) || null)}
              disabled={!karigarId}
            >
              <option value="">— none —</option>
              {openIssues.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.slipNo} · {((i.totalMg ?? 0) / 1000).toFixed(3)} g
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--s2)' }}>
          <div style={{
            fontSize: 'var(--t-sm)', color: 'var(--text-mute)',
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>Received lines</div>
          <Button type="button" onClick={addLine}>+ add line</Button>
        </div>

        <table className="table" style={{ marginBottom: 'var(--s3)' }}>
          <thead>
            <tr>
              <th>Item (opt)</th>
              <th style={{ width: 90 }}>Cat</th>
              <th style={{ width: 70 }}>Stamp</th>
              <th className="num" style={{ width: 56 }}>Qty</th>
              <th className="num" style={{ width: 90 }}>Weight</th>
              <th className="num" style={{ width: 90 }}>Wastage</th>
              <th style={{ width: 54 }}>Unit</th>
              <th style={{ width: 28 }} />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key}>
                <td>
                  <select
                    className="input"
                    style={{ height: 24, fontSize: 'var(--t-sm)' }}
                    value={l.itemId ?? ''}
                    onChange={(e) => {
                      const id = Number(e.target.value) || null;
                      const it = items.data?.find((x) => x.id === id);
                      upd(l.key, {
                        itemId: id,
                        category: it?.category ?? l.category,
                        stamp: it?.stamp ?? l.stamp,
                        unit: it?.unit === 'carat' ? 'ct' : 'g',
                      });
                    }}
                  >
                    <option value="">— none —</option>
                    {(items.data ?? []).map((i) => (
                      <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="input"
                    style={{ height: 24, fontSize: 'var(--t-sm)' }}
                    value={l.category}
                    onChange={(e) => upd(l.key, { category: e.target.value as Cat })}
                    disabled={!!l.itemId}
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    className="input"
                    style={{ height: 24, width: 56, fontFamily: 'var(--font-mono)' }}
                    value={l.stamp}
                    onChange={(e) => upd(l.key, { stamp: e.target.value })}
                    disabled={l.category !== 'gold' && l.category !== 'silver'}
                  />
                </td>
                <td className="num">
                  <input
                    className="input input--num"
                    style={{ width: 46, height: 24 }}
                    type="number"
                    value={l.qty}
                    onChange={(e) => upd(l.key, { qty: Number(e.target.value) || 0 })}
                  />
                </td>
                <td className="num">
                  <input
                    className="input input--num"
                    style={{ width: 80, height: 24 }}
                    type="number" step="0.001"
                    value={l.weight}
                    onChange={(e) => upd(l.key, { weight: Number(e.target.value) || 0 })}
                  />
                </td>
                <td className="num">
                  <input
                    className="input input--num"
                    style={{ width: 80, height: 24 }}
                    type="number" step="0.001"
                    value={l.wastage}
                    onChange={(e) => upd(l.key, { wastage: Number(e.target.value) || 0 })}
                  />
                </td>
                <td>
                  <select
                    className="input"
                    style={{ height: 24, width: 44, fontSize: 'var(--t-sm)' }}
                    value={l.unit}
                    onChange={(e) => upd(l.key, { unit: e.target.value as 'g' | 'ct' })}
                  >
                    <option value="g">g</option><option value="ct">ct</option>
                  </select>
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
              <tr><td colSpan={8} style={{ padding: 'var(--s4)' }}><Empty title="No lines — add one" /></td></tr>
            )}
          </tbody>
        </table>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s3)' }}>
          <Field
            label="Labour claim ₹"
            numeric type="number" step="0.01"
            value={labour}
            onChange={(e) => setLabour(Number(e.target.value) || 0)}
          />
          <Field label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center', flexWrap: 'wrap', marginTop: 'var(--s3)' }}>
          <Button variant="primary" onClick={submit} disabled={post.loading}>
            {post.loading ? 'Posting…' : 'Post receipt slip'}
          </Button>
          <Button onClick={() => payNow(labour)} disabled={pay.loading || !karigarId || labour <= 0}>
            {pay.loading ? 'Paying…' : `Pay ₹${labour.toFixed(2)} now`}
          </Button>
          {err && <InlineAlert message={err} onDismiss={() => setErr('')} />}
          {post.error && <InlineAlert message={post.error} onDismiss={post.clearError} />}
          {pay.error && <InlineAlert message={pay.error} onDismiss={pay.clearError} />}
          {ok && !err && !post.error && !pay.error && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Pill tone="pos">{ok}</Pill>
            </span>
          )}
        </div>
      </Sheet>

      <Sheet title="Recent receipts" flush>
        {receipts.error && <div style={{ padding: 12 }}><InlineAlert message={receipts.error} onDismiss={() => receipts.reload()} /></div>}
        {receipts.loading ? <div style={{ padding: 12 }}><Progress /></div>
          : (receipts.data?.length ?? 0) === 0 ? <Empty mark="ledger" title="No receipts yet" />
          : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Slip</th>
                  <th style={{ width: 150 }}>When</th>
                  <th>Karigar</th>
                  <th className="num" style={{ width: 100 }}>Received</th>
                  <th className="num" style={{ width: 100 }}>Wastage</th>
                  <th className="num" style={{ width: 120 }}>Labour</th>
                </tr>
              </thead>
              <tbody>
                {(receipts.data ?? []).map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)' }}>{r.slipNo}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
                      {new Date(r.ts * 1000).toLocaleString('en-IN')}
                    </td>
                    <td>{r.karigarName}</td>
                    <td className="num"><Weight mg={r.totalReceivedMg ?? 0} /></td>
                    <td className="num"><Weight mg={r.totalWastageMg ?? 0} /></td>
                    <td className="num"><Rupee paise={r.labourPaise} /></td>
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
