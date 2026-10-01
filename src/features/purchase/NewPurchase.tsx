/* New purchase form — extracted from the previous single-screen PurchaseScreen
 * so it can live alongside the register under a tab wrapper.
 */

import { useEffect, useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useMutation, errText } from '@/lib/useAsync';
import { gramsToMg, caratToMg, rupeesToPaise } from '@/lib/format';
import type { Item, Party, PurchaseLineInput, MetalRate } from '@shared/ipc';
import {
  Sheet, Button, Field, Rupee, Pill, Progress, toast,
} from '@/components/ui';

type RateMap = Record<string, number>;

function rateFor(rates: RateMap, it: Item): number {
  if (!it.stamp) return 0;
  const perG = rates[`${it.category}|${it.stamp}`];
  if (!perG) return 0;
  if (it.unit === 'gms') return perG;
  if (it.unit === 'carat') return perG * 0.2;
  return 0;
}

type Line = {
  key: string;
  itemId: number;
  description: string;
  category: Item['category'];
  unit: Item['unit'];
  stamp: string | null;
  hsn: string;
  qty: number;
  weight: number;
  ratePerUnit: number;
  gstPct: number;
};

export function NewPurchase({ onViewRegister }: { onViewRegister?: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [rates, setRates] = useState<RateMap>({});
  const [partyId, setPartyId] = useState<number | null>(null);
  const [refNo, setRefNo] = useState('');
  const [paidCash, setPaidCash] = useState(0);
  const [paidBank, setPaidBank] = useState(0);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [pickItemId, setPickItemId] = useState<number | ''>('');
  const [bootLoading, setBootLoading] = useState(true);
  const [bootErr, setBootErr] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [posted, setPosted] = useState<{ refNo: string; totalPaise: number; balancePaise: number } | null>(null);
  const postMut = useMutation<any, any>((p) => invoke(CH.purchasePost, p));

  useEffect(() => {
    (async () => {
      try {
        const [its, ps, rs] = await Promise.all([
          invoke<Item[]>(CH.itemsList),
          invoke<Party[]>(CH.partiesList),
          invoke<MetalRate[]>(CH.ratesList),
        ]);
        setItems(its);
        setParties(ps.filter((p) => p.role === 'supplier' || p.role === 'both'));
        const rateMap: RateMap = {};
        for (const r of rs) rateMap[`${r.category}|${r.stamp}`] = r.ratePaisePerG / 100;
        setRates(rateMap);
      } catch (e) {
        setBootErr(errText(e));
      } finally {
        setBootLoading(false);
      }
    })();
  }, []);

  function addLine() {
    if (!pickItemId) return;
    const it = items.find((i) => i.id === Number(pickItemId));
    if (!it) return;
    setLines((ls) => [...ls, {
      key: `${it.id}-${Date.now()}`,
      itemId: it.id, description: it.name, category: it.category, unit: it.unit,
      stamp: it.stamp, hsn: it.hsn,
      qty: it.unit === 'pcs' ? 1 : 0, weight: 0, ratePerUnit: rateFor(rates, it), gstPct: it.gstBp / 100,
    }]);
    setPickItemId('');
  }

  function upd(k: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...patch } : l)));
  }

  function toInputs(): PurchaseLineInput[] {
    return lines.map((l) => ({
      itemId: l.itemId,
      description: l.description,
      category: l.category,
      unit: l.unit,
      stamp: l.stamp,
      hsn: l.hsn,
      qty: Math.round(l.qty),
      weightMg: l.unit === 'gms' ? gramsToMg(l.weight) : l.unit === 'carat' ? caratToMg(l.weight) : 0,
      ratePaise: rupeesToPaise(l.ratePerUnit),
      gstBp: Math.round(l.gstPct * 100),
    }));
  }

  async function post() {
    setErr(''); setPosted(null); postMut.clearError();
    if (!partyId)        return setErr('supplier required');
    if (!refNo.trim())   return setErr('supplier ref no required');
    if (lines.length === 0) return setErr('at least one line');
    try {
      const res = await postMut.run({
        partyId, refNo, notes,
        paidCashPaise: rupeesToPaise(paidCash),
        paidBankPaise: rupeesToPaise(paidBank),
        lines: toInputs(),
      });
      setPosted({ refNo: res.refNo, totalPaise: res.totalPaise, balancePaise: res.balancePaise });
      toast.success(`Purchase ${res.refNo} posted`, onViewRegister
        ? { action: { label: 'view register', onClick: onViewRegister } }
        : undefined);
      setLines([]); setRefNo(''); setPaidCash(0); setPaidBank(0); setNotes('');
    } catch { /* surfaced */ }
  }

  if (bootLoading) {
    return (
      <div>
        <Progress />
        <div style={{
          marginTop: 8, fontSize: 'var(--t-sm)',
          color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>opening the purchase book…</div>
      </div>
    );
  }
  if (bootErr) return <InlineAlert message={bootErr} onDismiss={() => window.location.reload()} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--s3)' }}>
        <SupplierField parties={parties} value={partyId} onChange={setPartyId} />
        <Field label="Supplier ref #" value={refNo}
               onChange={(e) => setRefNo(e.target.value)} placeholder="e.g. INV-884/26" />
        <Field label="Notes" value={notes}
               onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
      </div>

      <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <ItemPickField items={items} value={pickItemId} onChange={setPickItemId} />
        </div>
        <Button variant="primary" onClick={addLine} kbd="↵" disabled={!pickItemId}>Add line</Button>
      </div>

      <Sheet flush>
        {lines.length === 0 ? (
          <div style={{
            padding: 'var(--s8) var(--s4)',
            textAlign: 'center',
            color: 'var(--text-mute)',
            fontSize: 'var(--t-sm)',
          }}>
            No lines yet — pick an item above.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="num" style={{ width: 60 }}>Qty</th>
                <th className="num" style={{ width: 92 }}>Weight</th>
                <th className="num" style={{ width: 108 }}>Rate</th>
                <th className="num" style={{ width: 80 }}>GST %</th>
                <th style={{ width: 28 }} />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key} className="row-enter">
                  <td>
                    <div>{l.description}</div>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--t-xs)',
                      color: 'var(--text-mute)',
                    }}>
                      {l.category}{l.stamp ? ` · ${l.stamp}` : ''} · {l.unit}
                    </div>
                  </td>
                  <td className="num">
                    <input
                      className="input input--num"
                      style={{ width: 48, height: 24 }}
                      type="number" step="1"
                      value={l.qty}
                      onChange={(e) => upd(l.key, { qty: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="num">
                    {l.unit === 'pcs'
                      ? <span style={{ color: 'var(--text-faint)' }}>—</span>
                      : <input
                          className="input input--num"
                          style={{ width: 76, height: 24 }}
                          type="number" step="0.001"
                          value={l.weight}
                          onChange={(e) => upd(l.key, { weight: Number(e.target.value) || 0 })}
                        />}
                  </td>
                  <td className="num">
                    <input
                      className="input input--num"
                      style={{ width: 92, height: 24 }}
                      type="number" step="0.01"
                      value={l.ratePerUnit}
                      onChange={(e) => upd(l.key, { ratePerUnit: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="num">
                    <input
                      className="input input--num"
                      style={{ width: 64, height: 24 }}
                      type="number" step="0.01"
                      value={l.gstPct}
                      onChange={(e) => upd(l.key, { gstPct: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="num">
                    <button
                      onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                      aria-label="remove line"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-faint)',
                        fontSize: 16, lineHeight: 1,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--neg)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-faint)')}
                    >×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Sheet>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 'var(--s3)', alignItems: 'end' }}>
        <Field label="Paid cash" numeric type="number" step="0.01"
               value={paidCash} onChange={(e) => setPaidCash(Number(e.target.value) || 0)} hint="₹" />
        <Field label="Paid bank" numeric type="number" step="0.01"
               value={paidBank} onChange={(e) => setPaidBank(Number(e.target.value) || 0)} hint="₹" />
        <div />
        <Button variant="primary" onClick={post} disabled={postMut.loading}
                style={{ height: 40, fontSize: 'var(--t-md)' }}>
          {postMut.loading ? 'Posting…' : 'Post purchase'}
        </Button>
      </div>

      {err && <InlineAlert message={err} onDismiss={() => setErr('')} />}
      {postMut.error && <InlineAlert message={postMut.error} onDismiss={postMut.clearError} />}
      {posted && !err && !postMut.error && (
        <div style={{
          fontSize: 'var(--t-sm)', color: 'var(--text-mute)',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          <Pill tone="pos">posted</Pill>
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            purchase {posted.refNo} · <Rupee paise={posted.totalPaise} />
          </span>
          <span style={{ color: 'var(--text-faint)' }}>·</span>
          <span>balance <Rupee paise={posted.balancePaise} /></span>
        </div>
      )}
    </div>
  );
}

function SupplierField({
  parties, value, onChange,
}: {
  parties: Party[];
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="field">
      <label className="field__label">Supplier</label>
      <select
        className="input"
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value) || null)}
      >
        <option value="">— pick supplier —</option>
        {parties.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}

function ItemPickField({
  items, value, onChange,
}: {
  items: Item[];
  value: number | '';
  onChange: (v: number | '') => void;
}) {
  return (
    <div className="field">
      <label className="field__label">Add item</label>
      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      >
        <option value="">— pick item —</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>
        ))}
      </select>
    </div>
  );
}

function InlineAlert({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="alert">
      <span style={{ whiteSpace: 'pre-wrap' }}>{message}</span>
      {onDismiss && (
        <button className="alert__dismiss" onClick={onDismiss} aria-label="dismiss">×</button>
      )}
    </div>
  );
}
