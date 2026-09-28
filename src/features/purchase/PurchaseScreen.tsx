import { useEffect, useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useMutation, errText } from '@/lib/useAsync';
import { fmtPaise, gramsToMg, caratToMg, rupeesToPaise } from '@/lib/format';
import { ErrorBanner, Spinner, LoadingBlock } from '@/components/Status';
import type { Item, Party, PurchaseLineInput } from '@shared/ipc';

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

export function PurchaseScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
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
  const [ok, setOk] = useState('');
  const postMut = useMutation<any, any>((p) => invoke(CH.purchasePost, p));

  useEffect(() => {
    (async () => {
      try {
        const [its, ps] = await Promise.all([invoke<Item[]>(CH.itemsList), invoke<Party[]>(CH.partiesList)]);
        setItems(its); setParties(ps.filter((p) => p.role === 'supplier' || p.role === 'both'));
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
      qty: it.unit === 'pcs' ? 1 : 0, weight: 0, ratePerUnit: 0, gstPct: it.gstBp / 100,
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
    setErr(''); setOk(''); postMut.clearError();
    if (!partyId) return setErr('supplier required');
    if (!refNo.trim()) return setErr('supplier ref no required');
    if (lines.length === 0) return setErr('at least one line');
    try {
      const res = await postMut.run({
        partyId, refNo, notes,
        paidCashPaise: rupeesToPaise(paidCash),
        paidBankPaise: rupeesToPaise(paidBank),
        lines: toInputs(),
      });
      setOk(`posted purchase ${res.refNo} · total ${fmtPaise(res.totalPaise)} · balance ${fmtPaise(res.balancePaise)}`);
      setLines([]); setRefNo(''); setPaidCash(0); setPaidBank(0); setNotes('');
    } catch { /* surfaced */ }
  }

  if (bootLoading) return <LoadingBlock label="loading purchase screen…" />;
  if (bootErr) return <ErrorBanner message={bootErr} onDismiss={() => window.location.reload()} />;

  return (
    <div className="max-w-5xl space-y-4">
      <div className="grid grid-cols-4 gap-2">
        <label className="text-xs text-muted col-span-2">Supplier
          <select className="input w-full" value={partyId ?? ''} onChange={(e) => setPartyId(Number(e.target.value) || null)}>
            <option value="">— select —</option>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">Supplier ref #
          <input className="input w-full mono" value={refNo} onChange={(e) => setRefNo(e.target.value)} />
        </label>
        <label className="text-xs text-muted">Notes
          <input className="input w-full" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      <div className="flex gap-2">
        <select className="input flex-1" value={pickItemId} onChange={(e) => setPickItemId(e.target.value === '' ? '' : Number(e.target.value))}>
          <option value="">— pick item —</option>
          {items.map((i) => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}
        </select>
        <button className="btn" onClick={addLine} type="button">Add line</button>
      </div>

      <table className="w-full text-xs">
        <thead className="text-muted border-b border-border">
          <tr>
            <th className="text-left py-1">Item</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Weight</th>
            <th className="text-right">Rate/unit</th>
            <th className="text-right">GST %</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.key} className="border-b border-border/50">
              <td className="py-1 pr-2">
                <div>{l.description}</div>
                <div className="text-muted mono">{l.category}{l.stamp ? ` · ${l.stamp}` : ''} · {l.unit}</div>
              </td>
              <td className="text-right"><input className="input w-14 text-right mono" type="number" value={l.qty} onChange={(e) => upd(l.key, { qty: Number(e.target.value) || 0 })} /></td>
              <td className="text-right">{l.unit === 'pcs' ? <span className="text-muted">—</span> : <input className="input w-20 text-right mono" type="number" step="0.001" value={l.weight} onChange={(e) => upd(l.key, { weight: Number(e.target.value) || 0 })} />}</td>
              <td className="text-right"><input className="input w-24 text-right mono" type="number" step="0.01" value={l.ratePerUnit} onChange={(e) => upd(l.key, { ratePerUnit: Number(e.target.value) || 0 })} /></td>
              <td className="text-right"><input className="input w-16 text-right mono" type="number" step="0.01" value={l.gstPct} onChange={(e) => upd(l.key, { gstPct: Number(e.target.value) || 0 })} /></td>
              <td className="text-right"><button className="link text-danger" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>×</button></td>
            </tr>
          ))}
          {lines.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted">no lines</td></tr>}
        </tbody>
      </table>

      <div className="grid grid-cols-4 gap-2 items-end">
        <label className="text-xs text-muted">Paid cash ₹
          <input className="input w-full mono" type="number" step="0.01" value={paidCash} onChange={(e) => setPaidCash(Number(e.target.value) || 0)} />
        </label>
        <label className="text-xs text-muted">Paid bank ₹
          <input className="input w-full mono" type="number" step="0.01" value={paidBank} onChange={(e) => setPaidBank(Number(e.target.value) || 0)} />
        </label>
        <div />
        <button className="btn-primary h-10" onClick={post} disabled={postMut.loading}>
          {postMut.loading ? <Spinner label="posting…" /> : 'Post purchase'}
        </button>
      </div>
      {err && <ErrorBanner message={err} onDismiss={() => setErr('')} />}
      {postMut.error && <ErrorBanner message={postMut.error} onDismiss={postMut.clearError} />}
      {ok && <div className="text-success text-xs">{ok}</div>}
    </div>
  );
}
